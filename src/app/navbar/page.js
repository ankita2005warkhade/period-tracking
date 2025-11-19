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

        {/* LEFT SIDE */}
        <div className="nav-left">
          <h1 className="nav-logo">Period Tracker</h1>
        </div>

        {/* RIGHT SIDE */}
        <div className="nav-right">
          <Link href="/about" className="nav-link">About</Link>

          {user ? (
            <button onClick={handleLogout} className="nav-btn logout-btn">
              Logout
            </button>
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
