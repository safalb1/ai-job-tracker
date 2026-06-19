// ===========================================================================
// app.js  —  Orchestration: fetch -> match -> render -> filter -> cover letter.
// ===========================================================================

const state = {
  allMatches: [], // matched jobs (full set, before UI filters)
  filtered: [],
  loadedAt: null,
};

const els = {
  results: document.getElementById("results"),
  search: document.getElementById("search"),
  workType: document.getElementById("workType"),
  sort: document.getElementById("sort"),
  indiaOnly: document.getElementById("indiaOnly"),
  refresh: document.getElementById("refreshBtn"),
  lastUpdated: document.getElementById("lastUpdated"),
  sourceReport: document.getElementById("sourceReport"),
  modal: document.getElementById("modal"),
  modalClose: document.getElementById("modalClose"),
  coverText: document.getElementById("coverText"),
  copyCover: document.getElementById("copyCover"),
  applyLink: document.getElementById("applyLink"),
};

// ---- Load + match ----------------------------------------------------------
async function load() {
  els.results.innerHTML = `<div class="loading">Loading live jobs from multiple boards…</div>`;
  els.sourceReport.innerHTML = "";

  const { jobs, report } = await fetchAllJobs();
  renderSourceReport(report);

  state.allMatches = matchJobs(jobs, PROFILE);
  state.loadedAt = new Date();
  els.lastUpdated.textContent = `Updated ${state.loadedAt.toLocaleTimeString()} · ${state.allMatches.length} matches`;

  applyFilters();
}

// ---- Filters ---------------------------------------------------------------
function applyFilters() {
  const q = els.search.value.trim().toLowerCase();
  const wt = els.workType.value;
  const indiaOnly = els.indiaOnly.checked;

  let list = state.allMatches.filter((j) => {
    if (wt !== "all" && j.workType !== wt) {
      // 'unknown' work type: only show under "All"
      return false;
    }
    if (indiaOnly && !/india|bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|noida|gurgaon|kolkata|remote|anywhere/i.test(j.location)) {
      return false;
    }
    if (q) {
      const hay = `${j.title} ${j.company} ${j.description} ${j.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (els.sort.value === "newest") {
    list = [...list].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  state.filtered = list;
  render(list);
}

// ---- Render ----------------------------------------------------------------
function render(list) {
  if (!list.length) {
    els.results.innerHTML = `<div class="empty">No matching jobs for these filters. Try clearing the search or switching work type.</div>`;
    return;
  }

  els.results.innerHTML = list.map(cardHtml).join("");

  // Wire up per-card buttons.
  list.forEach((job) => {
    const el = document.getElementById(`cover-${cssId(job.id)}`);
    if (el) el.addEventListener("click", () => openCoverLetter(job));
  });
}

function cardHtml(job) {
  const score = Math.round(job.match.score);
  const scoreClass = score >= 18 ? "" : "mid";
  const dateStr = job.date ? timeAgo(job.date) : "—";
  const wt = job.workType;
  const wtLabel = wt === "unknown" ? "work type n/a" : wt;

  const matchedPills = job.match.matched
    .map((t) => `<span class="mt">${escapeHtml(t)}</span>`)
    .join("");

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(job.title)}</h3>
          <div class="company">${escapeHtml(job.company)}</div>
        </div>
        <span class="score ${scoreClass}" title="Match score">${score}</span>
      </div>
      <div class="meta">
        <span class="tag work-${wt}">${escapeHtml(wtLabel)}</span>
        ${job.location ? `<span class="tag">📍 ${escapeHtml(truncate(job.location, 30))}</span>` : ""}
        <span class="tag source">${escapeHtml(job.source)}</span>
        <span class="tag">🕒 ${dateStr}</span>
      </div>
      <div class="matched-terms">${matchedPills}</div>
      <div class="desc">${escapeHtml(truncate(job.description, 160))}</div>
      <div class="card-foot">
        <a class="btn primary" href="${escapeAttr(job.url)}" target="_blank" rel="noopener">Apply ↗</a>
        <button class="btn" id="cover-${cssId(job.id)}">Cover letter</button>
      </div>
    </article>`;
}

function renderSourceReport(report) {
  els.sourceReport.innerHTML = report
    .map((r) =>
      r.ok
        ? `<span class="src-pill ok" title="${r.count} jobs">✓ ${r.name} (${r.count})</span>`
        : `<span class="src-pill fail" title="${escapeAttr(r.error || "blocked")}">✕ ${r.name}</span>`
    )
    .join("");
}

// ---- Cover letter modal ----------------------------------------------------
function openCoverLetter(job) {
  els.coverText.value = generateCoverLetter(job, PROFILE);
  els.applyLink.href = job.url;
  els.modal.classList.remove("hidden");
}
function closeModal() { els.modal.classList.add("hidden"); }

// ---- Helpers ---------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function cssId(s) { return String(s).replace(/[^a-z0-9]/gi, "_"); }
function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function timeAgo(date) {
  const sec = (Date.now() - date.getTime()) / 1000;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ---- Events ----------------------------------------------------------------
els.refresh.addEventListener("click", load);
els.search.addEventListener("input", debounce(applyFilters, 200));
els.workType.addEventListener("change", applyFilters);
els.sort.addEventListener("change", applyFilters);
els.indiaOnly.addEventListener("change", applyFilters);
els.modalClose.addEventListener("click", closeModal);
els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });
els.copyCover.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.coverText.value);
  els.copyCover.textContent = "Copied ✓";
  setTimeout(() => (els.copyCover.textContent = "Copy to clipboard"), 1500);
});

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Go.
load();
