"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import dynamic from "next/dynamic";
import Navbar from "../navbar/page";
// import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Image from "next/image";

// ⛔ fix hydration error – disable server rendering
const Calendar = dynamic(() => import("react-calendar"), {
  ssr: false,
});

export default function LogPeriodPage() {
  const [periodDate, setPeriodDate] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const router = useRouter();

  const handleStartCycle = async () => {
    const user = auth.currentUser;

    if (!user) return alert("Please login first.");
    if (!periodDate) return alert("Please select a date!");

    try {
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

      const cycleDoc = await addDoc(cycleRef, newCycle);

      await setDoc(
        doc(db, "users", user.uid, "appState", "latestState"),
        {
          activeCycleId: cycleDoc.id,
          lastLoggedDate: periodDate,
          isCycleRunning: true,
        },
        { merge: true }
      );

      alert("Cycle started!");
      router.push("/symptoms");
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  };

  return (
    <div className="logperiod-page enhanced-bg">
      <Navbar />

      {/* Welcome Section */}
      <div className="welcome-box">
        <Image
          src="/cute-calendar.png" 
          alt="Cute calendar girl"
          width={120}
          height={120}
          className="welcome-sticker"
        />
        <h2 className="welcome-text">Hey Beautiful! 💕</h2>
        <p className="welcome-sub">Let’s begin tracking your cycle together.</p>
      </div>

      {/* Calendar Card */}
      <div className="logperiod-wrapper fade-in">
        <div className="logperiod-card pretty-card">
          <h1 className="logperiod-title">Start Your Cycle 💗</h1>
          <p className="logperiod-subtitle">Pick your period’s Day 1</p>

          <Calendar
            onChange={(value) => {
              setCalendarDate(value);
              setPeriodDate(value.toISOString().split("T")[0]);
            }}
            value={calendarDate}
            className="styled-calendar"
          />

          <button className="logperiod-btn" onClick={handleStartCycle}>
            Start Cycle
          </button>
        </div>
      </div>
    </div>
  );
}
