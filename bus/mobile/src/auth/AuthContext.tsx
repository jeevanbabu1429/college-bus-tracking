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
};

type AuthContextValue = AuthState & {
  register: (input: RegisterInput) => Promise<Admin>;
  adminRequestOtp: (mobile: string) => Promise<void>;
  adminVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  driverRequestOtp: (mobile: string) => Promise<void>;
  driverVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  studentRequestOtp: (mobile: string) => Promise<void>;
  studentVerifyOtp: (mobile: string, otp: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateAdmin: (input: RegisterInput) => Promise<Admin>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    session: null,
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
      });
    })();
  }, []);

  const persist = useCallback(async (token: string, session: Session) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)),
    ]);
    setCurrentToken(token);
    setState({ ready: true, token, session });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { admin } = await authApi.register(input);
    return admin;
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
      setState({ ready: true, token: state.token, session: next });
    } catch {
      // keep existing session if refresh fails (e.g. transient network)
    }
  }, [state.token, state.session?.role]);

  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_KEY),
    ]);
    setCurrentToken(null);
    setState({ ready: true, token: null, session: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      register,
      adminRequestOtp,
      adminVerifyOtp,
      driverRequestOtp,
      driverVerifyOtp,
      studentRequestOtp,
      studentVerifyOtp,
      refreshSession,
      updateAdmin,
      logout,
    }),
    [
      state,
      register,
      adminRequestOtp,
      adminVerifyOtp,
      driverRequestOtp,
      driverVerifyOtp,
      studentRequestOtp,
      studentVerifyOtp,
      refreshSession,
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
