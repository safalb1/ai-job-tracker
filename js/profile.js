// ===========================================================================
// profile.js  —  Safal's CV, distilled into a machine-matchable profile.
// Edit this file to change what jobs get matched, or to update your details.
// ===========================================================================

const PROFILE = {
  name: "Safal S. Bhalerao",
  title: "Analyst - AI/LLM Practice & Data Annotator",
  email: "safbhalerao@gmail.com",
  phone: "", // intentionally blank on the public site; add when applying privately
  location: "India",
  portfolio: "https://datascienceportfol.io/safalb",
  linkedin: "", // add your LinkedIn URL if you want it in cover letters

  // Minimum acceptable salary, in INR per MONTH (not per year). Salaries in any
  // currency are converted to a monthly INR figure before comparing (annual
  // figures are divided by 12). See salary.js. Jobs that STATE a salary below
  // this are hidden when the salary filter is on; jobs that don't state any
  // salary are kept (we can't verify them).
  minSalaryInrPerMonth: 30000,

  summary:
    "A working professional with expertise in data annotation, quality assurance, " +
    "and computer vision, with hands-on experience analysing and evaluating AI/LLM " +
    "model outputs for quality. Proficient in creating and labelling objects using " +
    "annotation tools and in designing prompts for various media types.",

  experience: [
    {
      role: "Analyst - AI/LLM Practice",
      company: "Innodata India Pvt Ltd",
      period: "Nov 2025 - Present",
    },
    {
      role: "Associate Process Executive (Data Annotator)",
      company: "Randstad India (deputed to NVIDIA Graphics Pvt Ltd)",
      period: "Aug 2024 - Nov 2025",
    },
  ],

  education: [
    { degree: "MSc (I.T.)", school: "Bharathiar University, Coimbatore", year: "2022" },
    { degree: "BSc (I.T.)", school: "RTM Nagpur University", year: "2020" },
    { degree: "Master's in Data Science & AI (certification)", school: "Intellipaat", year: "2023-Present" },
  ],

  // --- The heart of the matcher -------------------------------------------
  // Weighted keywords. Higher weight = stronger signal of a good-fit role.
  // A job is matched if it hits even ONE of these (per your requirement).
  keywords: [
    // Core target roles — AI trainer / specialist family (high weight)
    { term: "ai trainer", weight: 10 },
    { term: "ai trainer specialist", weight: 10 },
    { term: "ai training specialist", weight: 10 },
    { term: "llm trainer", weight: 10 },
    { term: "ai specialist", weight: 9 },
    { term: "ai tutor", weight: 9 },
    { term: "ai teacher", weight: 8 },
    { term: "ai coach", weight: 8 },
    { term: "model trainer", weight: 9 },
    { term: "generative ai trainer", weight: 10 },
    { term: "ai/llm", weight: 9 },
    { term: "ai/llm practice", weight: 10 },
    { term: "ai analyst", weight: 8 },
    { term: "ai quality", weight: 8 },
    { term: "ai quality specialist", weight: 9 },
    { term: "ai qa", weight: 8 },
    { term: "ai evaluator", weight: 9 },
    { term: "llm evaluation", weight: 9 },
    { term: "model evaluation", weight: 8 },
    { term: "rlhf", weight: 9 },
    { term: "reinforcement learning from human feedback", weight: 9 },
    { term: "prompt engineer", weight: 8 },
    { term: "prompt writing", weight: 7 },
    { term: "prompt", weight: 4 },
    { term: "ai content", weight: 6 },

    // Adjacent, trainer-flavoured (medium weight) — NOT annotation
    { term: "human feedback", weight: 7 },
    { term: "human in the loop", weight: 6 },
    { term: "human-in-the-loop", weight: 6 },
    { term: "model output", weight: 7 },
    { term: "fine-tuning", weight: 6 },
    { term: "fine tuning", weight: 6 },
    { term: "supervised fine-tuning", weight: 7 },
    { term: "large language model", weight: 6 },
    { term: "generative ai", weight: 5 },
    { term: "search evaluator", weight: 6 },
    { term: "search quality", weight: 5 },
    { term: "ai rater", weight: 6 },
    { term: "conversation design", weight: 5 },
    { term: "red team", weight: 5 },
    { term: "ai safety", weight: 5 },
    { term: "machine learning", weight: 3 },
    { term: "natural language", weight: 3 },
    { term: "nlp", weight: 3 },
  ],

  // Negative keywords — if a title contains these it's almost certainly not
  // for you. Annotation/labeling are here so any that slip through get
  // down-ranked (you asked to avoid annotation roles). Used to down-rank.
  negativeTitleKeywords: [
    "annotation", "annotator", "data labeling", "data labelling", "labeling",
    "labelling", "data entry", "content moderation", "transcription",
    "senior software engineer", "staff engineer", "principal engineer",
    "sales", "account executive", "recruiter", "devops", "kubernetes",
    "frontend developer", "backend developer", "full stack", "ios developer",
    "android developer", "solidity", "blockchain", "accountant",
  ],
};

// expose globally for the browser
window.PROFILE = PROFILE;
