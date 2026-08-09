"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, type Admin, type RegisterInput } from "../api/auth";
import {
  clearPersistedAuth,
  loadPersistedSession,
  loadPersistedToken,
  persistSession,
  persistTokenAndSession,
  setCurrentToken,
} from "./tokenStore";

export type AdminSession = { role: "admin"; admin: Admin };

type AuthState = {
  ready: boolean;
  token: string | null;
  session: AdminSession | null;
};

type AuthContextValue = AuthState & {
  register: (input: RegisterInput) => Promise<Admin>;
  refreshAdmin: () => Promise<Admin | null>;
  requestOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  updateAdmin: (input: RegisterInput) => Promise<Admin>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    session: null,
  });

  useEffect(() => {
    const token = loadPersistedToken();
    const session = loadPersistedSession<AdminSession>();
    setCurrentToken(token);
    setState({
      ready: true,
      token,
      session: session && session.role === "admin" ? session : null,
    });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    // Auto-login: persist exactly like verifyOtp so the caller can navigate
    // straight to the dashboard.
    const { token, admin } = await authApi.register(input);
    const session: AdminSession = { role: "admin", admin };
    persistTokenAndSession(token, session);
    setCurrentToken(token);
    setState({ ready: true, token, session });
    return admin;
  }, []);

  // Re-reads the admin from the API and updates the cached session. The
  // pending-verification screen polls this so approval is picked up without
  // making the admin sign out and back in.
  const refreshAdmin = useCallback(async () => {
    try {
      const { admin } = await authApi.me();
      const session: AdminSession = { role: "admin", admin };
      persistSession(session);
      setState((s) => ({ ...s, session }));
      return admin;
    } catch {
      // Transient failure — keep the session we already have.
      return null;
    }
  }, []);

  const requestOtp = useCallback(async (mobile: string) => {
    await authApi.requestOtp(mobile);
  }, []);

  const verifyOtp = useCallback(async (mobile: string, otp: string) => {
    const { token, admin } = await authApi.verifyOtp(mobile, otp);
    const session: AdminSession = { role: "admin", admin };
    persistTokenAndSession(token, session);
    setCurrentToken(token);
    setState({ ready: true, token, session });
  }, []);

  const updateAdmin = useCallback(async (input: RegisterInput) => {
    const { admin } = await authApi.updateMe(input);
    const session: AdminSession = { role: "admin", admin };
    persistSession(session);
    setState((s) => ({ ...s, session }));
    return admin;
  }, []);

  const logout = useCallback(() => {
    clearPersistedAuth();
    setCurrentToken(null);
    setState({ ready: true, token: null, session: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      register,
      refreshAdmin,
      requestOtp,
      verifyOtp,
      updateAdmin,
      logout,
    }),
    [state, register, refreshAdmin, requestOtp, verifyOtp, updateAdmin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
