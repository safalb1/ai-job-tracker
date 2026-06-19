// ===========================================================================
// profile.js  —  Safal's CV, distilled into a machine-matchable profile.
// Edit this file to change what jobs get matched, or to update your details.
// ===========================================================================

const PROFILE = {
  name: "Safal S. Bhalerao",
  title: "Analyst - AI/LLM Practice & Data Annotator",
  email: "safbhalerao@gmail.com",
  phone: "+91 9130771065",
  location: "Bhandara, Maharashtra, India",
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
    // Core role titles (high weight)
    { term: "ai trainer", weight: 10 },
    { term: "llm trainer", weight: 10 },
    { term: "ai/llm", weight: 10 },
    { term: "data annotation", weight: 9 },
    { term: "data annotator", weight: 9 },
    { term: "annotator", weight: 8 },
    { term: "annotation", weight: 7 },
    { term: "rlhf", weight: 9 },
    { term: "ai analyst", weight: 9 },
    { term: "ai/llm practice", weight: 10 },
    { term: "ai quality", weight: 9 },
    { term: "quality analyst", weight: 8 },
    { term: "ai qa", weight: 9 },
    { term: "llm evaluation", weight: 9 },
    { term: "model evaluation", weight: 8 },
    { term: "prompt engineer", weight: 8 },
    { term: "prompt writing", weight: 8 },
    { term: "prompt", weight: 5 },
    { term: "generalist", weight: 6 },
    { term: "ai tutor", weight: 8 },
    { term: "ai content", weight: 6 },

    // Skills / adjacent (medium weight)
    { term: "data labeling", weight: 7 },
    { term: "data labelling", weight: 7 },
    { term: "labeling", weight: 5 },
    { term: "image annotation", weight: 7 },
    { term: "computer vision", weight: 6 },
    { term: "quality assurance", weight: 5 },
    { term: "qa analyst", weight: 6 },
    { term: "human in the loop", weight: 7 },
    { term: "human-in-the-loop", weight: 7 },
    { term: "model output", weight: 7 },
    { term: "training data", weight: 6 },
    { term: "fine-tuning", weight: 5 },
    { term: "fine tuning", weight: 5 },
    { term: "reinforcement learning from human feedback", weight: 9 },
    { term: "supervised fine-tuning", weight: 7 },
    { term: "evaluation", weight: 3 },
    { term: "machine learning", weight: 3 },
    { term: "natural language", weight: 4 },
    { term: "nlp", weight: 4 },
    { term: "json", weight: 2 },
    { term: "linux", weight: 2 },
    { term: "ubuntu", weight: 2 },
    { term: "dataset", weight: 3 },
    { term: "content moderation", weight: 4 },
    { term: "search quality", weight: 5 },
    { term: "search evaluator", weight: 6 },
    { term: "ai rater", weight: 7 },
    { term: "data rater", weight: 7 },
    { term: "conversation design", weight: 5 },
    { term: "red team", weight: 5 },
    { term: "ai safety", weight: 5 },
  ],

  // Negative keywords — if a title contains these it's almost certainly not
  // for you (senior engineering, sales, etc). Used to down-rank, not exclude.
  negativeTitleKeywords: [
    "senior software engineer", "staff engineer", "principal engineer",
    "sales", "account executive", "recruiter", "devops", "kubernetes",
    "frontend developer", "backend developer", "full stack", "ios developer",
    "android developer", "solidity", "blockchain", "accountant",
  ],
};

// expose globally for the browser
window.PROFILE = PROFILE;
