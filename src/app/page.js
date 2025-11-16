import Navbar from "./navbar/page";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="dashboard-container">

      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <div className="dashboard-hero">
        <h1 className="hero-title">Welcome to Your Period Tracker</h1>
        <p className="hero-subtitle">
          Track your cycle, log your daily symptoms, and get personalized
          insights.
        </p>
      </div>

      {/* Card */}
      <div className="dashboard-card-container">
        <Link href="/log-period">
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Log Your Period Start</h2>
            <p className="dashboard-card-text">
              Begin by adding your period start date to get accurate insights.
            </p>
          </div>
        </Link>
      </div>

    </div>
  );
}
