"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome 🎉</h1>
      <p>You are successfully logged in!</p>
      <Link href="/logout">
        <button style={{ marginTop: "20px", padding: "10px 20px" }}>Logout</button>
      </Link>
    </div>
  );
}
