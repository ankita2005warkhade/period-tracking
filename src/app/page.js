"use client";

import { useEffect } from "react";
import Navbar from "./navbar/page";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function HomePage() {
  const router = useRouter();

  // ⭐ Handles logic for starting OR continuing cycle
  const handlePeriodTrack = async () => {
    const user = auth.currentUser;

    // If not logged in — redirect to login
    if (!user) {
      router.push("/login");
      return;
    }

    // Check latestState
    const latestRef = doc(db, "users", user.uid, "appState", "latestState");
    const latestSnap = await getDoc(latestRef);

    if (!latestSnap.exists()) {
      // No cycle started yet → Log Period Start
      router.push("/log-period");
      return;
    }

    const data = latestSnap.data();

    // If cycle is NOT active → start new cycle
    if (!data.isCycleRunning || !data.activeCycleId) {
      router.push("/log-period");
      return;
    }

    // ⚡ Active cycle exists → continue symptoms logging
    router.push("/symptoms");
  };

  return (
    <div className="dashboard-container homepage-bg">

      {/* Navbar */}
      <Navbar />

      {/* MAIN HERO SECTION */}
      <div className="home-main-wrapper">
        
        {/* LEFT SIDE TEXT */}
        <div className="home-left">
          <h1 className="hero-title">Stay in Sync With Your Cycle 💗</h1>

          <p className="hero-subtitle">
            Welcome! Track your periods effortlessly, understand your body,
            and take charge of your wellbeing with clarity and confidence.
          </p>
        </div>

        {/* RIGHT SIDE IMAGE + BUTTON */}
        <div className="home-right">
          <div className="hero-image-container">
            <Image
              src="/period-illustration.jpg"
              alt="Period Tracker Illustration"
              width={450}
              height={350}
              className="hero-image"
            />
          </div>

          {/* ⭐ UPDATE: Smart Button (Start or Continue Cycle) */}
          <div className="dashboard-card home-log-btn" onClick={handlePeriodTrack}>
            <h2 className="dashboard-card-title">
              Track Your Period
            </h2>
          </div>

        </div>

      </div>
    </div>
  );
}
