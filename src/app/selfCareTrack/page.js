"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SelfCarePage() {
  const router = useRouter();

  const selfCareOptions = [
    "Yoga",
    "Meditation",
    "Warm Bath",
    "Healthy Meal",
    "Rest",
    "Walk",
    "Skin Care",
  ];

  const [selectedSelfCare, setSelectedSelfCare] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const toggleSelfCare = (item) => {
    setSelectedSelfCare((prev) =>
      prev.includes(item)
        ? prev.filter((x) => x !== item)
        : [...prev, item]
    );
  };

  const saveSelfCare = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const latestRef = doc(db, "users", user.uid, "appState", "latestState");
    const latestSnap = await getDoc(latestRef);

    if (!latestSnap.exists()) {
      setError("No active cycle found.");
      return;
    }

    const { activeCycleId, lastLoggedDate } = latestSnap.data();

    if (!activeCycleId || !lastLoggedDate) {
      setError("No day logged yet.");
      return;
    }

    const logRef = doc(
      db,
      "users",
      user.uid,
      "cycles",
      activeCycleId,
      "dailyLogs",
      lastLoggedDate
    );

    await setDoc(
      logRef,
      {
        selfCare: selectedSelfCare,
        selfCareNote: note,
      },
      { merge: true }
    );

    alert("Self-care saved!");
    router.push("/symptoms");
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">
        <h1 className="symptoms-title">Self-Care Tracking</h1>

        <h3 className="section-title">Choose Activities</h3>

        <div className="selfcare-grid">
          {selfCareOptions.map((item) => (
            <button
              key={item}
              className={`selfcare-btn ${
                selectedSelfCare.includes(item) ? "selfcare-selected" : ""
              }`}
              onClick={() => toggleSelfCare(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <h3 className="section-title">Notes</h3>
        <textarea
          className="note-input"
          placeholder="Write any self-care note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        ></textarea>

        <button className="primary-btn" onClick={saveSelfCare}>
          Save Self-Care
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
