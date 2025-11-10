"use client";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [userEmail, setUserEmail] = useState("");

  // This runs when page opens
  useEffect(() => {
    const user = auth.currentUser; // Check if user is logged in
    if (user) {
      setUserEmail(user.email); // Show user's email on the page
    } else {
      // If user is not logged in, go back to login page
      window.location.href = "/login";
    }
  }, []);

  // Function to logout
  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out from Firebase
      alert("You have logged out!");
      window.location.href = "/login"; // Go back to login page
    } catch (error) {
      alert("Error logging out: " + error.message);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome, {userEmail || "User"} 👋</h1>
      <p>You are logged in successfully.</p>
      <button onClick={handleLogout} style={{ marginTop: "20px" }}>
        Logout
      </button>
    </div>
  );
}
