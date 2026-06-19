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
  Remotive, RemoteOK, Arbeitnow, Jobicy and Himalayas (no delay, no server).
- **Always-available fallback** — a GitHub Action refreshes `data/jobs.json`
  every 30 min, and can pull **India / on-site** jobs from Adzuna.
- **CV matching** — scores each job on your skills (data annotation, AI/LLM
  evaluation, prompt writing, computer vision, QA, RLHF…). Matches if even one
  skill/qualification hits. Shows *why* each job matched.
- **Filters** — keyword, work type (remote/hybrid/on-site), India-only, sort by
  best match or newest.
- **Tailored cover letter** — generated from your CV for each job, copy-paste ready.

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

### (Optional) Add India / on-site jobs via Adzuna
1. Get free API keys at <https://developer.adzuna.com/>.
2. In the repo: **Settings → Secrets and variables → Actions → New repository
   secret** — add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
3. The next workflow run will include Adzuna India results in `data/jobs.json`.

---

## File map

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/style.css` | Styling (dark theme) |
| `js/profile.js` | **Your CV / keywords — edit this** |
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
