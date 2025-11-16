"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LogPeriodPage() {
  const [periodDate, setPeriodDate] = useState("");
  const router = useRouter();

  const handleSave = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!periodDate) {
      alert("Please select a date!");
      return;
    }

    try {
      const id = new Date().getTime().toString();

      await setDoc(doc(db, "users", user.uid, "periods", id), {
        startDate: periodDate,
        createdAt: serverTimestamp(),
      });

      alert("Date saved successfully!");
      router.push("/symptoms");
    } catch (err) {
      console.error("Error saving date:", err);
    }
  };

  return (
    <div className="logperiod-container">
      <div className="logperiod-card">
        <h1 className="logperiod-title">Log Your Period Start Date</h1>

        <input
          type="date"
          value={periodDate}
          onChange={(e) => setPeriodDate(e.target.value)}
          className="logperiod-date-input"
        />

        <button className="logperiod-btn" onClick={handleSave}>
          Save Date
        </button>
      </div>
    </div>
  );
}
