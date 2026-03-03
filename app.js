const violentKeywords = [
  "kill", "attack", "shoot", "bomb", "explode", "stab", "murder", "burn", "threat", "assault"
];

const wantedPersons = [
  { name: "Alex Mercer", signature: [0.82, 0.46, 0.66] },
  { name: "Dani Voss", signature: [0.25, 0.74, 0.33] },
  { name: "R. Kade", signature: [0.58, 0.59, 0.18] }
];

const state = {
  hasVideo: false,
  speechThreatScore: 0,
  speechIsThreat: false,
  bestFaceMatch: null
};

const videoInput = document.getElementById("videoInput");
const videoPreview = document.getElementById("videoPreview");
const videoStatus = document.getElementById("videoStatus");
const transcriptInput = document.getElementById("transcriptInput");
const speechResult = document.getElementById("speechResult");
const faceResult = document.getElementById("faceResult");
const decisionBox = document.getElementById("decisionBox");
const metrics = document.getElementById("metrics");
const wantedDb = document.getElementById("wantedDb");

function renderWantedDb() {
  wantedDb.innerHTML = wantedPersons
    .map((person) => `<li>${person.name}</li>`)
    .join("");
}

function normalizeClass(el, statusClass) {
  el.classList.remove("neutral", "safe", "alert");
  el.classList.add(statusClass);
}

function analyzeSpeech() {
  const transcript = transcriptInput.value.toLowerCase();
  const words = transcript.split(/[^a-z]+/).filter(Boolean);
  const matches = words.filter((w) => violentKeywords.includes(w));

  const score = Math.min(100, Math.round((matches.length / Math.max(words.length, 1)) * 400));
  const severeMatchBoost = matches.length >= 2 ? 25 : 0;
  const finalScore = Math.min(100, score + severeMatchBoost);

  state.speechThreatScore = finalScore;
  state.speechIsThreat = finalScore >= 45;

  if (!transcript.trim()) {
    speechResult.textContent = "No transcript entered. Add speech text to analyze.";
    normalizeClass(speechResult, "neutral");
    state.speechThreatScore = 0;
    state.speechIsThreat = false;
  } else if (state.speechIsThreat) {
    speechResult.textContent = `Potential violent speech detected (score ${finalScore}%). Matched keywords: ${[...new Set(matches)].join(", ") || "none"}.`;
    normalizeClass(speechResult, "alert");
  } else {
    speechResult.textContent = `Low violent-speech likelihood (score ${finalScore}%).`;
    normalizeClass(speechResult, "safe");
  }

  updateDecision();
}

function getVideoSignature(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
  }

  const total = r + g + b || 1;
  return [r / total, g / total, b / total];
}

function similarityPercent(a, b) {
  const distance = Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
  const maxDistance = Math.sqrt(3);
  return Math.max(0, Math.round((1 - distance / maxDistance) * 100));
}

function analyzeFace() {
  if (!state.hasVideo) {
    faceResult.textContent = "Please upload a video first.";
    normalizeClass(faceResult, "neutral");
    return;
  }

  if (videoPreview.readyState < 2) {
    faceResult.textContent = "Video not ready yet. Play or seek the video and try again.";
    normalizeClass(faceResult, "neutral");
    return;
  }

  const videoSig = getVideoSignature(videoPreview);
  const ranked = wantedPersons
    .map((person) => ({
      name: person.name,
      similarity: similarityPercent(videoSig, person.signature)
    }))
    .sort((a, b) => b.similarity - a.similarity);

  state.bestFaceMatch = ranked[0];

  if (state.bestFaceMatch.similarity >= 70) {
    faceResult.textContent = `Face detected. Best match: ${state.bestFaceMatch.name} (${state.bestFaceMatch.similarity}% similarity).`;
    normalizeClass(faceResult, "alert");
  } else {
    faceResult.textContent = `Face detected, but no strong database match (top result: ${state.bestFaceMatch.name}, ${state.bestFaceMatch.similarity}%).`;
    normalizeClass(faceResult, "safe");
  }

  updateDecision();
}

function updateDecision() {
  const isMatch = state.bestFaceMatch && state.bestFaceMatch.similarity >= 70;
  const isThreat = state.speechIsThreat;

  if (isThreat && isMatch) {
    decisionBox.textContent = `🚨 ALERT: Violent speech indicators + wanted-person face match (${state.bestFaceMatch.name}, ${state.bestFaceMatch.similarity}%). Escalate for immediate human review.`;
    normalizeClass(decisionBox, "alert");
  } else if (isThreat || isMatch) {
    decisionBox.textContent = "⚠️ Partial risk signal detected. Continue investigation with human analyst verification.";
    normalizeClass(decisionBox, "neutral");
  } else {
    decisionBox.textContent = "✅ No combined high-risk condition found in this simulation.";
    normalizeClass(decisionBox, "safe");
  }

  const pills = [];
  pills.push(`<span class="metric-pill">Speech threat score: ${state.speechThreatScore}%</span>`);
  pills.push(`<span class="metric-pill">Face similarity: ${state.bestFaceMatch ? `${state.bestFaceMatch.similarity}% (${state.bestFaceMatch.name})` : "N/A"}</span>`);
  metrics.innerHTML = pills.join("");
}

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  videoPreview.src = url;
  videoStatus.textContent = `Loaded: ${file.name}`;
  state.hasVideo = true;
  state.bestFaceMatch = null;
  faceResult.textContent = "Video loaded. Click 'Detect & Compare Face' once the frame is visible.";
  normalizeClass(faceResult, "neutral");
  updateDecision();
});

document.getElementById("analyzeSpeechBtn").addEventListener("click", analyzeSpeech);
document.getElementById("analyzeFaceBtn").addEventListener("click", analyzeFace);

renderWantedDb();
updateDecision();
