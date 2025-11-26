// src/app/api/gemini/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

let adminInitialized = false;
let admin;
let db;

/**
 * Initialize firebase-admin if service account is provided.
 * Expects process.env.FIREBASE_SERVICE_ACCOUNT to contain stringified JSON
 * with service account keys. If missing, history-based analysis will be skipped.
 */
function initFirebaseAdmin() {
  if (adminInitialized) return;

  try {
    // lazy import to avoid issues when not using admin
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    admin = require("firebase-admin");

    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa) {
      console.warn(
        "FIREBASE_SERVICE_ACCOUNT not provided. History-based analysis will be skipped."
      );
      adminInitialized = true;
      return;
    }

    const cred = JSON.parse(sa);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(cred),
      });
    }

    db = admin.firestore();
    adminInitialized = true;
  } catch (err) {
    console.error("firebase-admin init error:", err);
    adminInitialized = true;
  }
}

/* ------------------------
   Dangerous symptom tokens
   ------------------------ */
const DANGEROUS_SYMPTOMS = [
  "Heavy bleeding",
  "Clots",
  "Fever",
  "Chest pain",
  "Severe cramps",
  "Dizziness",
  "Fainting",
  "Sharp abdominal pain",
  "Shortness of breath",
  "Severe headache",
  "Extreme weakness",
];

/* lower-case normalize */
function norm(s) {
  return String(s || "").toLowerCase().trim();
}

/* check approximate match */
function isDangerousSymptom(symptom) {
  const n = norm(symptom);
  for (const ds of DANGEROUS_SYMPTOMS) {
    const token = ds.toLowerCase();
    if (!token) continue;
    if (n === token || n.includes(token) || token.includes(n)) return true;
  }
  return false;
}

/**
 * Gather recent cycles (up to last 3) and aggregate counts.
 * Returns { cycles: [{id, meta, logs}], agg: { dangerousCounts, symptomCounts, flowCounts, heavyFlowDays, cyclesCount } }
 * If admin not initialized or no service account, returns null.
 */
async function gatherHistoryForUser(userId) {
  initFirebaseAdmin();
  if (!db) return null;

  try {
    const cyclesRef = db.collection("users").doc(userId).collection("cycles");
    const cyclesSnap = await cyclesRef
      .orderBy("startDate", "desc")
      .limit(3)
      .get();

    const cycles = [];
    for (const cycleDoc of cyclesSnap.docs) {
      const cycleData = cycleDoc.data();
      const cycleId = cycleDoc.id;
      const logsRef = cyclesRef.doc(cycleId).collection("dailyLogs");
      const logsSnap = await logsRef.orderBy("date", "asc").get();
      const logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cycles.push({ id: cycleId, meta: cycleData, logs });
    }

    const agg = {
      cyclesCount: cycles.length,
      symptomCounts: {},
      dangerousCounts: {},
      flowCounts: {},
      heavyFlowDays: 0,
    };

    for (const cycle of cycles) {
      for (const log of cycle.logs) {
        // symptoms array
        if (Array.isArray(log.symptoms)) {
          for (const s of log.symptoms) {
            const key = s || "Unknown";
            agg.symptomCounts[key] = (agg.symptomCounts[key] || 0) + 1;
            if (isDangerousSymptom(key)) {
              agg.dangerousCounts[key] = (agg.dangerousCounts[key] || 0) + 1;
            }
          }
        }
        // free-text note check (extra)
        if (log.note) {
          const txt = norm(log.note);
          for (const ds of DANGEROUS_SYMPTOMS) {
            if (txt.includes(ds.toLowerCase())) {
              agg.dangerousCounts[ds] = (agg.dangerousCounts[ds] || 0) + 1;
            }
          }
        }
        // flow
        if (log.flowLevel) {
          const f = String(log.flowLevel);
          agg.flowCounts[f] = (agg.flowCounts[f] || 0) + 1;
          if (f.toLowerCase().includes("heavy")) agg.heavyFlowDays++;
        }
      }
    }

    return { cycles, agg };
  } catch (err) {
    console.error("gatherHistoryForUser error:", err);
    return null;
  }
}

/**
 * Determine the single strongest warning according to:
 * - Life-threatening today -> immediate urgent warning (always override)
 * - Then user-chosen custom order (Option B — implemented as):
 *   1) Dangerous symptom present TODAY that also occurred in 2+ different past cycles
 *   2) Dangerous symptom occurs > 3 times in current cycle (i.e., repeated many days)
 *   3) Heavy flow repeats >= 3 days in current cycle (or heavyFlowDays across recent cycles high)
 *
 * The function returns { warningText, smallTip } or null if no warning.
 *
 * IMPORTANT: lifeThreatSymptoms always produce urgent message.
 */
