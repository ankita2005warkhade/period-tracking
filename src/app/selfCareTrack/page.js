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

  // ---------------- SELF CARE OPTIONS ----------------
  const selfCareOptions = [
    "Yoga",
    "Meditation",
    "Warm Bath",
    "Healthy Meal",
    "Rest",
    "Walk",
    "Skin Care",
  ];

  // ---------------- ENERGY LEVELS ----------------
  const energyOptions = [
    "Low",
    "Normal",
    "High",
  ];

  // ---------------- STATES ----------------

  // Self-care activities
  const [selectedSelfCare, setSelectedSelfCare] = useState([]);

  // Water intake
  const [waterIntake, setWaterIntake] = useState(0);

  // Sleep
  const [sleepHours, setSleepHours] = useState("");

  // Energy
  const [energyLevel, setEnergyLevel] = useState("");

  // Exercise
  const [exerciseMinutes, setExerciseMinutes] = useState("");

  // Meditation Timer
  const [meditationMinutes, setMeditationMinutes] = useState(5);

  const [timerRunning, setTimerRunning] = useState(false);

  const [timeLeft, setTimeLeft] = useState(300);

  // Notes
  const [note, setNote] = useState("");

  // Error
  const [error, setError] = useState("");

  // ---------------- TOGGLE SELF CARE ----------------

  const toggleSelfCare = (item) => {

    setSelectedSelfCare((prev) =>
      prev.includes(item)
        ? prev.filter((x) => x !== item)
        : [...prev, item]
    );
  };

  // ---------------- MEDITATION TIMER ----------------

  const startMeditationTimer = () => {

    if (timerRunning) return;

    setTimerRunning(true);

    const totalSeconds = meditationMinutes * 60;

    setTimeLeft(totalSeconds);

    const interval = setInterval(() => {

      setTimeLeft((prev) => {

        if (prev <= 1) {

          clearInterval(interval);

          setTimerRunning(false);

          alert("Meditation session completed 🌸");

          return 0;
        }

        return prev - 1;
      });

    }, 1000);
  };

  // ---------------- SAVE SELF CARE ----------------

  const saveSelfCare = async () => {

    try {

      const user = auth.currentUser;

      if (!user) {
        setError("Please login first.");
        return;
      }

      // Get latest cycle state
      const latestRef = doc(
        db,
        "users",
        user.uid,
        "appState",
        "latestState"
      );

      const latestSnap = await getDoc(latestRef);

      if (!latestSnap.exists()) {
        setError("No active cycle found.");
        return;
      }

      const { activeCycleId, lastLoggedDate } =
        latestSnap.data();

      if (!activeCycleId || !lastLoggedDate) {
        setError("No day logged yet.");
        return;
      }

      // Daily log reference
      const logRef = doc(
        db,
        "users",
        user.uid,
        "cycles",
        activeCycleId,
        "dailyLogs",
        lastLoggedDate
      );

      // SAVE EVERYTHING
      await setDoc(
        logRef,
        {
          selfCare: selectedSelfCare,

          selfCareNote: note,

          waterIntake,

          sleepHours,

          energyLevel,

          exerciseMinutes,

          meditationMinutes,
        },
        { merge: true }
      );

      alert("Self-care saved successfully 💕");

      router.push("/symptoms");

    } catch (err) {

      console.error(err);

      setError("Failed to save self-care.");
    }
  };

  // ---------------- UI ----------------

  return (
    <div className="symptoms-container">

      <div className="symptoms-card">

        <h1 className="symptoms-title">
          Self-Care & Wellness 🌸
        </h1>

        {/* ---------------- SELF CARE ACTIVITIES ---------------- */}

        <h3 className="section-title">
          Self-Care Activities
        </h3>

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

        {/* ---------------- WATER TRACKER ---------------- */}

        <h3 className="section-title">
          Water Intake 💧
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "20px",
          }}
        >

          <button
            className="selfcare-btn"
            onClick={() =>
              setWaterIntake((prev) =>
                Math.max(prev - 1, 0)
              )
            }
          >
            -
          </button>

          <span style={{ fontSize: "18px" }}>
            {waterIntake} Glasses
          </span>

          <button
            className="selfcare-btn"
            onClick={() =>
              setWaterIntake((prev) => prev + 1)
            }
          >
            +
          </button>

        </div>

        {/* ---------------- SLEEP TRACKER ---------------- */}

        <h3 className="section-title">
          Sleep Hours 😴
        </h3>

        <input
          type="number"
          className="note-input"
          placeholder="Enter sleep hours"
          value={sleepHours}
          onChange={(e) =>
            setSleepHours(e.target.value)
          }
        />

        {/* ---------------- ENERGY LEVEL ---------------- */}

        <h3
          className="section-title"
          style={{ marginTop: "20px" }}
        >
          Energy Level ⚡
        </h3>

        <div className="selfcare-grid">

          {energyOptions.map((level) => (

            <button
              key={level}
              className={`selfcare-btn ${
                energyLevel === level
                  ? "selfcare-selected"
                  : ""
              }`}
              onClick={() =>
                setEnergyLevel(level)
              }
            >
              {level}
            </button>

          ))}

        </div>

        {/* ---------------- EXERCISE TRACKER ---------------- */}

        <h3
          className="section-title"
          style={{ marginTop: "20px" }}
        >
          Exercise Duration 🧘
        </h3>

        <input
          type="number"
          className="note-input"
          placeholder="Exercise minutes"
          value={exerciseMinutes}
          onChange={(e) =>
            setExerciseMinutes(e.target.value)
          }
        />

        {/* ---------------- MEDITATION TIMER ---------------- */}

        <h3
          className="section-title"
          style={{ marginTop: "20px" }}
        >
          Meditation Timer 🌸
        </h3>

        <select
          className="note-input"
          value={meditationMinutes}
          onChange={(e) =>
            setMeditationMinutes(
              Number(e.target.value)
            )
          }
        >
          <option value={5}>5 Minutes</option>
          <option value={10}>10 Minutes</option>
          <option value={15}>15 Minutes</option>
        </select>

        <button
          className="primary-btn"
          onClick={startMeditationTimer}
          style={{ marginTop: "10px" }}
        >
          Start Meditation
        </button>

        <p style={{ marginTop: "10px" }}>

          Time Left:{" "}

          {Math.floor(timeLeft / 60)}:

          {String(timeLeft % 60).padStart(2, "0")}

        </p>

        {/* ---------------- NOTES ---------------- */}

        <h3
          className="section-title"
          style={{ marginTop: "20px" }}
        >
          Notes 📝
        </h3>

        <textarea
          className="note-input"
          placeholder="Write any self-care note..."
          value={note}
          onChange={(e) =>
            setNote(e.target.value)
          }
        />

        {/* ---------------- SAVE BUTTON ---------------- */}

        <button
          className="primary-btn"
          onClick={saveSelfCare}
          style={{ marginTop: "20px" }}
        >
          Save Self-Care
        </button>

        {/* ---------------- ERROR ---------------- */}

        {error && (
          <p
            style={{
              color: "red",
              marginTop: "15px",
            }}
          >
            {error}
          </p>
        )}

      </div>
    </div>
  );
}