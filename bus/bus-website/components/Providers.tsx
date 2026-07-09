"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth/AuthContext";
import { CollegeProvider } from "../lib/college/CollegeContext";
import { FcmManager } from "./FcmManager";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CollegeProvider>
        {children}
        <FcmManager />
      </CollegeProvider>
    </AuthProvider>
  );
}