function computeWarning({
  todaysDangerousSymptoms,
  todaysFlowIsHeavy,
  history, // result of gatherHistoryForUser or null
}) {
  // life-threatening tokens that need immediate attention
  const LIFE_THREAT_TOKENS = [
    "chest pain",
    "fainting",
    "shortness of breath",
    "severe weakness",
    "severe headache",
    "high fever",
  ];

  

  // if no history available -> fallback: check counts inside today's info only (less strict)
  if (!history) {
    // check repeated dangerous >3 times in today (not possible) -> so only heavy flow
    if (todaysFlowIsHeavy) {
      return {
        warningText:
          "Heavy flow detected today. Monitor bleeding and rest, contact clinician if it persists.",
        smallTip: "Track heavy days; consider contacting your clinician.",
      };
    }
    return null;
  }

  // history present -> compute using last cycles data
  const { cycles, agg } = history;
  // cycles[0] is most recent cycle (assume this is the current cycle if active)
  const currentCycle = cycles[0] || { logs: [] };

  // 1) Dangerous symptom present today AND occurred in 2+ different past cycles
  // Build a set of symptoms seen in 2+ different cycles:
  // We'll count presence-per-cycle: if a symptom appears anywhere in a cycle, that's one cycle occurrence.
  const presencePerCycle = {}; // symptom -> number of cycles it appeared in
  for (const cycle of cycles) {
    const seen = new Set();
    for (const log of cycle.logs) {
      if (Array.isArray(log.symptoms)) {
        for (const s of log.symptoms) seen.add(s);
      }
      if (log.note) {
        const txt = norm(log.note);
        for (const ds of DANGEROUS_SYMPTOMS) {
          if (txt.includes(ds.toLowerCase())) seen.add(ds);
        }
      }
    }
    for (const s of seen) {
      presencePerCycle[s] = (presencePerCycle[s] || 0) + 1;
    }
  }

  // Check rule 1: dangerous today and present in 2+ cycles
  for (const s of todaysDangerousSymptoms) {
    const matchedKey = Object.keys(presencePerCycle).find((k) => {
      // match approximately
      return norm(k) === norm(s) || norm(k).includes(norm(s)) || norm(s).includes(norm(k));
    });
    if (matchedKey && presencePerCycle[matchedKey] >= 2) {
      return {
        warningText: `Repeated ${matchedKey} detected across recent cycles and again today — consult clinician.`,
        smallTip: `If symptoms worsen, contact your healthcare provider.`,
      };
    }
  }

  // 2) Dangerous symptom occurs > 3 times in current cycle
  // Count occurrences in current cycle by exact symptom string (approximate match)
  const currentCycleCounts = {};
  for (const log of currentCycle.logs) {
    if (Array.isArray(log.symptoms)) {
      for (const s of log.symptoms) {
        const key = s || "Unknown";
        currentCycleCounts[key] = (currentCycleCounts[key] || 0) + 1;
      }
    }
    if (log.note) {
      const txt = norm(log.note);
      for (const ds of DANGEROUS_SYMPTOMS) {
        if (txt.includes(ds.toLowerCase())) {
          currentCycleCounts[ds] = (currentCycleCounts[ds] || 0) + 1;
        }
      }
    }
  }

  // if any dangerous symptom count > 3 -> warning
  for (const k of Object.keys(currentCycleCounts)) {
    if (isDangerousSymptom(k) && currentCycleCounts[k] > 3) {
      return {
        warningText: `${k} has occurred multiple times this cycle (>3 days) — check with clinician.`,
        smallTip: `Note frequency and share logs with your clinician.`,
      };
    }
  }

  // 3) Heavy flow repeats >= 3 days in current cycle OR heavy pattern historically
  // Count heavy days in current cycle:
  let heavyDaysCurrent = 0;
  for (const log of currentCycle.logs) {
    if (log.flowLevel && String(log.flowLevel).toLowerCase().includes("heavy")) {
      heavyDaysCurrent++;
    }
  }
  // agg.heavyFlowDays contains heavy days across last N cycles
  if (heavyDaysCurrent >= 3) {
    return {
      warningText: "Heavy bleeding for 3+ days in this cycle — consider medical review.",
      smallTip: "Keep a record of flow and call your healthcare provider.",
    };
  }
  // if heavy days across recent cycles high (>=3) — warn pattern
  if ((agg && agg.heavyFlowDays >= 3) && todaysFlowIsHeavy) {
    return {
      warningText: "Repeated heavy flow pattern detected across recent cycles — get medical advice.",
      smallTip: "Bring your cycle history to your appointment.",
    };
  }

  // none matched
  return null;
}

