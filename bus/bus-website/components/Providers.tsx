"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth/AuthContext";
import { CollegeProvider } from "../lib/college/CollegeContext";
import { FcmManager } from "./FcmManager";
import { BannerModal } from "./BannerModal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CollegeProvider>
        {children}
        <FcmManager />
        <BannerModal />
      </CollegeProvider>
    </AuthProvider>
  );
}
