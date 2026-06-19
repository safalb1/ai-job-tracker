// ===========================================================================
// salary.js  —  Parse salaries from any currency/format and convert to INR.
// Used to filter (≥ ₹30k/mo floor) and to sort/display salaries.
//
// FX rates are APPROXIMATE (units of INR per 1 foreign unit). They don't need
// to be exact for a 30k floor — update occasionally if you want precision.
// ===========================================================================

const FX_TO_INR = {
  INR: 1, RS: 1,
  USD: 83, "$": 83,
  EUR: 90, "€": 90,
  GBP: 106, "£": 106,
  CAD: 61, AUD: 54, NZD: 50, SGD: 62, CHF: 93,
  AED: 22.6, ZAR: 4.5, BRL: 15, MXN: 4.5, PLN: 21,
  JPY: 0.55, SEK: 8, NOK: 7.8, DKK: 12,
};

// Map a currency symbol/word found in text to a code in FX_TO_INR.
const CURRENCY_HINTS = [
  [/₹|\brs\b|\binr\b|\brupees?\b/i, "INR"],
  [/\bus\$?\b|\busd\b/i, "USD"],
  [/€|\beur\b|\beuros?\b/i, "EUR"],
  [/£|\bgbp\b|\bpounds?\b/i, "GBP"],
  [/\bcad\b|\bc\$/i, "CAD"],
  [/\baud\b|\ba\$/i, "AUD"],
  [/\bsgd\b|\bs\$/i, "SGD"],
  [/\bchf\b/i, "CHF"],
  [/\baed\b/i, "AED"],
  [/\bzar\b/i, "ZAR"],
  [/\$(?!\s*c|\s*a|\s*s)/i, "USD"], // bare $ defaults to USD
];

function detectCurrency(text) {
  for (const [re, code] of CURRENCY_HINTS) if (re.test(text)) return code;
  return null;
}

// Turn "120k", "1,20,000", "85.000", "3" (as in 3 LPA) into a number.
function toNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  let mult = 1;
  if (/k$/.test(s)) { mult = 1000; s = s.replace(/k$/, ""); }
  // European thousands format e.g. "48.000" / "120.000" → treat dot as separator.
  if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(".", "");
  s = s.replace(/[, ]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n * mult;
}

// Convert {amount, currency, period} to monthly INR.
function toMonthlyInr(amount, currency, period) {
  if (amount == null) return null;
  const rate = FX_TO_INR[(currency || "INR").toUpperCase()] || FX_TO_INR[currency] || 1;
  let inr = amount * rate;
  if (period === "year") inr = inr / 12;
  else if (period === "hour") inr = inr * 160;       // ~160 working hrs/mo
  else if (period === "week") inr = inr * 4.33;
  else if (period === "day") inr = inr * 22;
  // 'month' → as-is
  return inr;
}

