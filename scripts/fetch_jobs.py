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


def load_dotenv():
    """Load KEY=VALUE lines from a local .env (gitignored) into os.environ.

    Lets you run this script locally with secrets (JOOBLE_KEY, ADZUNA_*) without
    ever committing them. In GitHub Actions these come from encrypted repo
    secrets instead, so no .env exists there and this is a harmless no-op.
    Existing environment variables always win over the file.
    """
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val

# Broad term set for Safal's target roles. Used for Jooble (generous free tier:
# 3 locations x these terms x 8 runs/day stays well under 500 calls/day).
SEARCH_TERMS = [
    "AI trainer", "data annotation", "LLM", "AI analyst", "data labeling",
    "RLHF", "prompt engineer", "model evaluation", "AI tutor",
    "search evaluator", "content moderation", "computer vision annotation",
]

# Focused subset for Adzuna ONLY — its free tier is ~250 calls/day and we query
# 6 countries x these terms x 8 runs/day. Keep this list <= 5 terms (=240/day).
ADZUNA_TERMS = ["AI trainer", "data annotation", "LLM", "AI analyst", "data labeling"]

# Adzuna countries to query → gives INTERNATIONAL coverage + salary data.
# Each entry: country code -> currency the API returns salaries in.
# in=India, us=USA, gb=UK, ca=Canada, au=Australia, de=Germany, sg=Singapore.
ADZUNA_COUNTRIES = {
    "in": "INR", "us": "USD", "gb": "GBP",
    "ca": "CAD", "au": "AUD", "de": "EUR",
}


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


def norm(id, title, company, location, work_type, url, date, description, tags, source,
         salary_min=None, salary_max=None, salary_currency=None, salary_period=None):
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
        "salaryMin": salary_min,
        "salaryMax": salary_max,
        "salaryCurrency": salary_currency,
        "salaryPeriod": salary_period,
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
    """International coverage (multiple countries) + salary. Requires keys."""
    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        print("[adzuna] skipped (no credentials)", file=sys.stderr)
        return []

    out = []
    seen = set()
    for country, currency in ADZUNA_COUNTRIES.items():
        for term in ADZUNA_TERMS:
            try:
                params = urllib.parse.urlencode({
                    "app_id": app_id, "app_key": app_key,
                    "results_per_page": 25, "what": term,
                    "content-type": "application/json", "max_days_old": 21,
                    "sort_by": "date",
                })
                d = http_get_json(f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?{params}")
                for j in d.get("results", []):
                    jid = f"adzuna:{country}:{j.get('id')}"
                    if jid in seen:
                        continue
                    seen.add(jid)
                    loc = (j.get("location") or {}).get("display_name", "")
                    desc = j.get("description") or ""
                    out.append(norm(
                        jid, j.get("title"), (j.get("company") or {}).get("display_name"),
                        loc, guess_work_type(f"{j.get('title','')} {desc} {loc}"),
                        j.get("redirect_url"), j.get("created"),
                        desc, [j.get("category", {}).get("label", "")],
                        f"Adzuna ({country.upper()})",
                        salary_min=j.get("salary_min"), salary_max=j.get("salary_max"),
                        salary_currency=currency, salary_period="year",
                    ))
                time.sleep(0.3)  # be polite + stay under rate limits
            except Exception as e:
                print(f"[adzuna:{country}:{term}] {e}", file=sys.stderr)
    return out


def fetch_working_nomads():
    """Remote-job aggregator. No CORS headers, so it must run here (not browser)."""
    out = []
    try:
        d = http_get_json("https://www.workingnomads.com/api/exposed_jobs/")
        rows = d if isinstance(d, list) else d.get("jobs", [])
        for j in rows:
            out.append(norm(
                f"workingnomads:{j.get('url')}", j.get("title"), j.get("company_name"),
                j.get("location") or "Remote", "remote", j.get("url"),
                j.get("pub_date"), j.get("description"),
                [t.strip() for t in (j.get("tags") or "").split(",") if t.strip()]
                + ([j.get("category_name")] if j.get("category_name") else []),
                "Working Nomads",
            ))
    except Exception as e:
        print(f"[workingnomads] {e}", file=sys.stderr)
    return out


# Jooble aggregates postings from across the web (incl. listings that originate
# on LinkedIn/Indeed/Naukri) via a legitimate API. Free key: https://jooble.org/api/about
JOOBLE_LOCATIONS = ["India", "United States", "United Kingdom"]


def fetch_jooble():
    """Broad IN/US/UK coverage. Requires a free JOOBLE_KEY repo secret."""
    key = os.environ.get("JOOBLE_KEY")
    if not key:
        print("[jooble] skipped (no JOOBLE_KEY)", file=sys.stderr)
        return []

    out, seen = [], set()
    for loc in JOOBLE_LOCATIONS:
        for term in SEARCH_TERMS:
            try:
                body = json.dumps({"keywords": term, "location": loc}).encode("utf-8")
                d = http_get_json(
                    f"https://jooble.org/api/{key}", data=body,
                    headers={"Content-Type": "application/json"},
                )
                for j in d.get("jobs", []):
                    jid = f"jooble:{j.get('id')}"
                    if jid in seen:
                        continue
                    seen.add(jid)
                    out.append(norm(
                        jid, j.get("title"), j.get("company"),
                        j.get("location") or loc, guess_work_type(
                            f"{j.get('title','')} {j.get('snippet','')} {j.get('location','')}"),
                        j.get("link"), j.get("updated"),
                        j.get("snippet"), [j.get("type")] if j.get("type") else [],
                        f"Jooble ({loc})",
                    ))
                time.sleep(0.3)
            except Exception as e:
                print(f"[jooble:{loc}:{term}] {e}", file=sys.stderr)
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
    load_dotenv()
    jobs = []
    for fn in (fetch_remotive, fetch_arbeitnow, fetch_jobicy,
               fetch_working_nomads, fetch_jooble, fetch_adzuna):
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
