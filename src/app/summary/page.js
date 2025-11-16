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
      const q = query(logsRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      const allLogs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (allLogs.length === 0) {
        setLoading(false);
        return;
      }

      // LATEST CYCLE = Last continuous logs
      // (Simple rule: all logs entered since the last start date)
      const latestCycle = allLogs; // since you store only one cycle now
      setCycleLogs(latestCycle);

      // Start & End Date
      const first = latestCycle[0].createdAt?.toDate();
      const last = latestCycle[latestCycle.length - 1].createdAt?.toDate();

      setStartDate(first.toDateString());
      setEndDate(last.toDateString());

      const diff =
        (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24) + 1;

      setCycleLength(diff);

      // COUNT ONLY FOR THIS CYCLE
      let moodMap = {};
      let symptomMap = {};
      
      latestCycle.forEach((log) => {
        if (log.mood) moodMap[log.mood] = (moodMap[log.mood] || 0) + 1;

        if (log.symptoms) {
          log.symptoms.forEach((s) => {
            symptomMap[s] = (symptomMap[s] || 0) + 1;
          });
        }
      });

      setMoodCount(moodMap);
      setSymptomCount(symptomMap);

      // 🎯 HEALTH SCORE CALCULATION (More realistic)
      let score = 100;

      // If cycle is outside normal 3–8 days
      if (diff < 3 || diff > 8) score -= 25;

      // If too many severe symptoms
      if (Object.keys(symptomMap).length > 4) score -= 15;

      if (score < 10) score = 10;
      setHealthScore(score);

      // ⏳ Next Period Prediction
      const next = new Date(first);
      next.setDate(first.getDate() + 28);
      setNextPeriodDate(next.toDateString());

      // 🧠 AUTO SUMMARY (DETAILED)
      const topMood =
        Object.keys(moodMap).sort((a, b) => moodMap[b] - moodMap[a])[0] || "";

      const topSymptom =
        Object.keys(symptomMap).sort((a, b) => symptomMap[b] - symptomMap[a])[0] || "";

      const insightSummary = `
During this cycle from ${first.toDateString()} to ${last.toDateString()}, 
your body showed a pattern of ${topSymptom.toLowerCase()} appearing most often, 
and you commonly experienced "${topMood}" as your main mood.

Your cycle lasted ${diff} days, 
which is ${diff < 3 || diff > 8 ? "a bit irregular" : "within a healthy range"}.

This month’s symptoms suggest your body was responding to hormonal changes 
through patterns like ${topSymptom.toLowerCase()}, 
while your emotional well-being reflected phases of ${topMood.toLowerCase()}.

To optimize your next cycle:
– Keep track of sleep and hydration to reduce ${topSymptom.toLowerCase()}.  
– Follow regular warm compresses or light stretching.  
– Maintain a balanced mood routine with gentle breathing or journaling.

This summary is based on your daily logs only, making it personalized for YOU.
      `;

      setSummaryText(insightSummary);

      setLoading(false);
    };

    getCycleData();
  }, []);

  if (loading) return <p>Loading summary...</p>;

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

      {/* Detailed Summary */}
      <div className="summary-card">
        <h2>Cycle Summary</h2>
        <p style={{ whiteSpace: "pre-line" }}>{summaryText}</p>
      </div>
    </div>
  );
}
