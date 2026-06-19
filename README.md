# Job Match — AI/LLM & Data Annotation

A free, deploy-on-GitHub-Pages web app that aggregates **live job postings** from
multiple job boards, matches them against **Safal Bhalerao's CV**, ranks them by
fit, and gives you **one-click apply links + an auto-generated tailored cover
letter** for each role.

It does **not** auto-submit applications or scrape LinkedIn/Indeed/Naukri — that
violates their terms and risks getting your accounts banned. Instead it pulls
from job boards with legitimate public APIs (which already re-list a large share
of LinkedIn/Indeed jobs) and takes you straight to the real application page.

---

## Features

- **Real-time on load** — the browser fetches live jobs directly from
  Remotive, RemoteOK, Arbeitnow, Jobicy, Himalayas and The Muse (no delay, no server).
- **International + higher-paying** — Adzuna (via the GitHub Action) adds jobs
  from **India, USA, UK, Canada, Australia and Germany** with real salary data.
- **Salary in any currency → INR** — salaries are parsed (from structured fields
  *and* free text), converted to **₹/month**, shown on each card, and filterable.
  Default filter hides jobs that state a salary **below ₹30,000/month**.
- **CV matching** — scores each job on your skills (data annotation, AI/LLM
  evaluation, prompt writing, computer vision, QA, RLHF…). Matches if even one
  skill/qualification hits. Shows *why* each job matched.
- **Filters & sort** — keyword, work type (remote/hybrid/on-site), India-only,
  salary floor; sort by best match, newest, or **highest salary**.
- **Tailored cover letter** — generated from your CV for each job, copy-paste ready.

## Salary handling

- Threshold lives in `js/profile.js` → `minSalaryInrPerMonth` (default `30000`,
  i.e. **₹30k per month**). Change it to raise/lower the floor.
- Currency conversion rates are in `js/salary.js` → `FX_TO_INR` (approximate;
  edit if you want precision). Annual figures are divided by 12; hourly × 160.
- The salary dropdown has three modes:
  - **≥ ₹30k/mo (or unstated)** *(default)* — hides only jobs that *explicitly*
    state a salary under the floor; keeps jobs with no stated salary.
  - **Stated ≥ ₹30k/mo only** — strict: shows only jobs with a salary at/above the floor.
  - **Any salary** — no salary filtering.

## Job platforms & pay range

| Platform | Source | Typical pay | In this app |
|----------|--------|-------------|-------------|
| RemoteOK | live API | High (global tech, USD) | ✅ with salary |
| Jobicy | live API | Medium–High (global remote) | ✅ with salary |
| Himalayas | live API | Medium–High (global remote) | ✅ with salary |
| Remotive | live API | Medium–High (global remote) | ✅ |
| The Muse | live API | Medium–High (mostly US) | ✅ |
| Arbeitnow | live API | Medium (Europe) | ✅ |
| Adzuna (IN/US/UK/CA/AU/DE) | Action + key | Medium–High, real salaries | ✅ with salary |

**Other higher/medium-paying platforms worth applying on directly** (no open API,
so not auto-aggregated — listed here for your manual search):
Wellfound (AngelList Talent), Y Combinator "Work at a Startup", Otta, Dice,
Built In, Turing, Toptal, Outlier / Scale AI, DataAnnotation.tech, Mercor,
Invisible Tech, Appen, Welocalize, TELUS International AI (Raterlabs) — the last
several specialise in **AI trainer / data-rating** roles that fit your CV.

---

## How matching works

`js/profile.js` holds your CV as weighted keywords. `js/matcher.js` scans each
job's title + description + tags, adds up weights (title hits count double),
applies a small freshness bonus and a penalty for obvious mismatches, then keeps
anything that matched at least one keyword. **Edit `js/profile.js` to tune what
you see** — add keywords, change weights, or update your contact details (which
also feed the cover letter).

---

## Run locally

It's a static site — just serve the folder:

```bash
# Python (any version 3)
python -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` mostly works, but a local server
avoids browser CORS quirks.)

---

## Deploy to GitHub Pages (free)

1. Create a GitHub repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: job match app"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / root → Save.**
3. Your site goes live at `https://<you>.github.io/<repo>/` in a minute or two.

### Enable the auto-refresh action
The workflow in `.github/workflows/fetch-jobs.yml` runs automatically once Pages
is set up. To allow it to commit the snapshot, ensure **Settings → Actions →
General → Workflow permissions** is set to **Read and write permissions**.

### (Optional) Add international jobs + salaries via Adzuna
1. Get free API keys at <https://developer.adzuna.com/>.
2. In the repo: **Settings → Secrets and variables → Actions → New repository
   secret** — add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
3. The next workflow run will include Adzuna results (India, USA, UK, Canada,
   Australia, Germany — with salaries) in `data/jobs.json`.

> **Rate limit:** Adzuna's free tier allows ~250 API calls/day. The workflow
> uses 6 countries × 4 search terms = 24 calls/run and runs every 3 hours
> (~192/day). To add more countries/terms, edit `ADZUNA_COUNTRIES` / `SEARCH_TERMS`
> in `scripts/fetch_jobs.py` and consider widening the cron interval.

---

## File map

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/style.css` | Styling (dark theme) |
| `js/profile.js` | **Your CV / keywords / salary floor — edit this** |
| `js/salary.js` | Salary parsing + currency→INR conversion |
| `js/sources.js` | Live job-board fetchers (browser) |
| `js/matcher.js` | Scoring & ranking |
| `js/coverletter.js` | Cover-letter generator |
| `js/app.js` | UI orchestration |
| `scripts/fetch_jobs.py` | Server-side fetcher (GitHub Actions, incl. Adzuna) |
| `.github/workflows/fetch-jobs.yml` | Scheduled refresh of `data/jobs.json` |
| `data/jobs.json` | Cached snapshot (auto-updated) |

---

## A note on "auto-apply"

Truly auto-submitting applications across LinkedIn/Indeed/Naukri is against their
terms of service, is fragile (they change constantly + use anti-bot detection),
and frequently gets real accounts **permanently banned**. This tool deliberately
stops at the *apply page* with your cover letter ready, so you stay in control and
your accounts stay safe — which is also what recruiters respond to better.
