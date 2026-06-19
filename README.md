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
| Landing.jobs | live API | Medium–High (EU tech) | ✅ with salary |
| Greenhouse boards | live API | High (direct employer) | ✅ per-company |
| Lever boards | live API | High (direct employer) | ✅ per-company |
| Ashby boards | live API | High (direct employer) | ✅ per-company |
| Working Nomads | Action | Medium–High (remote) | ✅ |
| Adzuna (IN/US/UK/CA/AU/DE) | Action + key | Medium–High, real salaries | ✅ with salary |
| Jooble (IN/US/UK) | Action + key | Broad (re-lists LinkedIn/Indeed/Naukri) | ✅ |

### Company career boards (Greenhouse / Lever / Ashby)
These pull jobs **straight from the employer's own ATS** — often the same roles
LinkedIn/Indeed re-list, but applied to at the source. Edit the `COMPANY_BOARDS`
object at the top of `js/sources.js` to add companies: find the company's job-board
URL and add the slug — e.g. `jobs.lever.co/`**`netflix`** → add `"netflix"` to the
`lever` list. Seeded with AI-lab / data employers (Anthropic, OpenAI, Scale AI,
Databricks…). A wrong slug just returns nothing; it never breaks the app. No key needed.

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

### Local API keys (Jooble / Adzuna)
For local runs of `scripts/fetch_jobs.py`, copy `.env.example` to `.env` and fill
in your keys. `.env` is **gitignored** — it is never committed. In GitHub Actions
the same keys come from encrypted repo secrets instead, so no key is ever exposed.

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

### (Optional) Add broad IN/US/UK coverage via Jooble
1. Get a free API key at <https://jooble.org/api/about>.
2. Add it as a repo secret named `JOOBLE_KEY` (Settings → Secrets and variables →
   Actions → New repository secret).
3. The next workflow run includes Jooble results for India, USA and UK — Jooble
   aggregates postings from across the web (including listings that originate on
   LinkedIn / Indeed / Naukri) through a legitimate API.

> **Rate limit:** Adzuna's free tier allows ~250 API calls/day, so it uses the
> capped `ADZUNA_TERMS` list (6 countries × 5 terms × 8 runs/day = 240/day). The
> broader `SEARCH_TERMS` list (12 terms) is used by **Jooble**, whose free tier is
> larger (3 locations × 12 terms × 8 runs/day = 288/day, under its 500 limit). To
> add terms: extend `SEARCH_TERMS` freely; keep `ADZUNA_TERMS` ≤ 5 (or widen the
> cron interval). Both lists live in `scripts/fetch_jobs.py`.

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
| `tools/autofill.user.js` | Userscript: one-click fill of ATS application forms |
| `scripts/fetch_jobs.py` | Server-side fetcher (GitHub Actions, incl. Adzuna) |
| `scripts/digest.py` | Builds + emails the daily top-matches digest |
| `data/digest_seen.json` | Ids already emailed (so digests only show new roles) |
| `.github/workflows/fetch-jobs.yml` | Scheduled refresh of `data/jobs.json` |
| `data/jobs.json` | Cached snapshot (auto-updated) |

---

## Daily digest email (top new matches)

`scripts/digest.py` + `.github/workflows/daily-digest.yml` email you the day's
**top ~12 NEW** roles each morning (09:00 IST), ranked by the same CV scoring the
site uses. Already-emailed jobs are tracked in `data/digest_seen.json`, so you
only ever get fresh roles. If there are no new matches, no email is sent.

**Setup — create a Gmail App Password and add 3 secrets:**
1. Turn on **2-Step Verification** for your Google account
   (<https://myaccount.google.com/security>).
2. Create an **App Password**: <https://myaccount.google.com/apppasswords> →
   name it e.g. "Job Match" → Google shows a 16-character password.
3. In the repo: **Settings → Secrets and variables → Actions → New repository
   secret**, add:
   - `GMAIL_USER` — your Gmail address (e.g. `you@gmail.com`)
   - `GMAIL_APP_PASSWORD` — the 16-char App Password (spaces optional)
   - `DIGEST_TO` *(optional)* — where to send; defaults to `GMAIL_USER`

That's it — the digest then arrives daily. Trigger it manually any time from
**Actions → Daily job digest email → Run workflow**. Without the secrets the
workflow still runs and just prints a preview (no email, nothing marked sent).

## Auto-fill applications (Greenhouse / Lever / Ashby / Workable)

`tools/autofill.user.js` is a **userscript** that fills application forms on the
big ATS platforms in one click — identity, contact, links, common screening
questions, and a tailored cover letter — then **you review and submit**. It does
*not* submit anything by itself.

**Install:**
1. Add the [Tampermonkey](https://www.tampermonkey.net/) extension (Chrome/Edge/Firefox).
2. Tampermonkey → **Create a new script**, paste in `tools/autofill.user.js`, save.
3. Edit the `ME = { … }` block at the top with your details. **`phone` and
   `linkedin` are blank in the repo copy on purpose** (it's public) — fill them in
   your *local* install. Nothing you enter is ever uploaded.

**Use:** open any Greenhouse/Lever/Ashby/Workable application page → click the
floating **⚡ Autofill** button → attach your résumé (file uploads can't be
auto-set by a script, so they're highlighted) → review → submit.

## A note on full "auto-submit" to LinkedIn/Indeed/Naukri

Truly auto-*submitting* applications across LinkedIn/Indeed/Naukri is against their
terms of service, is fragile (they change constantly + use anti-bot detection),
and frequently gets real accounts **permanently banned**. Their apply forms are
also CORS-locked and their submission APIs need the *employer's* key — a candidate
can't post through them. So this project maximises *reach* (many job APIs) and
*speed* (one-click deep links + the ATS auto-fill above) while keeping you in
control and your accounts safe — which is also what recruiters respond to better.
