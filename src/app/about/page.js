export default function AboutPage() {
  return (
    <div className="about-container">
      <h1 className="about-title">About Period Track</h1>

      <p className="about-text">
        Period Track is a simple and user-friendly application designed to help
        women understand their menstrual cycle better. With this app, users can
        easily log their daily symptoms, mood, water intake, and personal notes.
      </p>

      <p className="about-text">
        The app also provides AI-based daily insights that help users understand
        their body changes in a clear and comforting way. It supports users in
        taking care of their physical and emotional well-being throughout their cycle.
      </p>

      <p className="about-text">
        Period Track also offers features like cycle history, downloadable reports,
        and a smart prediction system to help users stay in control of their health.
        Our goal is to make period tracking simple, smart, and supportive.
      </p>

      <p className="about-text">
        This application is built using Next.js, Firebase, and integrated AI models
        to deliver a smooth, accurate, and personalized experience.
      </p>

      {/* ---------------- TEAM SECTION ---------------- */}
      <div className="about-team">
        <h2 className="team-title">Our Team</h2>

        <p className="team-text">
          Period Track is developed by a dedicated student team focused on building
          meaningful and user-friendly health solutions.
        </p>

        <ul className="team-list">
          <li><strong>Ankita Warkhade</strong> — Full Stack Developer</li>
          <li><strong>Sayali Khupse</strong> — Backend & Database Integration</li>
          <li><strong>Anushri Bhangle</strong> — UI/UX Design & Frontend Styling</li>
          <li><strong>Megha Biradar</strong> — Testing & Documentation</li>
        </ul>
      </div>

    </div>
  );
}
