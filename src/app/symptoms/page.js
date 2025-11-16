"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

  const saveLog = async (insight) => {
    const user = auth.currentUser;
    if (!user) return;

    const dayId = new Date().getTime().toString();

    await setDoc(doc(db, "users", user.uid, "dailyLogs", dayId), {
      mood: selectedMood,
      symptoms: selectedSymptoms,
      insight: insight,
      createdAt: serverTimestamp(),
    });
  };

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

        <div className="symptoms-actions">
          <button className="primary-btn" onClick={getInsight} disabled={loadingAI}>
            {loadingAI ? "Getting Insight..." : "Get Insight / Log Day"}
          </button>

          <button className="secondary-btn" onClick={() => router.push("/log-period")}>
            Back to Start Date
          </button>

          <button className="lastday-btn" onClick={() => router.push("/summary")}>
            This is Last Day
          </button>
        </div>

        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

        {/* BEAUTIFUL INSIGHT UI */}
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
