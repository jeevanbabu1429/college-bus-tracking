"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth/AuthContext";

export default function Home() {
  const router = useRouter();
  const { ready, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [ready, token, router]);

  return (
    <div className="center" style={{ minHeight: "100vh" }}>
      <span className="spinner" />
    </div>
  );
}
