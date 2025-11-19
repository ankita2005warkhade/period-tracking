"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SelfCarePage() {
  const router = useRouter();

  const selfCareOptions = [
    "Yoga",
    "Meditation",
    "Warm Bath",
    "Healthy Meal",
    "Rest",
  ];

  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedSelfCare, setSelectedSelfCare] = useState([]);
  const [note, setNote] = useState("");

  const [activeCycleId, setActiveCycleId] = useState(null);
  const [lastLoggedDate, setLastLoggedDate] = useState(null);

  // Fetch cycle state
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;

      const latestRef = doc(db, "users", user.uid, "appState", "latestState");
      const snap = await getDoc(latestRef);

      const data = snap.data();
      setActiveCycleId(data.activeCycleId);
      setLastLoggedDate(data.lastLoggedDate);
    };

    load();
  }, []);

  const toggleSelfCare = (item) => {
    setSelectedSelfCare((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const saveSelfCare = async () => {
    const user = auth.currentUser;
    const dateId = lastLoggedDate;

    const logRef = doc(
      db,
      "users",
      user.uid,
      "cycles",
      activeCycleId,
      "dailyLogs",
      dateId
    );

    await setDoc(
      logRef,
      {
        waterIntake,
        selfCare: selectedSelfCare,
        note,
      },
      { merge: true }
    );

    alert("Saved successfully!");
    router.push("/dashboard");
  };

  return (
    <div className="symptoms-container">
      <div className="symptoms-card">

        <h1 className="symptoms-title">Self-Care & Daily Wellness</h1>

        {/* Water Intake */}
        <h3 className="section-title">Water Intake</h3>
        <div className="water-counter">
          <button
            className="water-btn"
            onClick={() => setWaterIntake((w) => Math.max(0, w - 1))}
          >
            -
          </button>

          <span className="water-number">{waterIntake} glasses</span>

          <button
            className="water-btn"
            onClick={() => setWaterIntake((w) => w + 1)}
          >
            +
          </button>
        </div>

        {/* Self-care */}
        <h3 className="section-title">Self-Care</h3>
        <div className="selfcare-grid">
          {selfCareOptions.map((item) => (
            <button
              key={item}
              className={`selfcare-btn ${
                selectedSelfCare.includes(item)
                  ? "selfcare-selected"
                  : ""
              }`}
              onClick={() => toggleSelfCare(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Note */}
        <h3 className="section-title">Note</h3>
        <textarea
          className="note-input"
          placeholder="Write any notes here..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        ></textarea>

        {/* Save */}
        <button className="primary-btn" onClick={saveSelfCare}>
          Save & Finish Day
        </button>

      </div>
    </div>
  );
}
