// This list has words we treat as toxic/harmful in this demo.
const harmfulWords = [
  "hate", "idiot", "loser", "ugly", "kill", "dumb", "stupid", "worthless", "trash", "attack"
];

// We keep a small wanted-person list with demo signatures for face matching simulation.
const wantedPersons = [
  "Daniel Carter", "Michael Reeves", "Jonathan Blake", "Aaron Mitchell", "Ryan Foster",
  "Kevin Turner", "Marcus Hill", "Ethan Brooks", "Samuel Reed", "Victor Hayes",
  "Nathan Cole", "Brandon Lewis", "Tyler Morgan", "Jason Walker", "Lucas Bennett",
  "Harry Potter", "Hermione Granger", "Ron Weasley", "Albus Dumbledore", "Severus Snape",
  "Draco Malfoy", "Sirius Black", "Minerva McGonagall", "Rubeus Hagrid", "Luna Lovegood",
  "Neville Longbottom", "Ginny Weasley", "Fred Weasley", "George Weasley", "Bellatrix Lestrange",
  "Percy Jackson", "Annabeth Chase", "Grover Underwood", "Luke Castellan", "Clarisse La Rue"
].map((name) => ({ name, signature: buildNameSignature(name) }));

// This object stores results so we can combine them into one final decision.
const state = {
  textScore: 0,
  videoTextScore: 0,
  bestFaceMatch: null
};

const tabs = document.querySelectorAll(".tab-btn");
const tabSections = document.querySelectorAll(".tab-content");
const themeToggle = document.getElementById("themeToggle");

const textInput = document.getElementById("textInput");
const textResult = document.getElementById("textResult");
const textToxicity = document.getElementById("textToxicity");

const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const imageResult = document.getElementById("imageResult");

const videoInput = document.getElementById("videoInput");
const videoPreview = document.getElementById("videoPreview");
const videoCaption = document.getElementById("videoCaption");
const videoTextResult = document.getElementById("videoTextResult");
const faceResult = document.getElementById("faceResult");
const decisionResult = document.getElementById("decisionResult");
const videoMetrics = document.getElementById("videoMetrics");

// Make each name always map to the same pseudo-random signature.
function buildNameSignature(name) {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + 31;
    h2 = Math.imul(h2, 2246822519);
  }
  return [((h1 >>> 0) % 1000) / 1000, ((h2 >>> 0) % 1000) / 1000, (((h1 ^ h2) >>> 0) % 1000) / 1000];
}

// Tabs let us keep text/image/video tools separated in a dashboard style.
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    tabs.forEach((btn) => btn.classList.remove("active"));
    tab.classList.add("active");
    tabSections.forEach((section) => section.classList.remove("active"));
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
}

// Switch between dark mode (default) and light mode.
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("light") ? "☀️ Light Mode" : "🌙 Dark Mode";
});

// Reusable helper for classifying text safety and toxicity percentage.
function analyzeTextContent(inputText) {
  const words = inputText.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const hits = words.filter((word) => harmfulWords.includes(word));
  const score = Math.min(100, Math.round((hits.length / Math.max(words.length, 1)) * 350 + (hits.length >= 2 ? 20 : 0)));

  let label = "Safe";
  let css = "safe";
  if (score >= 60) {
    label = "Harmful";
    css = "harmful";
  } else if (score >= 25) {
    label = "Warning";
    css = "warning";
  }

  return { words, hits, score, label, css };
}

// Show animated result card with one status class.
function showResult(el, text, cssClass) {
  el.classList.remove("neutral", "safe", "warning", "harmful", "show");
  el.classList.add(cssClass);
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add("show"));
}

// TEXT DETECTION
// 7th-grade note: This checks words and gives a simple score.
document.getElementById("analyzeTextBtn").addEventListener("click", () => {
  const result = analyzeTextContent(textInput.value);
  state.textScore = result.score;

  if (!textInput.value.trim()) {
    showResult(textResult, "Please type a message first.", "neutral");
    textToxicity.innerHTML = "";
    return;
  }

  showResult(
    textResult,
    `${result.label}: ${result.hits.length} harmful word match(es). Found: ${[...new Set(result.hits)].join(", ") || "none"}.`,
    result.css
  );
  textToxicity.innerHTML = `<span class="pill">Toxicity: ${result.score}%</span>`;
});

