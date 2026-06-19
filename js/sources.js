// ===========================================================================
// sources.js  —  Fetchers for free, CORS-friendly job APIs.
// Each fetcher returns a Promise<Job[]> in a NORMALISED shape (see normalise()).
// All are wrapped so one failing source never breaks the others.
// ===========================================================================

// Normalised job shape used everywhere downstream.
function makeJob({ id, title, company, location, workType, url, date, description, tags, source,
  salaryMin, salaryMax, salaryCurrency, salaryPeriod, salaryText }) {
  return {
    id: id || `${source}:${(company || "")}:${(title || "")}`.toLowerCase(),
    title: title || "",
    company: company || "Unknown",
    location: location || "",
    workType: workType || "unknown", // 'remote' | 'hybrid' | 'onsite' | 'unknown'
    url: url || "",
    date: date ? new Date(date) : null,
    description: description || "",
    tags: tags || [],
    source: source,
    // Structured salary (when the source provides it); else parsed from text later.
    salaryMin: salaryMin != null ? Number(salaryMin) : null,
    salaryMax: salaryMax != null ? Number(salaryMax) : null,
    salaryCurrency: salaryCurrency || null,
    salaryPeriod: salaryPeriod || null,
    salaryText: salaryText || "",
  };
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

// Guess work type from free text.
function guessWorkType(text) {
  const t = (text || "").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b|work from home|wfh|anywhere|worldwide/.test(t)) return "remote";
  if (/on-?site|in office|in-office/.test(t)) return "onsite";
  return "unknown";
}

// ===========================================================================
// COMPANY CAREER BOARDS — direct from the employer's own ATS (no recruiter,
// often the SAME jobs LinkedIn/Indeed re-list but applied to at the source).
// These three ATS vendors expose a public, CORS-friendly JSON board per company.
//
// HOW TO ADD A COMPANY:
//   1. Open the company's careers page and look at the URL of its job board.
//   2. Greenhouse → boards.greenhouse.io/<token>  OR job-boards.greenhouse.io/<token>
//      Lever      → jobs.lever.co/<token>
//      Ashby      → jobs.ashbyhq.com/<token>
//   3. Add the <token> (the slug after the domain) to the matching list below.
//   A wrong/closed token just returns nothing — it never breaks the app.
//
// Seeded with AI-lab / data-annotation employers that fit Safal's CV. Add your
// own freely — these run live in the browser, no API key needed.
// ===========================================================================
const COMPANY_BOARDS = {
  // AI labs + data-annotation/ops employers (best fit for the CV) come first,
  // then major tech with ML/data teams. All tokens verified to resolve.
  greenhouse: [
    "anthropic", "scaleai", "labelbox", "invisible", "turing", "databricks",
    "gitlab", "dropbox", "cloudflare", "datadog", "mongodb", "elastic",
    "reddit", "pinterest", "coinbase", "stripe", "figma", "airbnb",
  ],
  lever: ["palantir", "toptal", "plaid", "netflix", "spotify"],
  ashby: [
    "openai", "cohere", "perplexity", "character", "runway", "writer",
    "harvey", "notion", "linear", "vercel", "ramp",
  ],
};

// Decode HTML entities then strip tags (Greenhouse double-encodes its content).
function decodeAndStrip(s) {
  return stripHtml(stripHtml(s));
}