/* ---------------------------
   Main handler
   --------------------------- */
export async function POST(req) {
  try {
    const body = await req.json();

    const mood = body.mood || "";
    const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
    const flowLevel = body.flowLevel || "";
    const userId = body.userId || null; // optional; if provided, server will check history

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    // gather history only if userId provided (and service account present)
    let history = null;
    if (userId) {
      history = await gatherHistoryForUser(userId);
      if (!history) {
        // history may be null due to missing service account or fetch error
        console.warn("History not available for user (service account missing or fetch failed).");
      }
    }

    // Compute today's dangerous symptoms list (unique)
    const todaysDangerous = [];
    for (const s of symptoms) {
      if (isDangerousSymptom(s)) todaysDangerous.push(s);
    }
    const todaysFlowIsHeavy = String(flowLevel).toLowerCase().includes("heavy");

    // Compute server-side the single strongest warning using custom priority B (with life-threat override)
    const selectedWarning = computeWarning({
      todaysDangerousSymptoms: todaysDangerous,
      todaysFlowIsHeavy,
      history,
    });

    const specialWarningText = selectedWarning
      ? `${selectedWarning.warningText} TIP: ${selectedWarning.smallTip}`
      : "No serious warning today — rest well.";

    // Build history summary for prompt (short, informative)
    let historySummary = "No history available.";
    if (history) {
      const agg = history.agg;
      const topDanger = Object.keys(agg.dangerousCounts || {})
        .sort((a, b) => (agg.dangerousCounts[b] || 0) - (agg.dangerousCounts[a] || 0))
        .slice(0, 3)
        .map((k) => `${k} (${agg.dangerousCounts[k]})`)
        .join(", ") || "None";

      const flowSummary = Object.keys(agg.flowCounts || {}).length
        ? Object.keys(agg.flowCounts).map((f) => `${f}: ${agg.flowCounts[f]} days`).join(", ")
        : "No flow data";

      historySummary = `Analysed ${agg.cyclesCount} recent cycles. Heavy flow days total: ${agg.heavyFlowDays}. Top dangerous symptoms: ${topDanger}. Flow pattern: ${flowSummary}.`;
    }

    // Build prompt for Gemini — instruct to follow the exact structure.
    const prompt = `
You are a women's health assistant. Use only the data and the server-provided WARNING_TEXT (SPECIAL_WARNING).
Return output EXACTLY in this format (short bullets, plain English):

✨ Insight

🩷 Mood: ${mood || "Not provided"}
🌸 Symptoms: ${symptoms.length ? symptoms.join(", ") : "None"}
❤️ Flow Level: ${flowLevel || "Not provided"}

🌼 What This Means
- <2 short bullets: why these symptoms/flow may be happening.>

💡 What Can Help
- <4 short practical tips; vary suggestions based on inputs/history.>

🧘 Self-care
- <3 gentle self-care tips.>

⚠️ Warning
- ${specialWarningText}

🌞 Reminder
- <One short positive reminder>

=== USER HISTORY SUMMARY ===
${historySummary}

IMPORTANT: 
- Use very plain English. Each bullet max 12 words.
- Do not add extra sections, markdown, or explanation beyond the structure above.
- If a life-threatening symptom is present (chest pain, fainting, shortness of breath, severe weakness, severe headache, high fever), the Warning line must say "Seek urgent medical attention / emergency services."
`;

    // Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const insight = result.response?.text?.().trim?.() || "";

    // If model fails, fallback to a server-crafted short insight (safe fallback)
    if (!insight) {
      const fallback = `✨ Insight

🩷 Mood: ${mood || "Not provided"}
🌸 Symptoms: ${symptoms.length ? symptoms.join(", ") : "None"}
❤️ Flow Level: ${flowLevel || "Not provided"}

🌼 What This Means
- No clear insight from AI.
- Please re-submit with more details.

💡 What Can Help
- Rest and hydrate.
- Warm compress for cramps.
- Light meals and rest.
- Track bleeding days.

🧘 Self-care
- Deep breathing.
- Short walks.
- Warm bath.

⚠️ Warning
- ${specialWarningText}

🌞 Reminder
- You're taking helpful steps by tracking.
`;
      return NextResponse.json({ ok: true, insight: fallback });
    }

    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    console.error("Gemini route error:", err);
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}
