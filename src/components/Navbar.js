"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };
  const handleGenerateReport = async () => {
  try {
    if (!user) return;

    // Fetch cycles from Firestore
    const cyclesRef = collection(db, "users", user.uid, "cycles");

    const snapshot = await getDocs(cyclesRef);

    const cycles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Send to PDF API
    const res = await fetch("/api/generateReport", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appName: "Period Track",
        cycles,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to generate report");
    }

    // Download PDF
    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "cycle_report.pdf";

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);

  } catch (err) {
    console.error(err);
    alert("Failed to generate report.");
  }
};

  return (
    <nav className="navbar">
      <div className="nav-container">

        <div className="nav-left">
          <img src="/logo_period_tracking.jpg" alt="Logo" className="nav-logo-img" />
          <h1 className="nav-logo-text">Period Track</h1>
        </div>

        <div className="nav-right">
          <Link href="/about" className="nav-link">About</Link>
          <Link href="/" className="nav-link">Home</Link>
          {user && <Link href="/history" className="nav-link">History</Link>}
          {user && (
  <>
   

    <button
  onClick={handleGenerateReport}
  className="nav-btn generate-report-trigger"
>
  Generate Report
</button>
  </>
)}

          {user ? (
            <button onClick={handleLogout} className="nav-btn logout-btn">Logout</button>
          ) : (
            <>
              <Link href="/login" className="nav-btn login-btn">Login</Link>
              <Link href="/signup" className="nav-btn signup-btn">Signup</Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