// Generic fetch with timeout so a slow source can't hang the whole load.
async function fetchJson(url, { timeout = 12000, options = {} } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- Remotive ---------------------------------------------------------------
async function fetchRemotive() {
  const data = await fetchJson("https://remotive.com/api/remote-jobs?limit=100");
  return (data.jobs || []).map((j) =>
    makeJob({
      id: `remotive:${j.id}`,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || "Remote",
      workType: "remote",
      url: j.url,
      date: j.publication_date,
      description: stripHtml(j.description),
      tags: j.tags || [],
      source: "Remotive",
      salaryText: j.salary || "", // Remotive salary is free text; parsed later
    })
  );
}

// --- RemoteOK ---------------------------------------------------------------
async function fetchRemoteOK() {
  const data = await fetchJson("https://remoteok.com/api");
  // First element is a legal/metadata object — skip anything without "position".
  return (Array.isArray(data) ? data : [])
    .filter((j) => j && j.position)
    .map((j) =>
      makeJob({
        id: `remoteok:${j.id}`,
        title: j.position,
        company: j.company,
        location: j.location || "Remote",
        workType: "remote",
        url: j.url || j.apply_url,
        date: j.date,
        description: stripHtml(j.description),
        tags: j.tags || [],
        source: "RemoteOK",
        salaryMin: j.salary_min || null, // RemoteOK gives USD annual
        salaryMax: j.salary_max || null,
        salaryCurrency: "USD",
        salaryPeriod: "year",
      })
    );
}

// --- The Muse (global, all work types) -------------------------------------
async function fetchTheMuse() {
  const all = [];
  for (let page = 1; page <= 2; page++) {
    const data = await fetchJson(`https://www.themuse.com/api/public/jobs?page=${page}`);
    for (const j of data.results || []) {
      const locs = (j.locations || []).map((l) => l.name);
      const locStr = locs.join(", ");
      all.push(
        makeJob({
          id: `themuse:${j.id}`,
          title: j.name,
          company: j.company && j.company.name,
          location: locStr || "Flexible",
          workType: /flexible|remote/i.test(locStr) ? "remote" : guessWorkType(locStr),
          url: j.refs && j.refs.landing_page,
          date: j.publication_date,
          description: stripHtml(j.contents),
          tags: (j.categories || []).map((c) => c.name).concat((j.levels || []).map((l) => l.name)),
          source: "The Muse",
        })
      );
    }
  }
  return all;
}

// --- Arbeitnow --------------------------------------------------------------
async function fetchArbeitnow() {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  return (data.data || []).map((j) =>
    makeJob({
      id: `arbeitnow:${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location,
      workType: j.remote ? "remote" : guessWorkType(j.location + " " + j.title),
      url: j.url,
      date: j.created_at ? j.created_at * 1000 : null,
      description: stripHtml(j.description),
      tags: (j.tags || []).concat(j.job_types || []),
      source: "Arbeitnow",
    })
  );
}

// --- Jobicy -----------------------------------------------------------------
async function fetchJobicy() {
  const data = await fetchJson("https://jobicy.com/api/v2/remote-jobs?count=100");
  return (data.jobs || []).map((j) =>
    makeJob({
      id: `jobicy:${j.id}`,
      title: j.jobTitle,
      company: j.companyName,
      location: j.jobGeo || "Remote",
      workType: "remote",
      url: j.url,
      date: j.pubDate,
      description: stripHtml(j.jobExcerpt || j.jobDescription),
      tags: [].concat(j.jobIndustry || [], j.jobType || []),
      source: "Jobicy",
      salaryMin: j.annualSalaryMin || null,
      salaryMax: j.annualSalaryMax || null,
      salaryCurrency: j.salaryCurrency || "USD",
      salaryPeriod: "year",
    })
  );
}

// --- Himalayas --------------------------------------------------------------
async function fetchHimalayas() {
  const data = await fetchJson("https://himalayas.app/jobs/api?limit=100");
  return (data.jobs || []).map((j) =>
    makeJob({
      id: `himalayas:${j.guid || j.title}`,
      title: j.title,
      company: j.companyName,
      location: (j.locationRestrictions || []).join(", ") || "Remote",
      workType: "remote",
      url: j.applicationLink || j.url,
      date: j.pubDate ? j.pubDate * 1000 : null,
      description: stripHtml(j.description || j.excerpt),
      tags: (j.categories || []).concat(j.seniority || []),
      source: "Himalayas",
      salaryMin: j.minSalary || null, // Himalayas gives USD annual when present
      salaryMax: j.maxSalary || null,
      salaryCurrency: "USD",
      salaryPeriod: "year",
    })
  );
}

// --- Greenhouse (per-company boards) ----------------------------------------
async function fetchGreenhouse() {
  const all = [];
  await Promise.all(COMPANY_BOARDS.greenhouse.map(async (token) => {
    try {
      const data = await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
      );
      for (const j of data.jobs || []) {
        const locType = (j.metadata || []).find(
          (m) => /location type|remote/i.test(m.name || "")
        );
        const locName = (j.location && j.location.name) || "";
        all.push(
          makeJob({
            id: `greenhouse:${token}:${j.id}`,
            title: j.title,
            company: j.company_name || token,
            location: locName,
            workType: locType ? guessWorkType(locType.value) : guessWorkType(locName + " " + j.title),
            url: j.absolute_url,
            date: j.updated_at || j.first_published,
            description: decodeAndStrip(j.content),
            tags: (j.metadata || []).map((m) => m.value).filter((v) => typeof v === "string"),
            source: `${j.company_name || token} (Greenhouse)`,
          })
        );
      }
    } catch { /* one company failing must not break the rest */ }
  }));
  return all;
}

// --- Lever (per-company boards) ---------------------------------------------
async function fetchLever() {
  const all = [];
  await Promise.all(COMPANY_BOARDS.lever.map(async (token) => {
    try {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${token}?mode=json`);
      for (const j of Array.isArray(data) ? data : []) {
        const cat = j.categories || {};
        const loc = cat.location || (cat.allLocations || []).join(", ");
        all.push(
          makeJob({
            id: `lever:${token}:${j.id}`,
            title: j.text,
            company: token,
            location: loc,
            workType: j.workplaceType
              ? guessWorkType(j.workplaceType)
              : guessWorkType(loc + " " + j.text),
            url: j.hostedUrl,
            date: j.createdAt || null,
            description: stripHtml(j.descriptionPlain || j.description),
            tags: [cat.team, cat.commitment].filter(Boolean),
            source: `${token} (Lever)`,
          })
        );
      }
    } catch { /* skip this company */ }
  }));
  return all;
}

