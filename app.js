// --- config ---
const ADMIN_PASSCODE = "karsekhar-admin"; // change this before sharing the repo publicly
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
const LOCAL_KEY_NAME = "proofgive_gemini_key";

// --- state ---
let geminiApiKey = localStorage.getItem(LOCAL_KEY_NAME) || null;
const donations = [];      // { donor, campaign, amount }
const distributions = [];  // { batchLabel, beneficiaryCount, totalDistributed } — private notes never stored here
let lastReportText = null;

function setStatus(elId, msg, isError = false) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

// --- view switching ---
const publicViewBtn = document.getElementById("publicViewBtn");
const adminViewBtn = document.getElementById("adminViewBtn");
const publicView = document.getElementById("publicView");
const adminView = document.getElementById("adminView");

function showPublic() {
  publicView.classList.remove("hidden");
  adminView.classList.add("hidden");
  publicViewBtn.classList.add("active");
  adminViewBtn.classList.remove("active");
}

function showAdmin() {
  const entered = prompt("Admin passcode:");
  if (entered !== ADMIN_PASSCODE) {
    if (entered !== null) alert("Wrong passcode.");
    return;
  }
  publicView.classList.add("hidden");
  adminView.classList.remove("hidden");
  adminViewBtn.classList.add("active");
  publicViewBtn.classList.remove("active");
}

publicViewBtn.addEventListener("click", showPublic);
adminViewBtn.addEventListener("click", showAdmin);

// --- API key (localStorage only — never hardcoded, never committed to the repo) ---
const keyStatusMsg = document.getElementById("keyStatusMsg");

function refreshKeyStatus() {
  keyStatusMsg.textContent = geminiApiKey ? "Gemini key is set for this device." : "No key saved yet.";
}
refreshKeyStatus();

document.getElementById("saveKeyBtn").addEventListener("click", () => {
  const val = document.getElementById("apiKey").value.trim();
  if (!val) return setStatus("keyStatusMsg", "Paste a key first.", true);

  geminiApiKey = val;
  if (document.getElementById("rememberKey").checked) {
    localStorage.setItem(LOCAL_KEY_NAME, val);
  } else {
    localStorage.removeItem(LOCAL_KEY_NAME);
  }
  document.getElementById("apiKey").value = "";
  setStatus("keyStatusMsg", "Key saved for this device.");
});

document.getElementById("clearKeyBtn").addEventListener("click", () => {
  geminiApiKey = null;
  localStorage.removeItem(LOCAL_KEY_NAME);
  setStatus("keyStatusMsg", "Key cleared.");
});

// --- donations ---
document.getElementById("donateBtn").addEventListener("click", () => {
  const donor = document.getElementById("donorName").value.trim() || "Anonymous";
  const campaign = document.getElementById("campaign").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);

  if (!campaign) return setStatus("donateStatus", "Enter a campaign name.", true);
  if (!amount || amount <= 0) return setStatus("donateStatus", "Enter an amount greater than 0.", true);

  donations.push({ donor, campaign, amount });
  setStatus("donateStatus", `Logged PKR ${amount} from ${donor}.`);
  document.getElementById("campaign").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("donorName").value = "";
  renderLedger();
});

// --- distributions ---
document.getElementById("distributeBtn").addEventListener("click", () => {
  const batchLabel = document.getElementById("batchLabel").value.trim();
  const beneficiaryCount = parseInt(document.getElementById("beneficiaryCount").value, 10);
  const totalDistributed = parseFloat(document.getElementById("totalDistributed").value);
  const privateNotes = document.getElementById("privateNotes").value.trim(); // read only to confirm non-empty; never stored

  if (!batchLabel) return setStatus("distributeStatus", "Enter a batch label.", true);
  if (!beneficiaryCount || beneficiaryCount <= 0)
    return setStatus("distributeStatus", "Enter a beneficiary count.", true);
  if (!totalDistributed || totalDistributed < 0)
    return setStatus("distributeStatus", "Enter a total distributed amount.", true);

  distributions.push({ batchLabel, beneficiaryCount, totalDistributed });
  setStatus(
    "distributeStatus",
    privateNotes ? "Batch recorded. Private notes stayed on this device only." : "Batch recorded."
  );

  document.getElementById("batchLabel").value = "";
  document.getElementById("beneficiaryCount").value = "";
  document.getElementById("totalDistributed").value = "";
  document.getElementById("privateNotes").value = "";
  renderLedger();
});

