#!/usr/bin/env python3
"""
fetch_jobs.py — server-side job fetcher run by GitHub Actions.

Writes data/jobs.json, a cached snapshot the static site reads as a fallback
and as the source for India / on-site jobs (via Adzuna, which needs API keys
that we keep as repo secrets rather than exposing in the browser).

Adzuna is optional: set ADZUNA_APP_ID and ADZUNA_APP_KEY as repo secrets to
enable it (free tier: https://developer.adzuna.com/). Without them the script
still aggregates the no-key sources so the snapshot is never empty.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone

UA = {"User-Agent": "job-match-bot/1.0 (+github actions)"}
TIMEOUT = 20

# Search terms aimed at Safal's target roles (used for the Adzuna queries).
SEARCH_TERMS = [
    "AI trainer", "data annotation", "data annotator", "LLM",
    "AI analyst", "prompt", "RLHF", "AI quality", "annotation",
    "data labeling", "AI QA", "model evaluation",
]


def http_get_json(url, data=None, headers=None):
    h = dict(UA)
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def norm(id, title, company, location, work_type, url, date, description, tags, source):
    return {
        "id": id,
        "title": title or "",
        "company": company or "Unknown",
        "location": location or "",
        "workType": work_type or "unknown",
        "url": url or "",
        "date": date,  # ISO string or None
        "description": strip_html(description)[:1200],
        "tags": tags or [],
        "source": source,
    }


# --- Sources ---------------------------------------------------------------
def fetch_remotive():
    out = []
    try:
        d = http_get_json("https://remotive.com/api/remote-jobs?limit=100")
        for j in d.get("jobs", []):
            out.append(norm(
                f"remotive:{j.get('id')}", j.get("title"), j.get("company_name"),
                j.get("candidate_required_location") or "Remote", "remote",
                j.get("url"), j.get("publication_date"),
                j.get("description"), j.get("tags") or [], "Remotive",
            ))
    except Exception as e:
        print(f"[remotive] {e}", file=sys.stderr)
    return out


def fetch_arbeitnow():
    out = []
    try:
        d = http_get_json("https://www.arbeitnow.com/api/job-board-api")
        for j in d.get("data", []):
            ts = j.get("created_at")
            date = datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None
            out.append(norm(
                f"arbeitnow:{j.get('slug')}", j.get("title"), j.get("company_name"),
                j.get("location"), "remote" if j.get("remote") else "unknown",
                j.get("url"), date, j.get("description"),
                (j.get("tags") or []) + (j.get("job_types") or []), "Arbeitnow",
            ))
    except Exception as e:
        print(f"[arbeitnow] {e}", file=sys.stderr)
    return out


def fetch_jobicy():
    out = []
    try:
        d = http_get_json("https://jobicy.com/api/v2/remote-jobs?count=100")
        for j in d.get("jobs", []):
            out.append(norm(
                f"jobicy:{j.get('id')}", j.get("jobTitle"), j.get("companyName"),
                j.get("jobGeo") or "Remote", "remote", j.get("url"),
                j.get("pubDate"), j.get("jobExcerpt") or j.get("jobDescription"),
                [], "Jobicy",
            ))
    except Exception as e:
        print(f"[jobicy] {e}", file=sys.stderr)
    return out


def guess_work_type(text):
    t = (text or "").lower()
    if "hybrid" in t:
        return "hybrid"
    if any(k in t for k in ("remote", "work from home", "wfh", "anywhere")):
        return "remote"
    return "onsite"


def fetch_adzuna():
    """India + on-site coverage. Requires ADZUNA_APP_ID / ADZUNA_APP_KEY."""
    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        print("[adzuna] skipped (no credentials)", file=sys.stderr)
        return []

    out = []
    seen = set()
    for term in SEARCH_TERMS:
        try:
            params = urllib.parse.urlencode({
                "app_id": app_id, "app_key": app_key,
                "results_per_page": 25, "what": term,
                "content-type": "application/json", "max_days_old": 14,
                "sort_by": "date",
            })
            # country "in" = India. Change to gb/us/etc for other markets.
            d = http_get_json(f"https://api.adzuna.com/v1/api/jobs/in/search/1?{params}")
            for j in d.get("results", []):
                jid = f"adzuna:{j.get('id')}"
                if jid in seen:
                    continue
                seen.add(jid)
                loc = (j.get("location") or {}).get("display_name", "")
                desc = j.get("description") or ""
                out.append(norm(
                    jid, j.get("title"), (j.get("company") or {}).get("display_name"),
                    loc, guess_work_type(f"{j.get('title','')} {desc} {loc}"),
                    j.get("redirect_url"), j.get("created"),
                    desc, [j.get("category", {}).get("label", "")], "Adzuna (India)",
                ))
            time.sleep(0.4)  # be polite to the API
        except Exception as e:
            print(f"[adzuna:{term}] {e}", file=sys.stderr)
    return out


def dedupe(jobs):
    seen, out = set(), []
    for j in jobs:
        key = (j["url"] or f"{j['company']}|{j['title']}").lower().strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
    return out


def main():
    jobs = []
    for fn in (fetch_remotive, fetch_arbeitnow, fetch_jobicy, fetch_adzuna):
        jobs.extend(fn())

    jobs = dedupe(jobs)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(jobs),
        "jobs": jobs,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/jobs.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    print(f"Wrote data/jobs.json with {len(jobs)} jobs")


if __name__ == "__main__":
    main()
