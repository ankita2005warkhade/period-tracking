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

  // ⭐ NEW — Flow Level Options
  const flowLevelOptions = ["Light", "Medium", "Heavy", "Spotting"];

  const selfCareOptions = [
    "Yoga",
    "Meditation",
    "Warm Bath",
    "Healthy Meal",
    "Rest",
  ];

  const [selectedMood, setSelectedMood] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedFlowLevel, setSelectedFlowLevel] = useState(""); // ⭐ NEW

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

  // 👉 Custom Mood/Symptoms
  const [showCustomMoodInput, setShowCustomMoodInput] = useState(false);
  const [customMood, setCustomMood] = useState("");

  const [showCustomSymptomInput, setShowCustomSymptomInput] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");

  // ⭐ Fetch Cycle State
  useEffect(() => {
    const fetchCycleState = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      const latestSnap = await getDoc(latestRef);

      if (!latestSnap.exists()) {
        setError("No active cycle found. Please start a cycle first.");
        return;
      }

      const data = latestSnap.data();
      setActiveCycleId(data.activeCycleId);
      setLastLoggedDate(data.lastLoggedDate);

      // Fetch cycle details
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

          const start = new Date(cycleData.startDate);
          const last = new Date(data.lastLoggedDate);

          const diffDays =
            (last.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;

          setDayNumber(Math.round(diffDays));
        }
      }
    };

    fetchCycleState();
  }, []);

  // ⭐ Toggle Symptoms
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  // ⭐ Toggle Self-Care
  const toggleSelfCare = (item) => {
    setSelectedSelfCare((prev) =>
      prev.includes(item)
        ? prev.filter((x) => x !== item)
        : [...prev, item]
    );
  };

  // ⭐ Save Daily Log (UPDATED WITH FLOW LEVEL)
  const saveLog = async (insight) => {
    const user = auth.currentUser;
    if (!user || !activeCycleId) return;

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

    await setDoc(logRef, {
      date: dateId,
      mood: selectedMood,
      symptoms: selectedSymptoms,
      flowLevel: selectedFlowLevel, // ⭐ NEW — save flow
      waterIntake: waterIntake,
      selfCare: selectedSelfCare,
      note: note,
      insight: insight,
      createdAt: nextDate,
    });

    // Update last logged date
    const latestRef = doc(db, "users", user.uid, "appState", "latestState");
    await setDoc(latestRef, { lastLoggedDate: dateId }, { merge: true });

    // Reset UI
    setSelectedMood("");
    setSelectedSymptoms([]);
    setSelectedFlowLevel(""); // ⭐ reset flow
    setWaterIntake(0);
    setSelectedSelfCare([]);
    setNote("");

    setLastLoggedDate(dateId);
    setDayNumber((prev) => prev + 1);
  };

  // ⭐ AI Insight + Logging
  const getInsight = async () => {
    setError("");
    setAiResult("");

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
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood,
          symptoms: selectedSymptoms,
          flowLevel: selectedFlowLevel, // ⭐ add flow to AI
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError("AI service error.");
        setLoadingAI(false);
        return;
      }

      setAiResult(data.insight);
      setShowPopup(true);

      await saveLog(data.insight);
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

        {/* ⭐ Day Counter */}
        {dayNumber && (
          <p className="day-counter">
            <strong>Day {dayNumber} of your cycle</strong>
          </p>
        )}

        {/* ⭐ Mood */}
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

        {/* ⭐ Symptoms */}
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
            className={`symptom-btn ${
              showCustomSymptomInput ? "symptom-selected" : ""
            }`}
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
                setSelectedSymptoms((prev) => [
                  ...prev,
                  customSymptom.trim(),
                ]);
              }
            }}
            style={{ marginTop: "10px" }}
          />
        )}

        {/* ⭐ NEW — Flow Level Section */}
        <h3 className="section-title" style={{ marginTop: "20px" }}>
          Flow Level
        </h3>
        <div className="mood-container">
          {flowLevelOptions.map((f) => (
            <button
              key={f}
              className={`mood-btn ${
                selectedFlowLevel === f ? "mood-selected" : ""
              }`}
              onClick={() => setSelectedFlowLevel(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div className="symptoms-actions">
          <button className="primary-btn" onClick={getInsight}>
            {loadingAI ? "Getting Insight..." : "Get Insight / Log Day"}
          </button>

          <button
            className="lastday-btn"
            onClick={() => router.push("/summary")}
          >
            This is Last Day
          </button>
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {aiResult && (
          <div className="ai-result">
            <h2>✨ Insight</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>{aiResult}</pre>
          </div>
        )}

        {showPopup && (
          <div className="popup-overlay">
            <div className="popup-card popup-animate">
              <h2 className="popup-title">✨ Insight</h2>

              <div className="popup-content">
                <pre className="popup-text">{aiResult}</pre>
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