// --- ledger rendering + the exact redacted payload sent to Gemini ---
function buildPublicSummary() {
  const totalReceived = donations.reduce((s, d) => s + d.amount, 0);
  const totalDistributedOut = distributions.reduce((s, d) => s + d.totalDistributed, 0);
  const beneficiaryTotal = distributions.reduce((s, d) => s + d.beneficiaryCount, 0);

  return {
    totalReceived,
    totalDistributedOut,
    beneficiaryTotal,
    donations: donations.map((d) => ({ donor: d.donor, campaign: d.campaign, amount: d.amount })),
    distributionBatches: distributions.map((d) => ({
      batchLabel: d.batchLabel,
      beneficiaryCount: d.beneficiaryCount,
      totalDistributed: d.totalDistributed,
    })),
  };
}

function renderLedger() {
  const summary = buildPublicSummary();
  document.getElementById("totalReceived").textContent = `PKR ${summary.totalReceived.toLocaleString()}`;
  document.getElementById("totalDistributedOut").textContent = `PKR ${summary.totalDistributedOut.toLocaleString()}`;
  document.getElementById("beneficiaryTotal").textContent = summary.beneficiaryTotal;

  const rows = [
    ...summary.donations.map((d) => ({
      type: "Donation",
      detail: `${d.donor} → ${d.campaign}`,
      amount: `PKR ${d.amount.toLocaleString()}`,
    })),
    ...summary.distributionBatches.map((d) => ({
      type: "Distribution",
      detail: `${d.batchLabel} · ${d.beneficiaryCount} beneficiaries`,
      amount: `PKR ${d.totalDistributed.toLocaleString()}`,
    })),
  ];

  const tbody = document.getElementById("ledgerBody");
  tbody.innerHTML = rows.length
    ? rows.map((r) => `<tr><td>${r.type}</td><td>${r.detail}</td><td>${r.amount}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty-row">Nothing logged yet.</td></tr>`;
}

// --- Gemini calls ---
async function callGemini(prompt) {
  if (!geminiApiKey) throw new Error("No Gemini key saved yet — set one in Admin.");
  const res = await fetch(GEMINI_URL(geminiApiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(no response)";
}

document.getElementById("generateReportBtn").addEventListener("click", async () => {
  if (!geminiApiKey) return setStatus("reportStatus", "Save your Gemini key above first.", true);
  if (!donations.length && !distributions.length)
    return setStatus("reportStatus", "Log at least one donation or distribution first.", true);

  setStatus("reportStatus", "Generating…");
  document.getElementById("generateReportBtn").disabled = true;

  try {
    const summary = buildPublicSummary();
    const prompt = `You are writing a short, warm, plain-language public transparency report for donors of an NGO called Kar Se Khar. Use ONLY the JSON data below — do not invent names, people, or details not present in it. Keep it under 150 words, no markdown headers, just a couple of short paragraphs.

Data:
${JSON.stringify(summary, null, 2)}`;

    lastReportText = await callGemini(prompt);
    document.getElementById("reportOutput").textContent = lastReportText;
    setStatus("reportStatus", "Report generated ✓ — donors can now see it on the Donor view.");
  } catch (err) {
    console.error(err);
    setStatus("reportStatus", err.message || "Something went wrong.", true);
  } finally {
    document.getElementById("generateReportBtn").disabled = false;
  }
});

document.getElementById("qaBtn").addEventListener("click", async () => {
  const question = document.getElementById("qaInput").value.trim();
  if (!geminiApiKey) return setStatus("qaStatus", "The Gemini key hasn't been set up by the team yet.", true);
  if (!question) return setStatus("qaStatus", "Type a question first.", true);

  setStatus("qaStatus", "Thinking…");
  document.getElementById("qaBtn").disabled = true;

  try {
    const summary = buildPublicSummary();
    const prompt = `You are a transparency assistant for an NGO called Kar Se Khar. Answer the donor's question using ONLY the JSON ledger data below. If the answer isn't in the data (for example, anything about specific beneficiaries' names or individual amounts), say plainly that this information isn't published to protect beneficiary privacy. Keep the answer short and direct.

Ledger data:
${JSON.stringify(summary, null, 2)}

Donor question: ${question}`;

    const text = await callGemini(prompt);
    document.getElementById("qaOutput").textContent = text;
    setStatus("qaStatus", "");
  } catch (err) {
    console.error(err);
    setStatus("qaStatus", err.message || "Something went wrong.", true);
  } finally {
    document.getElementById("qaBtn").disabled = false;
  }
});

renderLedger();
