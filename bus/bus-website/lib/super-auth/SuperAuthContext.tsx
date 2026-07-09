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
import { superAdminApi, type SuperAdmin } from "../api/superAdmin";
import {
  clearPersistedSuperAuth,
  loadPersistedSuperSession,
  loadPersistedSuperToken,
  persistSuperSession,
  persistSuperTokenAndSession,
  setCurrentSuperToken,
} from "./superTokenStore";

export type SuperSession = { role: "super"; superAdmin: SuperAdmin };

type State = {
  ready: boolean;
  token: string | null;
  session: SuperSession | null;
};

type ContextValue = State & {
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
};

const SuperAuthContext = createContext<ContextValue | null>(null);

export function SuperAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    ready: false,
    token: null,
    session: null,
  });

  useEffect(() => {
    const token = loadPersistedSuperToken();
    const session = loadPersistedSuperSession<SuperSession>();
    setCurrentSuperToken(token);
    setState({
      ready: true,
      token,
      session: session && session.role === "super" ? session : null,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, superAdmin } = await superAdminApi.login(email, password);
    const session: SuperSession = { role: "super", superAdmin };
    persistSuperTokenAndSession(token, session);
    setCurrentSuperToken(token);
    setState({ ready: true, token, session });
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await superAdminApi.changePassword(currentPassword, newPassword);
      // Backend keeps the same session valid; nothing to persist here.
    },
    []
  );

  const logout = useCallback(() => {
    clearPersistedSuperAuth();
    setCurrentSuperToken(null);
    setState({ ready: true, token: null, session: null });
  }, []);

  const value = useMemo<ContextValue>(
    () => ({ ...state, login, changePassword, logout }),
    [state, login, changePassword, logout]
  );

  return (
    <SuperAuthContext.Provider value={value}>
      {children}
    </SuperAuthContext.Provider>
  );
}

export function useSuperAuth(): ContextValue {
  const ctx = useContext(SuperAuthContext);
  if (!ctx) {
    throw new Error("useSuperAuth must be used within a SuperAuthProvider");
  }
  return ctx;
}
