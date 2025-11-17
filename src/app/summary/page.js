"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function SummaryPage() {
  const [cycleLogs, setCycleLogs] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cycleLength, setCycleLength] = useState(0);

  const [healthScore, setHealthScore] = useState(0);
  const [nextPeriodDate, setNextPeriodDate] = useState("");

  const [moodCount, setMoodCount] = useState({});
  const [symptomCount, setSymptomCount] = useState({});
  const [summaryText, setSummaryText] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCycleData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const logsRef = collection(db, "users", user.uid, "dailyLogs");
      const q = query(logsRef, orderBy("date", "asc"));
      const snapshot = await getDocs(q);

      const allLogs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (allLogs.length === 0) {
        setLoading(false);
        return;
      }

      // -----------------------------------
      // 🟣 STEP 1 — SORT LOGS BY DATE
      // -----------------------------------
      const sortedLogs = allLogs.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      // -----------------------------------
      // 🟣 STEP 2 — IDENTIFY CURRENT CYCLE
      // -----------------------------------
      const firstDay = new Date(sortedLogs[0].date);
      const lastDay = new Date(sortedLogs[sortedLogs.length - 1].date);

      const currentCycle = sortedLogs.filter((log) => {
        const logDate = new Date(log.date);
        return logDate >= firstDay && logDate <= lastDay;
      });

      setCycleLogs(currentCycle);

      // -----------------------------------
      // 🟣 STEP 3 — CYCLE LENGTH (ROUND DAYS)
      // -----------------------------------
      const diffDays =
        (lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24) + 1;

      const roundedDays = Math.round(diffDays);

      setCycleLength(roundedDays);

      setStartDate(firstDay.toDateString());
      setEndDate(lastDay.toDateString());

      // -----------------------------------
      // 🟣 STEP 4 — PATTERN CALCULATIONS
      // -----------------------------------
      let moodMap = {};
      let symptomMap = {};

      currentCycle.forEach((log) => {
        if (log.mood) {
          moodMap[log.mood] = (moodMap[log.mood] || 0) + 1;
        }

        if (log.symptoms) {
          log.symptoms.forEach((s) => {
            symptomMap[s] = (symptomMap[s] || 0) + 1;
          });
        }
      });

      setMoodCount(moodMap);
      setSymptomCount(symptomMap);

      // -----------------------------------
      // 🟣 STEP 5 — HEALTH SCORE
      // -----------------------------------
      let score = 100;

      // Cycle < 3 or > 8 days → irregular
      if (roundedDays < 3 || roundedDays > 8) score -= 25;

      // Too many symptoms types → lower score
      if (Object.keys(symptomMap).length > 4) score -= 15;

      if (score < 10) score = 10;

      setHealthScore(score);

      // -----------------------------------
      // 🟣 STEP 6 — NEXT PERIOD PREDICTION
      // -----------------------------------
      const next = new Date(firstDay);
      next.setDate(firstDay.getDate() + 28);
      setNextPeriodDate(next.toDateString());

      // -----------------------------------
      // 🟣 STEP 7 — SUMMARY TEXT
      // -----------------------------------
      const topMood =
        Object.keys(moodMap).sort((a, b) => moodMap[b] - moodMap[a])[0] || "";

      const topSymptom =
        Object.keys(symptomMap).sort(
          (a, b) => symptomMap[b] - symptomMap[a]
        )[0] || "";

      const summary = `
During this cycle from ${firstDay.toDateString()} to ${lastDay.toDateString()},
your body commonly experienced ${topSymptom.toLowerCase()},
and emotionally, your most frequent mood was "${topMood}".

Your cycle lasted ${roundedDays} days,
which is ${
        roundedDays < 3 || roundedDays > 8
          ? "slightly irregular"
          : "within a normal and healthy range"
      }.

Your symptoms indicate normal hormonal changes,
with patterns like ${topSymptom.toLowerCase()} appearing frequently,
while your emotional balance fluctuated through phases of ${topMood.toLowerCase()}.

💡 To support a healthier next cycle:
• Stay consistent with hydration  
• Practice gentle stretching or yoga  
• Maintain good sleep routines  
• Journal or practice breathing exercises for emotional balance  

This summary is fully based on your daily logs for this cycle.
      `;

      setSummaryText(summary);
      setLoading(false);
    };

    getCycleData();
  }, []);

  if (loading) return <p>Loading your cycle summary...</p>;

  return (
    <div className="summary-page">
      <h1 className="summary-title">🌸 Monthly Cycle Summary</h1>

      {/* Cycle Overview */}
      <div className="summary-card">
        <h2>Cycle Overview</h2>
        <p>Start Date: {startDate}</p>
        <p>End Date: {endDate}</p>
        <p>Total Days: {cycleLength}</p>
      </div>

      {/* Cycle Health */}
      <div className="summary-card">
        <h2>Cycle Health</h2>
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${healthScore}%` }}
          ></div>
        </div>
        <p className="progress-text">{healthScore}% Healthy</p>
      </div>

      {/* Next Period */}
      <div className="summary-card">
        <h2>Next Expected Period</h2>
        <p>{nextPeriodDate}</p>
      </div>

      {/* Mood Pattern */}
      <div className="summary-card">
        <h2>Mood Pattern (This Cycle)</h2>
        {Object.keys(moodCount).length === 0 && <p>No data logged.</p>}

        {Object.keys(moodCount).map((mood) => (
          <div className="bar-row" key={mood}>
            <span>{mood}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${moodCount[mood] * 20}px` }}
              ></div>
            </div>
            <span>{moodCount[mood]} days</span>
          </div>
        ))}
      </div>

      {/* Symptom Pattern */}
      <div className="summary-card">
        <h2>Symptom Pattern (This Cycle)</h2>

        {Object.keys(symptomCount).length === 0 && <p>No data logged.</p>}

        {Object.keys(symptomCount).map((s) => (
          <div className="bar-row" key={s}>
            <span>{s}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${symptomCount[s] * 20}px` }}
              ></div>
            </div>
            <span>{symptomCount[s]} times</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="summary-card">
        <h2>Cycle Summary</h2>
        <p style={{ whiteSpace: "pre-line" }}>{summaryText}</p>
      </div>
    </div>
  );
}
