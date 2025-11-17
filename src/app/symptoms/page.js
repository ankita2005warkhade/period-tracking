"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
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
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState("");

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  // ⭐ Automatically simulate next-day date for testing
  const saveLog = async (insight) => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch the latest log to know the last stored date
    const logsRef = collection(db, "users", user.uid, "dailyLogs");
    const q = query(logsRef, orderBy("date", "desc"));
    const snapshot = await getDocs(q);

    let nextDate = new Date();

    // If previous logs exist → take last date and add 1 day
    if (!snapshot.empty) {
      const lastLog = snapshot.docs[0].data();
      if (lastLog.date) {
        const lastDate = new Date(lastLog.date);

        nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1); // ⭐ NEXT DAY SIMULATION
      }
    }

    // Create ID in YYYY-MM-DD format
    const dateId = nextDate.toISOString().split("T")[0];

    // Save this day's log
    await setDoc(doc(db, "users", user.uid, "dailyLogs", dateId), {
      date: dateId,
      mood: selectedMood,
      symptoms: selectedSymptoms,
      insight: insight,
      createdAt: nextDate,
    });

    // Reset for next day
    setSelectedMood("");
    setSelectedSymptoms([]);
  };

  // ⭐ Get AI Insight + Save Log
  const getInsight = async () => {
    setError("");
    setAiResult("");

    if (!selectedMood && selectedSymptoms.length === 0) {
      setError("Please select a mood or symptoms.");
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
        setError("AI service error.");
        setLoadingAI(false);
        return;
      }

      setAiResult(data.insight);

      // Save day's log
      await saveLog(data.insight);
    } catch (err) {
      setError("Something went wrong.");
      console.error(err);
    }

    setLoadingAI(false);
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">
        <h1 className="symptoms-title">Daily Symptoms & Mood</h1>

        {/* Mood Section */}
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

        {/* Symptoms Section */}
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
          <button
            className="primary-btn"
            onClick={getInsight}
            disabled={loadingAI}
          >
            {loadingAI ? "Getting Insight..." : "Get Insight / Log Day"}
          </button>

          <button
            className="secondary-btn"
            onClick={() => router.push("/log-period")}
          >
            Back to Start Date
          </button>

          <button
            className="lastday-btn"
            onClick={() => router.push("/summary")}
          >
            This is Last Day
          </button>
        </div>

        {/* Errors */}
        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

        {/* AI Result */}
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
