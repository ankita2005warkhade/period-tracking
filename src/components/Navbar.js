"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
