#!/usr/bin/env python3
"""
digest.py — emails a daily digest of the top NEW job matches.

Reads data/jobs.json (produced by fetch_jobs.py), scores each job against the
same CV keywords the website uses (mirrors js/matcher.js + js/profile.js), keeps
matches, and emails the best NEW ones (jobs not sent in a previous digest).
Already-sent job ids are tracked in data/digest_seen.json so you only ever get
fresh roles.

Secrets (set as GitHub repo secrets / local .env):
  GMAIL_USER          your Gmail address (the sender)
  GMAIL_APP_PASSWORD  a Gmail App Password (NOT your normal password)
  DIGEST_TO           optional recipient; defaults to GMAIL_USER

If the credentials are absent it prints the digest and exits cleanly (no error),
so the workflow never fails just because email isn't configured yet.
"""

import json
import os
import smtplib
import ssl
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from html import escape

TOP_N = 12          # max roles per email
SEEN_CAP = 8000     # keep the seen-list from growing forever
SEEN_PATH = "data/digest_seen.json"
JOBS_PATH = "data/jobs.json"

# --- CV keywords (mirrors js/profile.js) -----------------------------------
KEYWORDS = [
    ("ai trainer", 10), ("llm trainer", 10), ("ai/llm", 10), ("data annotation", 9),
    ("data annotator", 9), ("annotator", 8), ("annotation", 7), ("rlhf", 9),
    ("ai analyst", 9), ("ai/llm practice", 10), ("ai quality", 9), ("quality analyst", 8),
    ("ai qa", 9), ("llm evaluation", 9), ("model evaluation", 8), ("prompt engineer", 8),
    ("prompt writing", 8), ("prompt", 5), ("generalist", 6), ("ai tutor", 8),
    ("ai content", 6), ("data labeling", 7), ("data labelling", 7), ("labeling", 5),
    ("image annotation", 7), ("computer vision", 6), ("quality assurance", 5),
    ("qa analyst", 6), ("human in the loop", 7), ("human-in-the-loop", 7),
    ("model output", 7), ("training data", 6), ("fine-tuning", 5), ("fine tuning", 5),
    ("reinforcement learning from human feedback", 9), ("supervised fine-tuning", 7),
    ("evaluation", 3), ("machine learning", 3), ("natural language", 4), ("nlp", 4),
    ("json", 2), ("linux", 2), ("ubuntu", 2), ("dataset", 3), ("content moderation", 4),
    ("search quality", 5), ("search evaluator", 6), ("ai rater", 7), ("data rater", 7),
    ("conversation design", 5), ("red team", 5), ("ai safety", 5),
]
NEGATIVE_TITLE = [
    "senior software engineer", "staff engineer", "principal engineer", "sales",
    "account executive", "recruiter", "devops", "kubernetes", "frontend developer",
    "backend developer", "full stack", "ios developer", "android developer",
    "solidity", "blockchain", "accountant",
]


