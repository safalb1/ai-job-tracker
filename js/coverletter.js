// ===========================================================================
// coverletter.js  —  Generates a tailored cover letter from PROFILE + a job.
// Pure string templating; no AI call needed, so it works offline & on Pages.
// ===========================================================================

function generateCoverLetter(job, profile) {
  const today = new Date().toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Pull the matched skills to name them explicitly in the letter.
  const matched = (job.match && job.match.matched) || [];
  const skillPhrase = matched.length
    ? matched.slice(0, 4).map(titleCase).join(", ")
    : "data annotation, AI/LLM evaluation and prompt design";

  return `${profile.name}
${profile.email} | ${profile.phone}
${profile.location}
${profile.portfolio}

${today}

Hiring Team
${job.company}

Dear Hiring Manager,

I am writing to apply for the ${job.title} role at ${job.company}. With direct, hands-on experience in ${skillPhrase}, I believe I am a strong fit for what this position requires.

In my current role as an Analyst on the AI/LLM Practice team at Innodata, I analyse and evaluate AI/LLM model outputs for quality, design prompts across multiple media types, and apply rigorous quality-assurance standards to training data. Previously, while deputed to NVIDIA Graphics through Randstad, I worked as a Data Annotator — creating and labelling objects with annotation tools and supporting computer-vision datasets. This combination of annotation precision and model-output evaluation maps closely to the responsibilities in your job description.

What I bring:
• Practical experience evaluating LLM/AI outputs for quality, accuracy and safety
• Strong data-annotation and labelling skills using industry annotation tools
• Prompt writing and design across text, image and other media
• A meticulous, detail-oriented approach with solid Linux and JSON fundamentals
• An MSc in I.T. and an ongoing Master's certification in Data Science & AI

I am eager to contribute to a data-driven, innovative team and to grow long-term with ${job.company}. I would welcome the chance to discuss how my background fits your needs.

Thank you for your time and consideration.

Sincerely,
${profile.name}`;
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

window.generateCoverLetter = generateCoverLetter;
