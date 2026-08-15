import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { authApi, type Admin, type RegisterInput } from "../api/auth";
import { driverAuthApi } from "../api/driverAuth";
import { studentAuthApi } from "../api/studentAuth";
import type { Driver } from "../api/collegeDrivers";
import type { Student } from "../api/collegeStudents";
import { setCurrentToken } from "./tokenStore";
import { setOnSuspended, setOnUnauthorized } from "../api/client";
import { releaseDeviceToken } from "../notifications/releaseDeviceToken";

const TOKEN_KEY = "bus.authToken";
const SESSION_KEY = "bus.authSession";

export type Session =
  | { role: "admin"; admin: Admin }
  | { role: "driver"; driver: Driver }
  | { role: "student"; student: Student };

type AuthState = {
  ready: boolean;
  token: string | null;
  session: Session | null;
  suspendedMessage: string | null;
  expiredMessage: string | null;
};

type AuthContextValue = AuthState & {
  register: (input: RegisterInput) => Promise<Admin>;
  refreshAdmin: () => Promise<Admin | null>;
  adminRequestOtp: (mobile: string) => Promise<void>;
  adminVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  driverRequestOtp: (mobile: string) => Promise<void>;
  driverVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  studentRequestOtp: (mobile: string) => Promise<void>;
  studentVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateAdmin: (input: RegisterInput) => Promise<Admin>;
  logout: () => Promise<void>;
  clearSuspendedMessage: () => void;
  clearExpiredMessage: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    session: null,
    suspendedMessage: null,
    expiredMessage: null,
  });

  useEffect(() => {
    (async () => {
      const [token, sessionJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(SESSION_KEY),
      ]);
      setCurrentToken(token);
      setState({
        ready: true,
        token,
        session: sessionJson ? (JSON.parse(sessionJson) as Session) : null,
        suspendedMessage: null,
        expiredMessage: null,
      });
    })();
  }, []);

  // Register global handlers that apiFetch calls when the session is
  // invalidated server-side. Both clear the session so RootNavigator flips
  // back to the auth stack; the LoginScreen shows the appropriate message.
  useEffect(() => {
    const clearAndSetMessage = (
      field: "suspendedMessage" | "expiredMessage",
      message: string
    ) => {
      Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(SESSION_KEY),
      ]).catch(() => {
        // best-effort — the in-memory state below is what actually flips the UI
      });
      setCurrentToken(null);
      setState({
        ready: true,
        token: null,
        session: null,
        suspendedMessage: field === "suspendedMessage" ? message : null,
        expiredMessage: field === "expiredMessage" ? message : null,
      });
    };
    setOnSuspended((m) => clearAndSetMessage("suspendedMessage", m));
    setOnUnauthorized((m) => clearAndSetMessage("expiredMessage", m));
    return () => {
      setOnSuspended(null);
      setOnUnauthorized(null);
    };
  }, []);

  const persist = useCallback(async (token: string, session: Session) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)),
    ]);
    setCurrentToken(token);
    setState({
      ready: true,
      token,
      session,
      suspendedMessage: null,
      expiredMessage: null,
    });
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      // Auto-login: persisting here is what flips RootNavigator over to the
      // admin stack, where the pending-verification screen is shown.
      const { token, admin } = await authApi.register(input);
      await persist(token, { role: "admin", admin });
      return admin;
    },
    [persist]
  );

  // Re-reads the admin and updates the cached session. The pending screen
  // polls this so approval lands without a sign out / sign in cycle.
  const refreshAdmin = useCallback(async () => {
    try {
      const { admin } = await authApi.me();
      const next: Session = { role: "admin", admin };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setState((s) => ({ ...s, session: next }));
      return admin;
    } catch {
      // Transient failure — keep the session we already have.
      return null;
    }
  }, []);

  const adminRequestOtp = useCallback(async (mobile: string) => {
    await authApi.requestOtp(mobile);
  }, []);

  const adminVerifyOtp = useCallback(
    async (mobile: string, otp: string) => {
      const { token, admin } = await authApi.verifyOtp(mobile, otp);
      await persist(token, { role: "admin", admin });
    },
    [persist]
  );

  const driverRequestOtp = useCallback(async (mobile: string) => {
    await driverAuthApi.requestOtp(mobile);
  }, []);

  const driverVerifyOtp = useCallback(
    async (mobile: string, otp: string) => {
      const { token, driver } = await driverAuthApi.verifyOtp(mobile, otp);
      await persist(token, { role: "driver", driver });
    },
    [persist]
  );

  const studentRequestOtp = useCallback(async (mobile: string) => {
    await studentAuthApi.requestOtp(mobile);
  }, []);

  const studentVerifyOtp = useCallback(
    async (mobile: string, otp: string) => {
      const { token, student } = await studentAuthApi.verifyOtp(mobile, otp);
      await persist(token, { role: "student", student });
    },
    [persist]
  );

  const updateAdmin = useCallback(async (input: RegisterInput) => {
    const { admin } = await authApi.updateMe(input);
    const next: Session = { role: "admin", admin };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setState((s) => ({ ...s, session: next }));
    return admin;
  }, []);

  const refreshSession = useCallback(async () => {
    if (!state.token || state.session?.role !== "student") return;
    try {
      const student = await studentAuthApi.me();
      const next: Session = { role: "student", student };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setState((s) => ({ ...s, ready: true, token: state.token, session: next }));
    } catch {
      // keep existing session if refresh fails (e.g. transient network)
    }
  }, [state.token, state.session?.role]);

  const logout = useCallback(async () => {
    // Before the session goes, not after: apiFetch reads the bearer
    // synchronously, so releasing the push token once the token store is
    // cleared sends an unauthenticated request that 401s and leaves this
    // phone still registered to the account it just left.
    await releaseDeviceToken();
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_KEY),
    ]);
    setCurrentToken(null);
    setState({
      ready: true,
      token: null,
      session: null,
      suspendedMessage: null,
      expiredMessage: null,
    });
  }, []);

  const clearSuspendedMessage = useCallback(() => {
    setState((s) => ({ ...s, suspendedMessage: null }));
  }, []);

  const clearExpiredMessage = useCallback(() => {
    setState((s) => ({ ...s, expiredMessage: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      register,
      refreshAdmin,
      adminRequestOtp,
      adminVerifyOtp,
      driverRequestOtp,
      driverVerifyOtp,
      studentRequestOtp,
      studentVerifyOtp,
      refreshSession,
      updateAdmin,
      logout,
      clearSuspendedMessage,
      clearExpiredMessage,
    }),
    [
      state,
      register,
      refreshAdmin,
      adminRequestOtp,
      adminVerifyOtp,
      driverRequestOtp,
      driverVerifyOtp,
      studentRequestOtp,
      studentVerifyOtp,
      refreshSession,
      updateAdmin,
      logout,
      clearSuspendedMessage,
      clearExpiredMessage,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
