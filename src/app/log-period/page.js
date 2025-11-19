"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LogPeriodPage() {
  const [periodDate, setPeriodDate] = useState("");
  const router = useRouter();

  const handleStartCycle = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!periodDate) {
      alert("Please select a start date!");
      return;
    }

    try {
      // Create a new cycle under /users/uid/cycles
      const cycleRef = collection(db, "users", user.uid, "cycles");

      const newCycle = {
        startDate: periodDate,
        endDate: null,
        cycleLength: null,
        gapFromPreviousCycle: null,
        nextPredictedDate: null,
        cycleHealthScore: null,
        summaryText: "",
        createdAt: serverTimestamp(),
      };

      // Create cycleId automatically
      const cycleDoc = await addDoc(cycleRef, newCycle);
      const cycleId = cycleDoc.id;

      // Update latestState to track the active cycle
      await setDoc(
        doc(db, "users", user.uid, "appState", "latestState"),

        {
          activeCycleId: cycleId,
          lastLoggedDate: periodDate,
          isCycleRunning: true,
        },
        { merge: true }
      );

      alert("Cycle started successfully!");
      router.push("/symptoms");

    } catch (error) {
      console.error("❌ Error starting cycle:", error);
      alert("Something went wrong.");
    }
  };

  return (
    <div className="logperiod-container">
      <div className="logperiod-card">
        <h1 className="logperiod-title">Start Your Period Cycle</h1>

        <input
          type="date"
          value={periodDate}
          onChange={(e) => setPeriodDate(e.target.value)}
          className="logperiod-date-input"
        />

        <button className="logperiod-btn" onClick={handleStartCycle}>
          Start Cycle
        </button>
      </div>
    </div>
  );
}
