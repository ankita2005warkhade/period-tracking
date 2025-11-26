"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  getDocs,
  orderBy,
  updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";

/**
 * Symptoms page
 * - Detects dangerous symptoms and repeated occurrences
 * - Saves warnings into dailyLogs and updates cycle doc
 * - Sends warnings to AI endpoint so it can tailor tips/warnings
 */

export default function SymptomsPage() {
  const router = useRouter();

  const moods = ["Happy", "Sad", "Moody", "Tired", "Angry", "Energetic"];
  const symptomsList = [
    "Cramps/Stomach Pain",
    "Headache",
    "Acidic Feeling",
    "Back Pain",
    "Acne/Pimples",
    "Weakness",
    "Feeling Like Vomiting",
    "Can’t Sleep",
  ];

  // Flow Level Options
  const flowLevelOptions = ["Light", "Medium", "Heavy", "Spotting"];

  const selfCareOptions = [
    "Yoga",
    "Meditation",
    "Warm Bath",
    "Healthy Meal",
    "Rest",
  ];

  // ---------- DANGEROUS SYMPTOMS (user confirmed list) ----------
  const DANGEROUS_SYMPTOMS = [
    "Heavy Bleeding",
    "Blood Clots",
    "Fever",
    "Chest Pain",
    "Severe Back Pain",
    "Pelvic Pain",
    "Shortness of Breath",
    "Severe Weakness",
    "Severe Cramps",
    "Vomiting",
    "Dizziness / Fainting",
    "Irregular Flow Pattern", // conceptual flag
  ];
  // ------------------------------------------------------------

  const [selectedMood, setSelectedMood] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedFlowLevel, setSelectedFlowLevel] = useState("");

  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedSelfCare, setSelectedSelfCare] = useState([]);
  const [note, setNote] = useState("");

  const [aiResult, setAiResult] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [warningsState, setWarningsState] = useState([]); // kept for logic, not shown in UI

  const [activeCycleId, setActiveCycleId] = useState(null);
  const [lastLoggedDate, setLastLoggedDate] = useState(null);
  const [cycleStartDate, setCycleStartDate] = useState(null);
  const [dayNumber, setDayNumber] = useState(null);

  // Custom inputs
  const [showCustomMoodInput, setShowCustomMoodInput] = useState(false);
  const [customMood, setCustomMood] = useState("");

  const [showCustomSymptomInput, setShowCustomSymptomInput] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");

  // Fetch cycle state (active cycle, last logged date, start date)
  useEffect(() => {
    const fetchCycleState = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const latestRef = doc(db, "users", user.uid, "appState", "latestState");
        const latestSnap = await getDoc(latestRef);

        if (!latestSnap.exists()) {
          setError("No active cycle found. Please start a cycle first.");
          return;
        }

        const data = latestSnap.data();
        setActiveCycleId(data.activeCycleId || null);
        setLastLoggedDate(data.lastLoggedDate || null);

        if (data.activeCycleId) {
          const cycleRef = doc(
            db,
            "users",
            user.uid,
            "cycles",
            data.activeCycleId
          );
          const cycleSnap = await getDoc(cycleRef);

          if (cycleSnap.exists()) {
            const cycleData = cycleSnap.data();
            setCycleStartDate(cycleData.startDate);

            // compute day number (if lastLoggedDate present)
            if (data.lastLoggedDate) {
              const start = new Date(cycleData.startDate);
              const last = new Date(data.lastLoggedDate);
              const diffDays =
                (last.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
              setDayNumber(Math.round(diffDays));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching cycle state:", err);
        setError("Unable to fetch cycle state.");
      }
    };

    fetchCycleState();
  }, []);

  // Toggle symptom selection
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  // Toggle self-care selection
  const toggleSelfCare = (item) => {
    setSelectedSelfCare((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  // Utility: fetch previous logs for current cycle
  const fetchPreviousLogs = async () => {
    if (!auth.currentUser || !activeCycleId) return [];
    try {
      const logsRef = collection(
        db,
        "users",
        auth.currentUser.uid,
        "cycles",
        activeCycleId,
        "dailyLogs"
      );
      const q = query(logsRef, orderBy("date", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Error fetching previous logs:", err);
      return [];
    }
  };

  // Determine warnings for today's inputs (dangerous symptoms, repeated, heavy flow pattern, irregular)
  const computeWarnings = async (todaySymptoms, todayFlow) => {
    const warnings = [];

    // 1) Direct dangerous symptoms selected today
    for (const s of todaySymptoms) {
      for (const danger of DANGEROUS_SYMPTOMS) {
        if (danger === "Irregular Flow Pattern") continue;
        if (s.toLowerCase().includes(danger.toLowerCase()) || danger.toLowerCase().includes(s.toLowerCase())) {
          warnings.push(`${danger} detected today`);
        }
      }
    }

    // 2) Flow-based immediate checks
    if (todayFlow === "Heavy") {
      warnings.push("Heavy flow detected today");
    }

    // 3) Look for repeated dangerous symptom occurrences across previous logs
    const prevLogs = await fetchPreviousLogs();

    // Count previous occurrences for dangerous symptoms and heavy flow
    const prevDangerCounts = {};
    let prevHeavyFlowDays = 0;

    prevLogs.forEach((log) => {
      if (log.symptoms && Array.isArray(log.symptoms)) {
        log.symptoms.forEach((s) => {
          const key = s.trim();
          prevDangerCounts[key] = (prevDangerCounts[key] || 0) + 1;
        });
      }
      if (log.flowLevel === "Heavy") prevHeavyFlowDays += 1;
    });

    // For each dangerous symptom selected today, check if it occurred before
    for (const s of todaySymptoms) {
      if (prevDangerCounts[s] && prevDangerCounts[s] >= 1) {
        warnings.push(`${s} has occurred on multiple days — repeated symptom`);
      }
      for (const danger of DANGEROUS_SYMPTOMS) {
        if (danger === "Irregular Flow Pattern") continue;
        if (s.toLowerCase().includes(danger.toLowerCase()) && prevDangerCounts[s]) {
          if (!warnings.includes(`${danger} has occurred on multiple days — repeated symptom`)) {
            warnings.push(`${danger} has occurred on multiple days — repeated symptom`);
          }
        }
      }
    }

    // 4) Heavy flow repeated: if prevHeavyFlowDays >=1 and today is Heavy => 2+ heavy days sequence
    if (todayFlow === "Heavy" && prevHeavyFlowDays >= 1) {
      warnings.push("Heavy flow for 2+ days detected");
    }

    // 5) Irregular flow pattern: if cycle info available and dayNumber indicates irregular
    if (cycleStartDate && dayNumber) {
      if (dayNumber < 3 || dayNumber > 8) {
        warnings.push("Irregular flow pattern detected for this cycle");
      }
    }

    const uniqueWarnings = [...new Set(warnings)];
    return { warnings: uniqueWarnings, prevDangerCounts, prevHeavyFlowDays };
  };

  // Save daily log and also update cycle doc with red flags
  const saveLog = async (insight, warnings = []) => {
    const user = auth.currentUser;
    if (!user || !activeCycleId) return;

    try {
      let nextDate;
      if (lastLoggedDate) {
        const last = new Date(lastLoggedDate);
        nextDate = new Date(last);
        nextDate.setDate(last.getDate() + 1);
      } else {
        nextDate = new Date();
      }

      const dateId = nextDate.toISOString().split("T")[0];

      const logRef = doc(
        db,
        "users",
        user.uid,
        "cycles",
        activeCycleId,
        "dailyLogs",
        dateId
      );

      const logData = {
        date: dateId,
        mood: selectedMood,
        symptoms: selectedSymptoms,
        flowLevel: selectedFlowLevel,
        waterIntake: waterIntake,
        selfCare: selectedSelfCare,
        note: note,
        insight: insight,
        warnings: warnings,
        createdAt: nextDate,
      };

      await setDoc(logRef, logData);

      // Update lastLoggedDate
      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      await setDoc(latestRef, { lastLoggedDate: dateId }, { merge: true });

      // Update cycle doc: append or merge redFlags & counters
      const cycleRef = doc(db, "users", user.uid, "cycles", activeCycleId);
      const cycleSnap = await getDoc(cycleRef);

      const existing = cycleSnap.exists() ? cycleSnap.data() : {};

      const existingRedFlags = Array.isArray(existing.redFlags) ? existing.redFlags : [];
      const newRedFlags = [...existingRedFlags, ...warnings].filter(Boolean);
      const uniqueRedFlags = [...new Set(newRedFlags)];

      await setDoc(cycleRef, { redFlags: uniqueRedFlags }, { merge: true });

      // Reset UI
      setSelectedMood("");
      setSelectedSymptoms([]);
      setSelectedFlowLevel("");
      setWaterIntake(0);
      setSelectedSelfCare([]);
      setNote("");

      setLastLoggedDate(dateId);
      setDayNumber((prev) => (prev ? prev + 1 : 1));
      setWarningsState(warnings); // keep for logic but not shown
    } catch (err) {
      console.error("Error saving log:", err);
      setError("Failed to save daily log.");
    }
  };

  // AI Insight + Logging pipeline
  const getInsight = async () => {
    setError("");
    setAiResult("");
    setWarningsState([]);

    // validation
    if (!selectedMood && selectedSymptoms.length === 0 && !selectedFlowLevel) {
      setError("Please select mood, symptoms, or flow level.");
      return;
    }
    if (!activeCycleId) {
      setError("No active cycle started.");
      return;
    }

    setLoadingAI(true);

    try {
      // compute warnings first (so AI can consider them)
      const { warnings } = await computeWarnings(selectedSymptoms, selectedFlowLevel);

      // Send payload to AI including warnings & previous flags possibility
      const payload = {
        mood: selectedMood,
        symptoms: selectedSymptoms,
        flowLevel: selectedFlowLevel,
        warnings,
      };

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        // If the AI service sends back not-ok, still save warning info but show error
        setError("AI service error. Saved your day locally.");
        // still save the log with whatever warnings computed
        await saveLog("", warnings);
        setLoadingAI(false);
        return;
      }

      // AI returned an insight string
      const insightText = data.insight || "";
      setAiResult(insightText);
      // we keep setShowPopup(true) for compatibility with existing logic,
      // but the popup UI has been removed so insight will only appear once below.
      setShowPopup(true);

      // Save log with insight and warnings
      await saveLog(insightText, warnings);
    } catch (err) {
      console.error("Error during AI / logging:", err);
      setError("Something went wrong while getting insight.");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">
        <h1 className="symptoms-title">Daily Symptoms & Mood</h1>

        {/* Day counter */}
        {dayNumber && (
          <p className="day-counter">
            <strong>Day {dayNumber} of your cycle</strong>
          </p>
        )}

        {/* Mood */}
        <h3 className="section-title">Mood</h3>
        <div className="mood-container">
          {moods.map((m) => (
            <button
              key={m}
              className={`mood-btn ${selectedMood === m ? "mood-selected" : ""}`}
              onClick={() => {
                setSelectedMood(m);
                setShowCustomMoodInput(false);
              }}
            >
              {m}
            </button>
          ))}

          <button
            className={`mood-btn ${showCustomMoodInput ? "mood-selected" : ""}`}
            onClick={() => {
              setShowCustomMoodInput(true);
              setSelectedMood("");
            }}
          >
            Other
          </button>
        </div>

        {showCustomMoodInput && (
          <input
            type="text"
            className="note-input"
            placeholder="Type your mood..."
            value={customMood}
            onChange={(e) => {
              setCustomMood(e.target.value);
              setSelectedMood(e.target.value);
            }}
            style={{ marginTop: "10px" }}
          />
        )}

        {/* Symptoms */}
        <h3 className="section-title">Symptoms</h3>
        <div className="symptoms-grid">
          {symptomsList.map((s) => (
            <button
              key={s}
              className={`symptom-btn ${
                selectedSymptoms.includes(s) ? "symptom-selected" : ""
              }`}
              onClick={() => {
                toggleSymptom(s);
                setShowCustomSymptomInput(false);
              }}
            >
              {s}
            </button>
          ))}

          <button
            className={`symptom-btn ${showCustomSymptomInput ? "symptom-selected" : ""}`}
            onClick={() => setShowCustomSymptomInput(true)}
          >
            Other
          </button>
        </div>

        {showCustomSymptomInput && (
          <input
            type="text"
            className="note-input"
            placeholder="Type your symptom..."
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
            onBlur={() => {
              if (customSymptom.trim()) {
                setSelectedSymptoms((prev) => [...prev, customSymptom.trim()]);
              }
            }}
            style={{ marginTop: "10px" }}
          />
        )}

        {/* Flow Level */}
        <h3 className="section-title" style={{ marginTop: "20px" }}>
          Flow Level
        </h3>
        <div className="mood-container">
          {flowLevelOptions.map((f) => (
            <button
              key={f}
              className={`mood-btn ${selectedFlowLevel === f ? "mood-selected" : ""}`}
              onClick={() => setSelectedFlowLevel(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="symptoms-actions" style={{ marginTop: 20 }}>
          <button className="primary-btn" onClick={getInsight}>
            {loadingAI ? "Getting Insight..." : "Get Insight / Log Day"}
          </button>

          <button className="lastday-btn" onClick={() => router.push("/summary")}>
            This is Last Day
          </button>
        </div>

        {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

        {/* ONLY ONE INSIGHT DISPLAY (white card). Popup and extra warning UI removed. */}
        {aiResult && (
          <div
            className="ai-result"
            style={{
              marginTop: 18,
              // ensure long text wraps and does not overflow the card
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            <h2>✨ Insight</h2>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{aiResult}</pre>
          </div>
        )}

        {/* Popup UI intentionally removed to avoid duplicate insight display */}

      </div>
    </div>
  );
}
