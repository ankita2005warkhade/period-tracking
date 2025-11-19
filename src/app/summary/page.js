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
  const [overallHealth, setOverallHealth] = useState(null); // ⭐ NEW BAR

  const [nextPeriodDate, setNextPeriodDate] = useState("");

  const [moodCount, setMoodCount] = useState({});
  const [symptomCount, setSymptomCount] = useState({});
  const [summaryText, setSummaryText] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCycleData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // 1️⃣ Get active cycle ID
      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      const latestSnap = await getDoc(latestRef);

      if (!latestSnap.exists()) return setLoading(false);

      const { activeCycleId } = latestSnap.data();
      if (!activeCycleId) return setLoading(false);

      // ⭐ NEW — Fetch all cycles for overall health score
      const allCyclesRef = collection(db, "users", user.uid, "cycles");
      const allCyclesSnap = await getDocs(allCyclesRef);

      let allScores = [];
      allCyclesSnap.forEach((c) => {
        const data = c.data();
        if (data.cycleHealthScore) {
          allScores.push(data.cycleHealthScore);
        }
      });

      // Remove current cycle score later
      // (We'll push the current cycle score after calculating it)
      // --------------------------

      // 2️⃣ Fetch daily logs of the active cycle
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

      // 3️⃣ Sort logs by date
      const sortedLogs = allLogs.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      const firstDay = new Date(sortedLogs[0].date);
      const lastDay = new Date(sortedLogs[sortedLogs.length - 1].date);

      setStartDate(firstDay.toDateString());
      setEndDate(lastDay.toDateString());

      // 4️⃣ Cycle length
      const diffDays =
        (lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24) + 1;
      const roundedDays = Math.round(diffDays);
      setCycleLength(roundedDays);

      // 5️⃣ Mood & symptoms
      let moodMap = {};
      let symptomMap = {};

      sortedLogs.forEach((log) => {
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

      // 6️⃣ Calculate cycle health score
      let score = 100;
      if (roundedDays < 3 || roundedDays > 8) score -= 25;
      if (Object.keys(symptomMap).length > 4) score -= 15;
      if (score < 10) score = 10;

      setHealthScore(score);

      // ⭐ Add current cycle score to allScores
      allScores.push(score);

      // ⭐ Calculate average overall health
      if (allScores.length > 1) {
        // remove last (current cycle) → we want past cycles only
        const previousScores = allScores.slice(0, -1);
        const avg =
          previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
        setOverallHealth(Math.round(avg));
      } else {
        // no past cycles
        setOverallHealth(null);
      }

      // 7️⃣ Next Predicted Period
      const next = new Date(firstDay);
      next.setDate(firstDay.getDate() + 28);
      setNextPeriodDate(next.toDateString());

      // 8️⃣ Summary Text
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
          : "within a normal range"
      }.

Your symptoms indicate normal hormonal variations,
while your emotional balance fluctuated through phases of ${topMood.toLowerCase()}.

💡 To improve your next cycle:
• Maintain hydration  
• Use light stretching or yoga  
• Prioritize sleep  
• Journal or try calming breathing routines  

This summary is based entirely on your daily logs for this cycle.
`;

      setSummaryText(summary);

      // 9️⃣ Save cycle summary to Firestore
      const cycleDocRef = doc(
        db,
        "users",
        user.uid,
        "cycles",
        activeCycleId
      );

      await setDoc(
        cycleDocRef,
        {
          endDate: sortedLogs[sortedLogs.length - 1].date,
          cycleLength: roundedDays,
          nextPredictedDate: next.toDateString(),
          cycleHealthScore: score,
          summaryText: summary,
        },
        { merge: true }
      );

      // 🔟 Mark cycle complete
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

      {/* Overview */}
      <div className="summary-card">
        <h2>Cycle Overview</h2>
        <p>Start Date: {startDate}</p>
        <p>End Date: {endDate}</p>
        <p>Total Days: {cycleLength}</p>
      </div>

      {/* Current Cycle Health */}
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

      {/* ⭐ NEW — Overall Cycle Quality Bar */}
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

      {/* Next Period */}
      <div className="summary-card">
        <h2>Next Expected Period</h2>
        <p>{nextPeriodDate}</p>
      </div>

      {/* Mood Pattern */}
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

      {/* Symptom Pattern */}
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

      {/* Summary Text */}
      <div className="summary-card">
        <h2>Cycle Summary</h2>
        <p style={{ whiteSpace: "pre-line" }}>{summaryText}</p>
      </div>
    </div>
  );
}
