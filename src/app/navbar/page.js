"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <nav className="w-full bg-white shadow-md py-4 px-6 flex items-center justify-between fixed top-0 left-0 z-10">
      <h1 className="text-xl font-bold text-pink-600">Period Tracker</h1>

      <div className="flex gap-6 text-sm font-medium">
        <Link href="/">Home</Link>
        <button onClick={handleLogout} className="text-red-500">
          Logout
        </button>
      </div>
    </nav>
  );
}
