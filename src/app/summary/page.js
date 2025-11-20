"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";

export default function SummaryPage() {
  const [cycleLogs, setCycleLogs] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cycleLength, setCycleLength] = useState(0);

  const [healthScore, setHealthScore] = useState(0);
  const [overallHealth, setOverallHealth] = useState(null);

  const [nextPeriodDate, setNextPeriodDate] = useState("");

  const [moodCount, setMoodCount] = useState({});
  const [symptomCount, setSymptomCount] = useState({});
  const [flowLevelCount, setFlowLevelCount] = useState({}); // ⭐ NEW

  const [summaryText, setSummaryText] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCycleData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      const latestSnap = await getDoc(latestRef);

      if (!latestSnap.exists()) return setLoading(false);

      const { activeCycleId } = latestSnap.data();
      if (!activeCycleId) return setLoading(false);

      const cycleDocRef = doc(
        db,
        "users",
        user.uid,
        "cycles",
        activeCycleId
      );
      const cycleSnap = await getDoc(cycleDocRef);
      const cycleData = cycleSnap.data();

      const realStartDate = new Date(cycleData.startDate);
      setStartDate(realStartDate.toDateString());

      const allCyclesRef = collection(db, "users", user.uid, "cycles");
      const allCyclesSnap = await getDocs(allCyclesRef);

      let allScores = [];
      allCyclesSnap.forEach((c) => {
        const data = c.data();
        if (data.cycleHealthScore) {
          allScores.push(data.cycleHealthScore);
        }
      });

      const logsRef = collection(
        db,
        "users",
        user.uid,
        "cycles",
        activeCycleId,
        "dailyLogs"
      );

      const q = query(logsRef, orderBy("date", "asc"));
      const snapshot = await getDocs(q);

      const allLogs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (allLogs.length === 0) return setLoading(false);

      const sortedLogs = allLogs.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      const lastDay = new Date(sortedLogs[sortedLogs.length - 1].date);
      setEndDate(lastDay.toDateString());

      const diffDays =
        (lastDay.getTime() - realStartDate.getTime()) /
          (1000 * 60 * 60 * 24) +
        1;
      const roundedDays = Math.round(diffDays);
      setCycleLength(roundedDays);

      let moodMap = {};
      let symptomMap = {};
      let flowMap = {}; // ⭐ NEW

      sortedLogs.forEach((log) => {
        if (log.mood) {
          moodMap[log.mood] = (moodMap[log.mood] || 0) + 1;
        }

        if (log.symptoms) {
          log.symptoms.forEach((s) => {
            symptomMap[s] = (symptomMap[s] || 0) + 1;
          });
        }

        if (log.flowLevel) {
          flowMap[log.flowLevel] = (flowMap[log.flowLevel] || 0) + 1;
        }
      });

      setMoodCount(moodMap);
      setSymptomCount(symptomMap);
      setFlowLevelCount(flowMap);

      let score = 100;
      if (roundedDays < 3 || roundedDays > 8) score -= 25;
      if (Object.keys(symptomMap).length > 4) score -= 15;
      if (score < 10) score = 10;

      setHealthScore(score);
      allScores.push(score);

      if (allScores.length > 1) {
        const previous = allScores.slice(0, -1);
        const avg = previous.reduce((a, b) => a + b, 0) / previous.length;
        setOverallHealth(Math.round(avg));
      }

      const next = new Date(realStartDate);
      next.setDate(realStartDate.getDate() + 28);
      setNextPeriodDate(next.toDateString());

      // ⭐ NEW — COMPUTE TOP VALUES
      const topMood =
        Object.keys(moodMap).sort((a, b) => moodMap[b] - moodMap[a])[0] ||
        "Not logged";

      const topSymptom =
        Object.keys(symptomMap).sort(
          (a, b) => symptomMap[b] - symptomMap[a]
        )[0] || "Not logged";

      const topFlow =
        Object.keys(flowMap).sort((a, b) => flowMap[b] - flowMap[a])[0] ||
        "Not logged";

      // ⭐ NEW — FLOW SUMMARY
      const flowSummary =
        Object.keys(flowMap).length > 0
          ? Object.keys(flowMap)
              .map((f) => `${f}: ${flowMap[f]} days`)
              .join(", ")
          : "No flow data logged.";

      // ⭐ NEW — RED FLAGS
      let redFlags = [];

      if (flowMap["Heavy"] >= 2)
        redFlags.push("Heavy flow for 2 or more days");

      if (roundedDays < 3 || roundedDays > 8)
        redFlags.push("Irregular cycle length");

      if (Object.keys(symptomMap).length === 0)
        redFlags.push("No symptoms logged");

      if (redFlags.length === 0)
        redFlags.push("No serious warning signs detected.");

      // ⭐ NEW — SUMMARY TEXT (Doctor Friendly)
      const summary = `
During this cycle (${realStartDate.toDateString()} → ${lastDay.toDateString()}):

• Most common flow: **${topFlow}**
• Most frequent mood: **${topMood}**
• Most reported symptom: **${topSymptom}**
• Cycle length: **${roundedDays} days** (${
        roundedDays < 3 || roundedDays > 8 ? "irregular" : "normal"
      })

Flow Pattern:
${flowSummary}

💡 Tips:
• Stay hydrated  
• Try light stretching  
• Track heavy flow days  
• Sleep early  
      `.trim();

      setSummaryText(summary);

      // ⭐ NEW — SAVE ALL FIELDS IN FIRESTORE
      await setDoc(
        cycleDocRef,
        {
          endDate: sortedLogs[sortedLogs.length - 1].date,
          cycleLength: roundedDays,
          nextPredictedDate: next.toDateString(),
          cycleHealthScore: score,

          topMood,
          topSymptom,
          topFlow,
          flowSummary,
          summaryText: summary,
          redFlags,
        },
        { merge: true }
      );

      await setDoc(
        latestRef,
        {
          isCycleRunning: false,
          activeCycleId: null,
        },
        { merge: true }
      );

      setLoading(false);
    };

    getCycleData();
  }, []);

  if (loading) return <p>Loading your cycle summary...</p>;

  return (
    <div className="summary-page">

      <h1 className="summary-title">🌸 Monthly Cycle Summary</h1>

      <div className="summary-card">
        <h2>Cycle Overview</h2>
        <p>Start Date: {startDate}</p>
        <p>End Date: {endDate}</p>
        <p>Total Days: {cycleLength}</p>
      </div>

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

      {overallHealth !== null && (
        <div className="summary-card">
          <h2>Overall Cycle Quality</h2>
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${overallHealth}%` }}
            ></div>
          </div>
          <p className="progress-text">{overallHealth}% Overall Health</p>
        </div>
      )}

      <div className="summary-card">
        <h2>Next Expected Period</h2>
        <p>{nextPeriodDate}</p>
      </div>

      <div className="summary-card">
        <h2>Mood Pattern</h2>
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

      <div className="summary-card">
        <h2>Symptom Pattern</h2>
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

      <div className="summary-card">
        <h2>Flow Pattern</h2>
        {Object.keys(flowLevelCount).length === 0 && (
          <p>No flow data logged.</p>
        )}
        {Object.keys(flowLevelCount).map((f) => (
          <div className="bar-row" key={f}>
            <span>{f}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${flowLevelCount[f] * 20}px` }}
              ></div>
            </div>
            <span>{flowLevelCount[f]} days</span>
          </div>
        ))}
      </div>

      <div className="summary-card">
        <h2>Cycle Summary</h2>
        <p style={{ whiteSpace: "pre-line" }}>{summaryText}</p>
      </div>

    </div>
  );
}
