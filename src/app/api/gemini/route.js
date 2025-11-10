"use client";
import { useRouter } from "next/navigation";

export default function Example() {
  const router = useRouter();

  const handleClick = () => {
    router.push("/login"); // Navigate to login
  };

  return <button onClick={handleClick}>Go to Login</button>;
}
