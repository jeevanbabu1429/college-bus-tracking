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
  staffAuthApi,
  type CollegeChoice,
  type StaffProfile,
} from "../api/staffAuth";
import { ApiError } from "../api/client";
import {
  clearPersistedAuth,
  loadPersistedSession,
  loadPersistedToken,
  persistSession,
  persistTokenAndSession,
  setCurrentToken,
} from "./tokenStore";

export type AdminSession = { role: "admin"; admin: Admin };
/** A staff member signed in under a role their admin defined. */
export type StaffSession = { role: "staff"; staff: StaffProfile };
export type Session = AdminSession | StaffSession;

type AuthState = {
  ready: boolean;
  token: string | null;
  session: Session | null;
};

type AuthContextValue = AuthState & {
  register: (input: RegisterInput) => Promise<Admin>;
  refreshAdmin: () => Promise<Admin | null>;
  requestOtp: (mobile: string) => Promise<void>;
  /** Resolves to college choices when the mobile is staff at more than one. */
  verifyOtp: (mobile: string, otp: string) => Promise<CollegeChoice[] | null>;
  chooseCollege: (
    mobile: string,
    otp: string,
    staffId: string
  ) => Promise<void>;
  updateAdmin: (input: RegisterInput) => Promise<Admin>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Display name for whoever is signed in, admin or staff. */
export function sessionName(session: Session | null): string {
  if (!session) return "";
  return session.role === "admin" ? session.admin.name : session.staff.name;
}

/** The admin record, or null when a staff member is signed in. */
export function sessionAdmin(session: Session | null) {
  return session?.role === "admin" ? session.admin : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    session: null,
  });

  useEffect(() => {
    const token = loadPersistedToken();
    const session = loadPersistedSession<Session>();
    setCurrentToken(token);
    setState({
      ready: true,
      token,
      session:
        session && (session.role === "admin" || session.role === "staff")
          ? session
          : null,
    });
  }, []);

  // Which table the OTP was sent to, so verify hits the matching endpoint.
  const [kind, setKind] = useState<"admin" | "staff">("admin");

  const finishStaff = useCallback(
    async (result: Awaited<ReturnType<typeof staffAuthApi.verifyOtp>>) => {
      if ("needsCollege" in result && result.needsCollege) {
        return result.options as CollegeChoice[];
      }
      const { token, staff } = result as { token: string; staff: StaffProfile };
      const session: StaffSession = { role: "staff", staff };
      persistTokenAndSession(token, session);
      setCurrentToken(token);
      setState({ ready: true, token, session });
      return null;
    },
    []
  );

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

  // One login box for both kinds of user. The admin table is tried first and
  // staff second, so nobody has to know which sort of account they hold — and
  // a wrong guess costs one extra request, not a confusing error.
  const requestOtp = useCallback(async (mobile: string) => {
    try {
      await authApi.requestOtp(mobile);
      setKind("admin");
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      await staffAuthApi.requestOtp(mobile);
      setKind("staff");
    }
  }, []);

  const verifyOtp = useCallback(
    async (mobile: string, otp: string) => {
      if (kind === "staff") {
        return finishStaff(await staffAuthApi.verifyOtp(mobile, otp));
      }
      const { token, admin } = await authApi.verifyOtp(mobile, otp);
      const session: AdminSession = { role: "admin", admin };
      persistTokenAndSession(token, session);
      setCurrentToken(token);
      setState({ ready: true, token, session });
      return null;
    },
    [kind, finishStaff]
  );

  /** Second step for a mobile that is staff at more than one college. */
  const chooseCollege = useCallback(
    async (mobile: string, otp: string, staffId: string) => {
      await finishStaff(await staffAuthApi.verifyOtp(mobile, otp, staffId));
    },
    [finishStaff]
  );

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
      chooseCollege,
      updateAdmin,
      logout,
    }),
    [
      state,
      register,
      refreshAdmin,
      requestOtp,
      verifyOtp,
      chooseCollege,
      updateAdmin,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