def parse_date(s):
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def score_job(job):
    title = (job.get("title") or "").lower()
    hay = f"{title}\n{(job.get('description') or '').lower()}\n{' '.join(job.get('tags') or []).lower()}"
    score, matched = 0, []
    for term, weight in KEYWORDS:
        if term in hay:
            in_title = term in title
            score += weight * 2 if in_title else weight
            matched.append((term, weight))
    penalty = sum(8 for neg in NEGATIVE_TITLE if neg in title)
    score = max(0, score - penalty)

    bonus = 0
    d = parse_date(job.get("date"))
    if d:
        age = (datetime.now(timezone.utc) - d).total_seconds() / 86400
        bonus = 6 if age <= 1 else 4 if age <= 3 else 2 if age <= 7 else 1 if age <= 14 else 0

    # De-dupe matched terms, keeping highest-weight first (for "why it matched").
    seen, terms = set(), []
    for t, _w in sorted(matched, key=lambda m: -m[1]):
        if t not in seen:
            seen.add(t)
            terms.append(t)
    return score + bonus, score, terms[:5]


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def build_html(jobs, date_str):
    rows = []
    for i, j in enumerate(jobs, 1):
        sal = j.get("salaryText") or ""
        if not sal and j.get("salaryMin"):
            cur = j.get("salaryCurrency") or ""
            sal = f"{cur} {int(j['salaryMin']):,}+"
        meta = " · ".join(filter(None, [
            escape(j.get("location") or ""),
            escape(j.get("source") or ""),
            f"match {j['_score']}",
            escape(sal),
        ]))
        why = ", ".join(j["_terms"])
        rows.append(f"""
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
          <div style="font-size:15px;font-weight:600;color:#111;">
            {i}. {escape(j.get('title') or 'Role')} — {escape(j.get('company') or '')}</div>
          <div style="font-size:12px;color:#666;margin:3px 0;">{meta}</div>
          <div style="font-size:12px;color:#888;">why: {escape(why)}</div>
          <a href="{escape(j.get('url') or '#')}"
             style="display:inline-block;margin-top:6px;font-size:13px;color:#2563eb;
             text-decoration:none;font-weight:600;">Apply ▸</a>
        </td></tr>""")
    return f"""<!doctype html><html><body style="margin:0;background:#f6f7f9;">
      <div style="max-width:640px;margin:0 auto;padding:24px;font-family:system-ui,Arial,sans-serif;">
        <h1 style="font-size:20px;color:#111;margin:0 0 4px;">Job Match — {len(jobs)} new roles</h1>
        <p style="color:#666;font-size:13px;margin:0 0 16px;">Top matches for your CV · {date_str}</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;
          padding:8px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);">{''.join(rows)}</table>
        <p style="color:#999;font-size:11px;margin-top:18px;">
          Use the ⚡ Autofill userscript on each apply page, then review &amp; submit.
          You're receiving this because you set up the Job Match daily digest.</p>
      </div></body></html>"""


def send_email(html, subject, user, password, to):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to
    msg.set_content("Your email client does not support HTML. Open the live site for the ranked list.")
    msg.add_alternative(html, subtype="html")
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(user, password)
        s.send_message(msg)


def load_dotenv():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


def main():
    load_dotenv()
    data = load_json(JOBS_PATH, {"jobs": []})
    seen = set(load_json(SEEN_PATH, {"seen": []}).get("seen", []))

    scored = []
    for j in data.get("jobs", []):
        total, raw, terms = score_job(j)
        if raw > 0:  # matched at least one keyword after penalty
            j = {**j, "_score": total, "_terms": terms}
            scored.append(j)
    scored.sort(key=lambda x: (x["_score"], x.get("date") or ""), reverse=True)

    new = [j for j in scored if j.get("id") not in seen]
    top = new[:TOP_N]

    print(f"{len(scored)} total matches, {len(new)} new, sending top {len(top)}.")
    if not top:
        print("No new matches today — nothing to send.")
        return

    date_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
    html = build_html(top, date_str)

    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    to = os.environ.get("DIGEST_TO") or user

    if not user or not password:
        # Not configured yet — preview only, and DON'T mark seen (so the first
        # real email still includes these roles).
        print("[digest] email not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing) — preview only.")
        return
    try:
        send_email(html, f"Job Match — {len(top)} new roles for you ({date_str})",
                   user, password, to)
        print(f"[digest] emailed {len(top)} roles to {to}.")
    except Exception as e:
        print(f"[digest] send failed: {e}", file=sys.stderr)
        return  # don't mark as seen if the email didn't go out

    # Mark these as sent so tomorrow's digest only shows newer roles.
    seen.update(j.get("id") for j in top if j.get("id"))
    seen_list = list(seen)[-SEEN_CAP:]
    with open(SEEN_PATH, "w", encoding="utf-8") as f:
        json.dump({"seen": seen_list, "updatedAt": datetime.now(timezone.utc).isoformat()},
                  f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
