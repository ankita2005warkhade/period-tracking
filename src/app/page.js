import Navbar from "./navbar/page";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
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

          <Link href="/log-period">
            <div className="dashboard-card home-log-btn">
              <h2 className="dashboard-card-title">Log Your Period Date</h2>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
