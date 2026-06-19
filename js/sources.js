// ===========================================================================
// sources.js  —  Fetchers for free, CORS-friendly job APIs.
// Each fetcher returns a Promise<Job[]> in a NORMALISED shape (see normalise()).
// All are wrapped so one failing source never breaks the others.
// ===========================================================================

// Normalised job shape used everywhere downstream.
function makeJob({ id, title, company, location, workType, url, date, description, tags, source }) {
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
      })
    );
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
  ["Cached", fetchCached],
];

// Fetch everything in parallel. Returns { jobs, report } where report shows
// per-source success/failure so the UI can tell the user what loaded.
async function fetchAllJobs() {
  const results = await Promise.allSettled(SOURCES.map(([, fn]) => fn()));
  const jobs = [];
  const report = [];
  results.forEach((r, i) => {
    const name = SOURCES[i][0];
    if (r.status === "fulfilled") {
      jobs.push(...r.value);
      report.push({ name, ok: true, count: r.value.length });
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
