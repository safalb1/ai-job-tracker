// ===========================================================================
// matcher.js  —  Scores each job against PROFILE.
// A job MATCHES if it hits even one keyword (your requirement). Score and the
// list of matched terms drive ranking and the "why it matched" badges.
// ===========================================================================

function scoreJob(job, profile) {
  const haystack = `${job.title}\n${job.description}\n${job.tags.join(" ")}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  let score = 0;
  const matched = [];

  for (const { term, weight } of profile.keywords) {
    if (haystack.includes(term)) {
      // Title hits count double — a keyword in the title is a much stronger signal.
      const inTitle = titleLower.includes(term);
      score += inTitle ? weight * 2 : weight;
      matched.push({ term, weight, inTitle });
    }
  }

  // Down-rank obvious mismatches (senior eng, sales, etc.) but never exclude.
  let penalty = 0;
  for (const neg of profile.negativeTitleKeywords) {
    if (titleLower.includes(neg)) penalty += 8;
  }
  score = Math.max(0, score - penalty);

  // Freshness bonus: newer jobs rank a little higher.
  let freshnessBonus = 0;
  if (job.date) {
    const ageDays = (Date.now() - job.date.getTime()) / 86400000;
    if (ageDays <= 1) freshnessBonus = 6;
    else if (ageDays <= 3) freshnessBonus = 4;
    else if (ageDays <= 7) freshnessBonus = 2;
    else if (ageDays <= 14) freshnessBonus = 1;
  }

  // Keep only the strongest matched terms for display, de-duplicated.
  const topTerms = [...new Map(matched.map((m) => [m.term, m])).values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((m) => m.term);

  return {
    score: score + freshnessBonus,
    rawScore: score,
    matched: topTerms,
    isMatch: score > 0, // matched at least one keyword after penalty
  };
}

// Score a whole list, attach .match, keep only matches, sort by score desc.
function matchJobs(jobs, profile) {
  return jobs
    .map((j) => ({ ...j, match: scoreJob(j, profile) }))
    .filter((j) => j.match.isMatch)
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score;
      // tie-break on recency
      const da = a.date ? a.date.getTime() : 0;
      const db = b.date ? b.date.getTime() : 0;
      return db - da;
    });
}

window.matchJobs = matchJobs;
window.scoreJob = scoreJob;
