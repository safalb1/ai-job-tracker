// ==UserScript==
// @name         Job Match — ATS Auto-Fill
// @namespace    https://github.com/safalb1/ai-job-tracker
// @version      1.0.0
// @description  One-click fill of Greenhouse / Lever / Ashby / Workable application forms from your profile. You review and submit — nothing is sent automatically.
// @author       Safal Bhalerao
// @match        https://boards.greenhouse.io/*
// @match        https://job-boards.greenhouse.io/*
// @match        https://*.greenhouse.io/*
// @match        https://jobs.lever.co/*
// @match        https://jobs.ashbyhq.com/*
// @match        https://apply.workable.com/*
// @match        https://safalb1.github.io/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  "use strict";

  // =========================================================================
  // YOUR PROFILE — edit these in your installed userscript (Tampermonkey →
  // this script → Edit). phone/linkedin are intentionally BLANK in the public
  // repo copy; fill them in your local install. Nothing here is ever uploaded.
  // =========================================================================
  const ME = {
    firstName: "Safal",
    lastName: "Bhalerao",
    fullName: "Safal S. Bhalerao",
    email: "safbhalerao@gmail.com",
    phone: "",                 // <-- add your number locally
    linkedin: "",              // <-- add your LinkedIn URL locally
    github: "",
    portfolio: "https://datascienceportfol.io/safalb",
    website: "https://datascienceportfol.io/safalb",
    location: "India",
    city: "",
    state: "",
    country: "India",

    // Common screening questions — tune these to your situation.
    workAuthorized: "Yes",
    requireSponsorship: "No",
    willRelocate: "Yes",
    openToRemote: "Yes",
    over18: "Yes",
    rightToWork: "Yes",
    yearsExperience: "2",
    highestEducation: "Master's Degree",
    degreeField: "Information Technology",
    noticePeriod: "30 days",
    startDate: "Within 30 days",
    currentCompany: "Innodata India Pvt Ltd",
    currentTitle: "Analyst - AI/LLM Practice",
    expectedSalary: "",          // leave blank to skip, or set e.g. "As per industry standard"
    salaryCurrency: "INR",
    howHeard: "Company website",
    workedHereBefore: "No",
    pronouns: "",                // optional

    // EEO / demographic — usually optional. Default to declining.
    gender: "Decline To Self Identify",
    hispanicLatino: "No",
    race: "Decline To Self Identify",
    veteran: "I am not a protected veteran",
    disability: "I do not wish to answer",
  };

  // A short, reusable cover letter. {ROLE} / {COMPANY} are filled from the page.
  function coverLetter(role, company) {
    return (
      `Dear Hiring Team${company ? " at " + company : ""},\n\n` +
      `I am excited to apply${role ? " for the " + role + " role" : ""}. I am an ` +
      `AI/LLM analyst and data annotator with hands-on experience evaluating model ` +
      `outputs, designing prompts, and running quality assurance on training data ` +
      `(currently at Innodata, previously on NVIDIA's annotation programme via ` +
      `Randstad). I work fluently with annotation tooling, RLHF-style evaluation, ` +
      `and computer-vision labelling, and I am comfortable working remotely across ` +
      `time zones.\n\n` +
      `I would welcome the chance to bring this experience to your team. My portfolio ` +
      `is at ${ME.portfolio}.\n\n` +
      `Best regards,\n${ME.fullName}`
    );
  }

  // =========================================================================
  // Matching rules. Each rule: regexes to test against a field's "signature"
  // (its label + name + id + placeholder + aria-label), and the value to use.
  // First matching rule wins. Order matters — put specific before generic.
  // =========================================================================
  const RULES = [
    [/first\s*name|given name|forename/, ME.firstName],
    [/last\s*name|surname|family name/, ME.lastName],
    [/full\s*name|^name$|your name|legal name|applicant name/, ME.fullName],
    [/preferred name/, ME.firstName],
    [/e-?mail/, ME.email],
    [/phone|mobile|contact number|telephone/, ME.phone],
    [/linkedin/, ME.linkedin],
    [/github/, ME.github],
    [/portfolio|personal site|website|url|web address/, ME.portfolio],
    [/current company|present employer|employer/, ME.currentCompany],
    [/current title|current role|job title|present position/, ME.currentTitle],
    [/years.*(experience)|experience.*years|how many years/, ME.yearsExperience],
    [/highest.*(education|degree)|education level|level of education/, ME.highestEducation],
    [/(field|area).*(study|degree)|major|degree.*(field|in)/, ME.degreeField],
    [/notice period/, ME.noticePeriod],
    [/availability to start|when can you start|start date|earliest.*start/, ME.startDate],
    [/expected.*currency|salary currency|currency/, ME.salaryCurrency],
    [/expected (salary|compensation|ctc)|salary expectation|desired salary|compensation expectation/, ME.expectedSalary],
    [/how did you hear|referral source|^source$|where.*hear/, ME.howHeard],
    [/worked (here|for|at).*(before|previously)|previous(ly)? (employed|worked)|former employee/, ME.workedHereBefore],
    [/pronoun/, ME.pronouns],
    [/city/, ME.city],
    [/state|province|region/, ME.state],
    [/country/, ME.country],
    [/location|where are you based|current location/, ME.location],
    [/(18|eighteen).*(or older|years|age)|are you.*18|of legal age/, ME.over18],
    [/(authori[sz]ed|eligible|legally).*(work|employ)|work authori[sz]ation/, ME.workAuthorized],
    [/right to work|legally.*(reside|stay)/, ME.rightToWork],
    [/require.*(sponsor|visa)|need.*sponsor|sponsorship|visa support/, ME.requireSponsorship],
    [/open to remote|remote work|work remotely|comfortable.*remote/, ME.openToRemote],
    [/relocat/, ME.willRelocate],
    [/hispanic|latino/, ME.hispanicLatino],
    [/gender/, ME.gender],
    [/race|ethnic/, ME.race],
    [/veteran/, ME.veteran],
    [/disab/, ME.disability],
  ];

  // ---- DOM helpers --------------------------------------------------------

  // React-compatible value setter (plain el.value = x doesn't notify React).
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // Build a lowercase "signature" string describing a field, for rule matching.
  function signature(el) {
    const parts = [
      el.name, el.id, el.getAttribute("aria-label"),
      el.getAttribute("placeholder"), el.getAttribute("autocomplete"),
      el.getAttribute("data-qa"),
    ];
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) parts.push(lab.textContent);
    }
    const wrapLabel = el.closest("label");
    if (wrapLabel) parts.push(wrapLabel.textContent);
    // Ashby / new Greenhouse render label as a sibling/ancestor text node.
    let node = el.closest("div, fieldset, li");
    for (let i = 0; node && i < 3; i++) {
      const lab = node.querySelector("label, legend, .label, [class*='label']");
      if (lab) { parts.push(lab.textContent); break; }
      node = node.parentElement;
    }
    return parts.filter(Boolean).join(" • ").toLowerCase().replace(/\s+/g, " ");
  }

  function fillTextField(el, value) {
    if (value == null || value === "") return false;
    if (el.value && el.value.trim()) return false; // don't clobber existing input
    setNativeValue(el, value);
    return true;
  }

  function fillSelect(el, value) {
    if (!value) return false;
    const want = value.toLowerCase();
    const opts = Array.from(el.options || []);
    let opt = opts.find((o) => o.textContent.trim().toLowerCase() === want)
      || opts.find((o) => o.textContent.trim().toLowerCase().includes(want))
      || opts.find((o) => want.includes(o.textContent.trim().toLowerCase()) && o.textContent.trim());
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function pageRole() {
    const h = document.querySelector("h1, h2, [class*='posting-headline'], [class*='job-title']");
    return h ? h.textContent.trim().slice(0, 120) : "";
  }
  function pageCompany() {
    const m = location.pathname.match(/\/(?:boards\/)?([a-z0-9-]+)/i);
    return m ? m[1].replace(/-/g, " ") : "";
  }

  // ---- Main fill routine --------------------------------------------------
  function autofill() {
    let filled = 0;
    const skippedFiles = [];

    document.querySelectorAll("input, textarea, select").forEach((el) => {
      const type = (el.type || "").toLowerCase();
      if (el.disabled || el.readOnly) return;
      if (["hidden", "submit", "button", "search", "password"].includes(type)) return;
      if (el.offsetParent === null && type !== "select-one") return; // not visible

      if (type === "file") { skippedFiles.push(el); return; }

      const sig = signature(el);
      if (!sig) return;

      // Cover-letter / free-text boxes get the letter.
      if (el.tagName === "TEXTAREA" &&
          /cover letter|additional info|why .*(you|interest)|message|anything else|tell us|comments|note/.test(sig)) {
        if (fillTextField(el, coverLetter(pageRole(), pageCompany()))) filled++;
        return;
      }

      const rule = RULES.find(([re]) => re.test(sig));
      if (!rule) return;
      const value = rule[1];

      if (el.tagName === "SELECT") {
        if (fillSelect(el, value)) filled++;
      } else if (type === "radio" || type === "checkbox") {
        // For yes/no radios, click the one whose own label matches the value.
        const own = signature(el);
        if (value && own.includes(value.toLowerCase())) { el.click(); filled++; }
      } else {
        if (fillTextField(el, value)) filled++;
      }
    });

    // Highlight resume/file uploads — these can't be auto-set by a script.
    skippedFiles.forEach((el) => {
      const box = el.closest("div, label") || el;
      box.style.outline = "2px dashed #f5a623";
      box.style.outlineOffset = "2px";
    });

    notify(filled, skippedFiles.length);
  }

  // ---- UI -----------------------------------------------------------------
  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "76px", right: "20px", maxWidth: "320px",
      background: "#1f2937", color: "#fff", padding: "12px 14px",
      borderRadius: "10px", font: "13px/1.4 system-ui, sans-serif",
      boxShadow: "0 6px 24px rgba(0,0,0,.35)", zIndex: 2147483647,
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 7000);
  }

  function notify(filled, files) {
    let msg = `Filled ${filled} field${filled === 1 ? "" : "s"}.`;
    if (files) msg += ` ⚠ Attach your résumé manually (${files} upload field${files === 1 ? "" : "s"} highlighted).`;
    msg += " Review everything, then submit.";
    toast(msg);
  }

  // ---- Application log (saved in this browser, exportable) ----------------
  // Stored in the userscript's cross-domain store (GM_*) so the SAME log is
  // visible on the ATS pages where it's written AND on the status dashboard.
  // Falls back to localStorage if GM storage isn't available.
  const LOG_KEY = "jm_applications";
  const hasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const getLog = () => {
    try {
      const raw = hasGM ? GM_getValue(LOG_KEY, "[]") : localStorage.getItem(LOG_KEY);
      return JSON.parse(raw || "[]") || [];
    } catch { return []; }
  };
  const saveLog = (a) => {
    const raw = JSON.stringify(a);
    if (hasGM) GM_setValue(LOG_KEY, raw);
    try { localStorage.setItem(LOG_KEY, raw); } catch {}
  };

  // On the status dashboard, fill the "Your applications" cards from the log.
  function renderDashboardStats() {
    const host = document.getElementById("jm-app-stats");
    if (!host) return false;
    const log = getLog();
    const weekAgo = Date.now() - 7 * 86400000;
    const week = log.filter((e) => new Date(e.at).getTime() >= weekAgo).length;
    const today = log.filter((e) => new Date(e.at).toDateString() === new Date().toDateString()).length;
    host.innerHTML =
      `<div class="card"><div class="n">${log.length}</div><div class="l">applications logged (total)</div></div>
       <div class="card"><div class="n">${week}</div><div class="l">applied in last 7 days</div></div>
       <div class="card"><div class="n">${today}</div><div class="l">applied today</div></div>`;
    return true;
  }

  function logApplication() {
    const url = location.href.split("?")[0];
    const log = getLog();
    if (log.some((e) => e.url === url)) return; // already recorded this page
    log.unshift({ role: pageRole(), company: pageCompany(), url, at: new Date().toISOString() });
    saveLog(log);
    updatePill();
    toast(`✓ Logged: ${pageRole() || "application"} — saved to your local log (${log.length} total).`);
  }

  // Detect a real submit (native form submit OR a click on a submit/apply button).
  function installSubmitWatch() {
    if (window.__jmSubmitWatch) return;
    window.__jmSubmitWatch = true;
    document.addEventListener("submit", () => setTimeout(logApplication, 200), true);
    document.addEventListener("click", (e) => {
      const el = e.target.closest("button, input[type=submit], a[role=button], a");
      if (!el) return;
      const t = (el.textContent || el.value || "").trim().toLowerCase();
      if (/submit application|submit your application|^submit$|send application|^apply now$/.test(t)) {
        setTimeout(logApplication, 400);
      }
    }, true);
  }

  function updatePill() {
    const pill = document.getElementById("jm-applied-pill");
    if (pill) pill.textContent = `📋 ${getLog().length}`;
  }

  function showLogPanel() {
    document.getElementById("jm-log-panel")?.remove();
    const log = getLog();
    const panel = document.createElement("div");
    panel.id = "jm-log-panel";
    Object.assign(panel.style, {
      position: "fixed", bottom: "70px", right: "20px", width: "380px",
      maxHeight: "60vh", overflow: "auto", background: "#0f172a", color: "#e5e9f0",
      border: "1px solid #243154", borderRadius: "12px", padding: "14px",
      font: "13px/1.45 system-ui, sans-serif", zIndex: 2147483647,
      boxShadow: "0 10px 40px rgba(0,0,0,.5)",
    });
    const rows = log.length
      ? log.map((e) => {
          const d = new Date(e.at).toLocaleString();
          return `<div style="padding:8px 0;border-bottom:1px solid #1e2942;">
            <div style="font-weight:600;">${e.role || "Application"}${e.company ? " — " + e.company : ""}</div>
            <div style="color:#8b95ad;font-size:11px;">${d}</div>
            <a href="${e.url}" target="_blank" style="color:#6ea8ff;font-size:11px;">${e.url}</a></div>`;
        }).join("")
      : `<div style="color:#8b95ad;">No applications logged yet. They'll appear here automatically when you submit one.</div>`;
    panel.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b>Applications logged (${log.length})</b>
        <span style="cursor:pointer;color:#8b95ad;" id="jm-log-x">✕</span></div>${rows}
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="jm-log-csv" style="flex:1;padding:8px;border:none;border-radius:8px;cursor:pointer;background:#2563eb;color:#fff;font-weight:600;">Export CSV</button>
        <button id="jm-log-clear" style="padding:8px 12px;border:1px solid #3a2530;border-radius:8px;cursor:pointer;background:#1a1014;color:#f7b9bd;">Clear</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector("#jm-log-x").onclick = () => panel.remove();
    panel.querySelector("#jm-log-csv").onclick = () => exportCsv();
    panel.querySelector("#jm-log-clear").onclick = () => {
      if (confirm("Clear your local application log?")) { saveLog([]); updatePill(); showLogPanel(); }
    };
  }

  function exportCsv() {
    const log = getLog();
    const rows = [["Date", "Role", "Company", "URL"]].concat(
      log.map((e) => [new Date(e.at).toISOString(), e.role, e.company, e.url])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "job-applications.csv";
    a.click();
  }

  function mountPill() {
    if (document.getElementById("jm-applied-pill")) return;
    const pill = document.createElement("button");
    pill.id = "jm-applied-pill";
    pill.textContent = `📋 ${getLog().length}`;
    pill.title = "Applications you've logged (click to view / export)";
    Object.assign(pill.style, {
      position: "fixed", bottom: "20px", right: "120px", zIndex: 2147483647,
      background: "#0f766e", color: "#fff", border: "none", cursor: "pointer",
      padding: "12px 14px", borderRadius: "999px", fontWeight: "600",
      font: "14px system-ui, sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.35)",
    });
    pill.addEventListener("click", showLogPanel);
    document.body.appendChild(pill);
  }

  function mountButton() {
    if (document.getElementById("jm-autofill-btn")) return;
    const btn = document.createElement("button");
    btn.id = "jm-autofill-btn";
    btn.textContent = "⚡ Autofill";
    btn.title = "Job Match — fill this application from your profile";
    Object.assign(btn.style, {
      position: "fixed", bottom: "20px", right: "20px", zIndex: 2147483647,
      background: "#2563eb", color: "#fff", border: "none", cursor: "pointer",
      padding: "12px 18px", borderRadius: "999px", fontWeight: "600",
      font: "14px system-ui, sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.35)",
    });
    btn.addEventListener("click", autofill);
    document.body.appendChild(btn);
  }

  function mountAll() {
    // On the status dashboard there's no form to fill — just populate the stats.
    if (renderDashboardStats()) return;
    mountButton();
    mountPill();
  }

  mountAll();
  if (!document.getElementById("jm-app-stats")) installSubmitWatch();
  // ATS forms / dashboard render late or on route changes — keep things alive.
  new MutationObserver(mountAll).observe(document.documentElement, {
    childList: true, subtree: true,
  });
})();
