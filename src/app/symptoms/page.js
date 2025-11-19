"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SymptomsPage() {
  const router = useRouter();

  const moods = ["Happy", "Sad", "Moody", "Tired", "Angry", "Energetic"];
  const symptomsList = [
    "Cramps",
    "Headache",
    "Bloating",
    "Back Pain",
    "Acne",
    "Fatigue",
    "Nausea",
    "Insomnia",
  ];

  const [selectedMood, setSelectedMood] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const [aiResult, setAiResult] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");

  const [activeCycleId, setActiveCycleId] = useState(null);
  const [lastLoggedDate, setLastLoggedDate] = useState(null);
  const [cycleStartDate, setCycleStartDate] = useState(null);
  const [dayNumber, setDayNumber] = useState(null);

  // ⭐ Fetch cycle state
  useEffect(() => {
    const fetchCycleState = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      const snap = await getDoc(latestRef);

      if (!snap.exists()) {
        setError("No active cycle found.");
        return;
      }

      const data = snap.data();
      setActiveCycleId(data.activeCycleId);
      setLastLoggedDate(data.lastLoggedDate);

      // cycle start date
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
          const start = new Date(cycleSnap.data().startDate);
          const last = new Date(data.lastLoggedDate);

          const diff = (last - start) / (1000 * 3600 * 24) + 1;
          setDayNumber(Math.round(diff));
        }
      }
    };

    fetchCycleState();
  }, []);

  const toggleSymptom = (s) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const getInsight = async () => {
    setError("");
    setAiResult("");

    if (!selectedMood && selectedSymptoms.length === 0) {
      setError("Select at least one mood or symptom.");
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
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError("AI error.");
        setLoadingAI(false);
        return;
      }

      setAiResult(data.insight);

    } catch (err) {
      console.error(err);
    }

    setLoadingAI(false);
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">

        <h1 className="symptoms-title">Daily Symptoms & Mood</h1>

        {dayNumber && (
          <p className="day-counter"><strong>Day {dayNumber} of your cycle</strong></p>
        )}

        {/* Mood */}
        <h3 className="section-title">Mood</h3>
        <div className="mood-container">
          {moods.map((m) => (
            <button
              key={m}
              className={`mood-btn ${selectedMood === m ? "mood-selected" : ""}`}
              onClick={() => setSelectedMood(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Symptoms */}
        <h3 className="section-title">Symptoms</h3>
        <div className="symptoms-grid">
          {symptomsList.map((s) => (
            <button
              key={s}
              className={`symptom-btn ${
                selectedSymptoms.includes(s) ? "symptom-selected" : ""
              }`}
              onClick={() => toggleSymptom(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div className="symptoms-actions">
          <button className="primary-btn" onClick={getInsight}>
            {loadingAI ? "Getting Insight..." : "Get Insight"}
          </button>

          <button
            className="secondary-btn"
            onClick={() =>
              router.push("/self-care")
            }
          >
            Next → Self-Care
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

      </div>
    </div>
  );
}