// --- Ashby (per-company boards) ---------------------------------------------
async function fetchAshby() {
  const all = [];
  await Promise.all(COMPANY_BOARDS.ashby.map(async (token) => {
    try {
      const data = await fetchJson(
        `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`
      );
      for (const j of data.jobs || []) {
        all.push(
          makeJob({
            id: `ashby:${token}:${j.id}`,
            title: j.title,
            company: token,
            location: j.location || "",
            workType: j.isRemote ? "remote" : guessWorkType((j.workplaceType || "") + " " + j.location),
            url: j.jobUrl || j.applyUrl,
            date: j.publishedAt || null,
            description: stripHtml(j.descriptionHtml),
            tags: [j.department, j.team, j.employmentType].filter(Boolean),
            source: `${token} (Ashby)`,
          })
        );
      }
    } catch { /* skip this company */ }
  }));
  return all;
}

// --- Landing.jobs (Europe tech, remote-friendly, salary in EUR) -------------
async function fetchLandingJobs() {
  const data = await fetchJson("https://landing.jobs/api/v1/jobs");
  const list = Array.isArray(data) ? data : data.jobs || [];
  return list.map((j) =>
    makeJob({
      id: `landingjobs:${j.id}`,
      title: j.title,
      company: j.company_name || (j.company && j.company.name) || "Unknown",
      location: (j.locations || []).join(", ") || (j.remote ? "Remote" : ""),
      workType: j.remote ? "remote" : guessWorkType((j.locations || []).join(" ")),
      url: j.url,
      date: j.published_at || j.created_at,
      description: stripHtml([j.role_description, j.main_requirements].filter(Boolean).join(" ")),
      tags: (j.tags || []).map((t) => (typeof t === "string" ? t : t && t.name)).filter(Boolean),
      source: "Landing.jobs",
      salaryMin: j.gross_salary_low || null,
      salaryMax: j.gross_salary_high || null,
      salaryCurrency: j.currency_code || "EUR",
      salaryPeriod: "year",
    })
  );
}