// Parse salary out of free text. Returns {minInr,maxInr,currency,period,source} or null.
function parseSalaryText(text) {
  if (!text) return null;
  const t = text.replace(/ /g, " ");

  // Indian "LPA" / "lakh per annum": e.g. "6 LPA", "₹6-9 LPA", "6 lakhs"
  const lpa = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)?\s*(\d+(?:\.\d+)?)?\s*(?:lpa|lakhs?\s*(?:per\s*annum|p\.?a\.?)?)/i);
  if (lpa) {
    const a = parseFloat(lpa[1]) * 100000;
    const b = lpa[2] ? parseFloat(lpa[2]) * 100000 : a;
    return { minInr: Math.min(a, b) / 12, maxInr: Math.max(a, b) / 12, currency: "INR", period: "year", source: "text:lpa" };
  }

  // Generic ranged amounts with optional currency + period.
  // matches: $100,000 - $130,000 | ₹40,000/month | 80k-120k USD per year | €45.000
  const re = /([₹$€£]|\b(?:usd|inr|eur|gbp|cad|aud|sgd|chf|rs)\b)?\s*(\d[\d.,]*\s*k?)\s*(?:-|to|–|—)\s*([₹$€£]|\b(?:usd|inr|eur|gbp|cad|aud|sgd|chf|rs)\b)?\s*(\d[\d.,]*\s*k?)/i;
  const m = t.match(re);
  if (m) {
    const cur = detectCurrency(`${m[1] || ""} ${m[3] || ""} ${t}`) || "USD";
    const lo = toNumber(m[2]);
    const hi = toNumber(m[4]);
    const period = detectPeriod(t);
    if (lo != null && hi != null) {
      return {
        minInr: toMonthlyInr(Math.min(lo, hi), cur, period),
        maxInr: toMonthlyInr(Math.max(lo, hi), cur, period),
        currency: cur, period, source: "text:range",
      };
    }
  }

  // Single amount: "$95,000", "₹45000 per month", "USD 120k"
  const single = t.match(/([₹$€£]|\b(?:usd|inr|eur|gbp|cad|aud|sgd|chf|rs)\b)\s*(\d[\d.,]*\s*k?)/i);
  if (single) {
    const cur = detectCurrency(`${single[1]} ${t}`) || "USD";
    const val = toNumber(single[2]);
    const period = detectPeriod(t);
    // Ignore tiny numbers (likely not a salary) — except hourly, where small
    // per-hour figures are normal (e.g. $25/hr).
    const minOk = period === "hour" ? val >= 5 : val >= 1000;
    if (val != null && minOk) {
      const inr = toMonthlyInr(val, cur, period);
      return { minInr: inr, maxInr: inr, currency: cur, period, source: "text:single" };
    }
  }
  return null;
}

function detectPeriod(t) {
  if (/per\s*hour|\/\s*hour|\bhourly\b|\/\s*hr|\bhr\b/i.test(t)) return "hour";
  if (/per\s*month|\/\s*month|\bmonthly\b|\/\s*mo\b|p\.?m\.?\b/i.test(t)) return "month";
  if (/per\s*week|\/\s*week|\bweekly\b/i.test(t)) return "week";
  if (/per\s*day|\bdaily\b/i.test(t)) return "day";
  return "year"; // most postings quote annual
}

// Get salary for a job: prefer structured fields, fall back to parsing text.
function getJobSalary(job) {
  // Structured fields (set by sources.js / fetch_jobs.py when available).
  if (job.salaryMin != null || job.salaryMax != null) {
    const cur = job.salaryCurrency || "USD";
    const period = job.salaryPeriod || "year";
    const lo = job.salaryMin != null ? toMonthlyInr(job.salaryMin, cur, period) : null;
    const hi = job.salaryMax != null ? toMonthlyInr(job.salaryMax, cur, period) : null;
    const min = lo != null ? lo : hi;
    const max = hi != null ? hi : lo;
    if (min != null) return finalizeSalary(min, max, "structured");
  }
  // Free-text fallback.
  const parsed = parseSalaryText(`${job.salaryText || ""} ${job.title} ${job.description}`);
  if (parsed && parsed.minInr != null) return finalizeSalary(parsed.minInr, parsed.maxInr, parsed.source);

  return { known: false, monthlyInr: null, display: "" };
}

function finalizeSalary(minInr, maxInr, src) {
  minInr = Math.round(minInr);
  maxInr = Math.round(maxInr || minInr);
  return {
    known: true,
    minInr, maxInr,
    monthlyInr: minInr, // use the floor for threshold comparisons
    display: minInr === maxInr ? `${fmtInr(minInr)}/mo` : `${fmtInr(minInr)}–${fmtInr(maxInr)}/mo`,
    source: src,
  };
}

function fmtInr(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  return `₹${Math.round(n / 1000)}k`;
}

window.getJobSalary = getJobSalary;
window.fmtInr = fmtInr;
