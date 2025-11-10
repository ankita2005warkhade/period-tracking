"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // 👈 prevent multiple re-renders

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ✅ Create user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // ✅ Set display name (optional)
      await updateProfile(userCredential.user, { displayName: name });

      // ✅ Redirect to login
      router.push("/login");
    } catch (err) {
      console.error("Signup failed:", err);
      setError("Signup failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Create Your Account</h2>

      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label>Full Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      <p className="redirect-text">
        Already have an account? <a href="/login">Login now</a>
      </p>
    </div>
  );
}