// IMAGE DETECTION
// We simulate image moderation by checking the file name for risky tags.
imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = "block";

  const riskyTags = ["weapon", "blood", "fight", "adult", "nsfw", "abuse", "violence"];
  const lower = file.name.toLowerCase();
  const detected = riskyTags.filter((tag) => lower.includes(tag));

  if (detected.length > 0) {
    showResult(imageResult, `Potentially Inappropriate Image (flagged tags: ${detected.join(", ")}).`, "warning");
  } else {
    showResult(imageResult, "Safe Image (no risky tags detected in demo).", "safe");
  }
});

// VIDEO FACE + CAPTION DETECTION
// 1) analyze caption with same text logic
// 2) simulate face detection from a video frame
// 3) compare face signature with wanted list and combine with threat text

document.getElementById("analyzeVideoBtn").addEventListener("click", () => {
  const captionResult = analyzeTextContent(videoCaption.value);
  state.videoTextScore = captionResult.score;

  if (!videoCaption.value.trim()) {
    showResult(videoTextResult, "No video caption/extracted text entered.", "neutral");
  } else {
    showResult(videoTextResult, `Caption ${captionResult.label} (${captionResult.score}% toxicity).`, captionResult.css);
  }

  if (!videoInput.files?.[0]) {
    showResult(faceResult, "Upload a video to simulate face detection.", "neutral");
    showResult(decisionResult, "No combined decision yet.", "neutral");
    return;
  }

  if (videoPreview.readyState < 2) {
    showResult(faceResult, "Video is loading. Play or seek and analyze again.", "neutral");
    return;
  }

  const videoSignature = getVideoSignature(videoPreview);
  const ranked = wantedPersons
    .map((person) => ({ name: person.name, similarity: similarityPercent(videoSignature, person.signature) }))
    .sort((a, b) => b.similarity - a.similarity);

  state.bestFaceMatch = ranked[0];
  const strongFaceMatch = state.bestFaceMatch.similarity >= 70;
  const violentSpeech = captionResult.score >= 60;

  showResult(
    faceResult,
    `Face detected. Best match: ${state.bestFaceMatch.name} (${state.bestFaceMatch.similarity}% similarity).`,
    strongFaceMatch ? "warning" : "safe"
  );

  if (violentSpeech && strongFaceMatch) {
    showResult(
      decisionResult,
      "🚨 ALERT: Harmful/violent speech + strong wanted-person face match detected. Send for immediate human review.",
      "harmful"
    );
  } else if (violentSpeech || strongFaceMatch) {
    showResult(decisionResult, "⚠️ Partial risk signal. Continue manual investigation.", "warning");
  } else {
    showResult(decisionResult, "✅ No high-risk combined condition detected in this demo.", "safe");
  }

  videoMetrics.innerHTML = [
    `<span class="pill">Caption toxicity: ${captionResult.score}%</span>`,
    `<span class="pill">Top face match: ${state.bestFaceMatch.similarity}%</span>`
  ].join("");
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  videoPreview.src = URL.createObjectURL(file);
  showResult(videoTextResult, `Loaded video: ${file.name}`, "neutral");
  showResult(faceResult, "Ready for face comparison when frame is visible.", "neutral");
  showResult(decisionResult, "Run analysis to generate decision.", "neutral");
});

// Draw a tiny snapshot from the video to create a simple color signature.
function getVideoSignature(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const total = r + g + b || 1;
  return [r / total, g / total, b / total];
}

// Convert distance between two signatures into similarity percent.
function similarityPercent(a, b) {
  const dist = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return Math.max(0, Math.round((1 - dist / Math.sqrt(3)) * 100));
}

// Put wanted names in the list at startup.
document.getElementById("wantedList").innerHTML = wantedPersons.map((p) => `<li>${p.name}</li>`).join("");
