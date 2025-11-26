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
} from "firebase/firestore";
import { useRouter } from "next/navigation";

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

  const flowLevelOptions = ["Light", "Medium", "Heavy", "Spotting"];

  // Danger list
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
  ];

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

  const [activeCycleId, setActiveCycleId] = useState(null);
  const [lastLoggedDate, setLastLoggedDate] = useState(null);
  const [cycleStartDate, setCycleStartDate] = useState(null);
  const [dayNumber, setDayNumber] = useState(null);

  const [showCustomMoodInput, setShowCustomMoodInput] = useState(false);
  const [customMood, setCustomMood] = useState("");

  const [showCustomSymptomInput, setShowCustomSymptomInput] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");

  // Load active cycle
  useEffect(() => {
    const loadCycle = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid, "appState", "latestState");
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError("No active cycle found. Please start a cycle first.");
        return;
      }

      const data = snap.data();
      setActiveCycleId(data.activeCycleId);
      setLastLoggedDate(data.lastLoggedDate);

      if (data.activeCycleId) {
        const cycleRef = doc(db, "users", user.uid, "cycles", data.activeCycleId);
        const cycleSnap = await getDoc(cycleRef);

        if (cycleSnap.exists()) {
          const cycleData = cycleSnap.data();
          setCycleStartDate(cycleData.startDate);

          if (data.lastLoggedDate) {
            const start = new Date(cycleData.startDate);
            const last = new Date(data.lastLoggedDate);
            const diff =
              (last.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
            setDayNumber(Math.round(diff));
          }
        }
      }
    };

    loadCycle();
  }, []);

  // fetch previous logs
  const fetchPreviousLogs = async () => {
    if (!auth.currentUser || !activeCycleId) return [];

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
  };

  // danger detection
  const computeWarnings = async (todaySymptoms, todayFlow) => {
    const warnings = [];

    todaySymptoms.forEach((sym) => {
      DANGEROUS_SYMPTOMS.forEach((danger) => {
        if (sym.toLowerCase().includes(danger.toLowerCase())) {
          warnings.push(`${danger} detected today`);
        }
      });
    });

    if (todayFlow === "Heavy") warnings.push("Heavy flow detected today");

    const prev = await fetchPreviousLogs();
    let heavyDays = 0;

    prev.forEach((log) => {
      if (log.flowLevel === "Heavy") heavyDays++;
    });

    if (todayFlow === "Heavy" && heavyDays >= 1) {
      warnings.push("Heavy flow for 2+ days detected");
    }

    return [...new Set(warnings)];
  };

  // save daily log
  const saveLog = async (insight, warnings) => {
    const user = auth.currentUser;
    if (!user || !activeCycleId) return;

    let nextDate = new Date();
    if (lastLoggedDate) {
      const d = new Date(lastLoggedDate);
      d.setDate(d.getDate() + 1);
      nextDate = d;
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

    await setDoc(logRef, {
      date: dateId,
      mood: selectedMood,
      symptoms: selectedSymptoms,
      flowLevel: selectedFlowLevel,
      insight,
      warnings,
      waterIntake,
      selfCare: selectedSelfCare,
      note,
      createdAt: nextDate,
    });

    await setDoc(
      doc(db, "users", user.uid, "appState", "latestState"),
      { lastLoggedDate: dateId },
      { merge: true }
    );
  };

  // AI handler
  const getInsight = async () => {
    if (!selectedMood && selectedSymptoms.length === 0 && !selectedFlowLevel) {
      setError("Please select mood, symptoms, or flow level.");
      return;
    }

    setError("");
    setLoadingAI(true);

    try {
      const warnings = await computeWarnings(selectedSymptoms, selectedFlowLevel);

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood,
          symptoms: selectedSymptoms,
          flowLevel: selectedFlowLevel,
          warnings,
        }),
      });

      const data = await res.json();

      const insightText = data.insight || "No insight generated.";
      setAiResult(insightText);
      setShowPopup(true);

      await saveLog(insightText, warnings);
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    }

    setLoadingAI(false);
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">
        <h1 className="symptoms-title">Daily Symptoms & Mood</h1>

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
            onChange={(e) => setCustomMood(e.target.value)}
            style={{ marginTop: 10 }}
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
                setShowCustomSymptomInput(false);
                setSelectedSymptoms((prev) =>
                  prev.includes(s)
                    ? prev.filter((x) => x !== s)
                    : [...prev, s]
                );
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
            style={{ marginTop: 10 }}
          />
        )}

        {/* Flow */}
        <h3 className="section-title" style={{ marginTop: 20 }}>
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

        {/* Submit */}
        <div className="symptoms-actions" style={{ marginTop: 20 }}>
          <button className="primary-btn" onClick={getInsight}>
            {loadingAI ? "Getting Insight..." : "Get Insight / Log Day"}
          </button>

          <button className="lastday-btn" onClick={() => router.push("/summary")}>
            This is Last Day
          </button>
        </div>

        {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

        {/* Popup ONLY */}
        {showPopup && (
          <div className="popup-overlay">
            <div className="popup-card popup-animate">
              <h2 className="popup-title">✨ Insight</h2>
              <div className="popup-content">
                <pre className="popup-text" style={{ whiteSpace: "pre-wrap" }}>
                  {aiResult}
                </pre>
              </div>
              <button className="popup-close-btn" onClick={() => setShowPopup(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