// --- Cached snapshot written by GitHub Actions (data/jobs.json) -------------
// This is the fallback / India + on-site source (e.g. Adzuna via Actions).
async function fetchCached() {
  try {
    const data = await fetchJson(`data/jobs.json?t=${Date.now()}`, { timeout: 8000 });
    return (data.jobs || []).map((j) => makeJob({ ...j, source: j.source || "Cached" }));
  } catch {
    return [];
  }
}

// All live sources. Each is [name, fn].
const SOURCES = [
  ["Remotive", fetchRemotive],
  ["RemoteOK", fetchRemoteOK],
  ["Arbeitnow", fetchArbeitnow],
  ["Jobicy", fetchJobicy],
  ["Himalayas", fetchHimalayas],
  ["The Muse", fetchTheMuse],
  ["Landing.jobs", fetchLandingJobs],
  ["Greenhouse boards", fetchGreenhouse],
  ["Lever boards", fetchLever],
  ["Ashby boards", fetchAshby],
  ["Cached", fetchCached],
];

// --- Remote-from-India filter (mirrors scripts/fetch_jobs.py) ----------------
// Keep only jobs doable remotely from India: India-based, or remote and not
// locked to a foreign region. Drops "local presence required" foreign roles.
const REMOTE_HINTS = ["remote", "work from home", "wfh", "anywhere", "worldwide",
  "work remotely", "fully remote", "remote-first", "remote first", "distributed",
  "telecommute", "global", "work from anywhere"];
const INDIA_HINTS = ["india", "indian", "bengaluru", "bangalore", "mumbai",
  "new delhi", "delhi", "hyderabad", "pune", "chennai", "kolkata", "gurgaon",
  "gurugram", "noida", " ist", "ist)", "remote, india", "remote india"];
const FOREIGN_ONLY = ["us only", "u.s. only", "us-only", "united states only",
  "usa only", "must be based in the united states", "must reside in the united states",
  "must be located in the united states", "authorized to work in the united states",
  "us work authorization", "must be us-based", "based in the us only", "uk only",
  "united kingdom only", "must be based in the uk", "eu only", "europe only",
  "emea only", "within the eu", "canada only", "australia only",
  "must be based in canada", "remote (us", "remote, us", "remote - us", "us remote",
  "remote (united states", "remote, united states", "remote (uk", "remote, uk",
  "remote (canada", "onsite only", "on-site only", "in office", "in-office"];

function remoteFromIndiaOk(job) {
  const t = `${job.title} ${job.location} ${job.description}`.toLowerCase();
  if (INDIA_HINTS.some((h) => t.includes(h))) return true;
  if (!REMOTE_HINTS.some((h) => t.includes(h)) && job.workType !== "remote") return false;
  if (FOREIGN_ONLY.some((h) => t.includes(h))) return false;
  return true;
}

// Fetch everything in parallel. Returns { jobs, report } where report shows
// per-source success/failure so the UI can tell the user what loaded.
async function fetchAllJobs() {
  const results = await Promise.allSettled(SOURCES.map(([, fn]) => fn()));
  const jobs = [];
  const report = [];
  results.forEach((r, i) => {
    const name = SOURCES[i][0];
    if (r.status === "fulfilled") {
      const kept = r.value.filter(remoteFromIndiaOk);
      jobs.push(...kept);
      report.push({ name, ok: true, count: kept.length });
    } else {
      report.push({ name, ok: false, error: String(r.reason && r.reason.message || r.reason) });
    }
  });
  return { jobs: dedupe(jobs), report };
}

// Dedupe by URL, falling back to company+title.
function dedupe(jobs) {
  const seen = new Set();
  const out = [];
  for (const j of jobs) {
    const key = (j.url || `${j.company}|${j.title}`).toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

window.fetchAllJobs = fetchAllJobs;
window.guessWorkType = guessWorkType;
