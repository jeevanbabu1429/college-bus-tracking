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
import { collegesApi, type College } from "../api/colleges";
import { useAuth } from "../auth/AuthContext";

const SELECTED_KEY = "bus.selectedCollegeId";

type CollegeContextValue = {
  colleges: College[] | null;
  selected: College | null;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectCollege: (id: string) => void;
};

const CollegeContext = createContext<CollegeContextValue | null>(null);

export function CollegeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [colleges, setColleges] = useState<College[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await collegesApi.list();
      setColleges(list);

      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(SELECTED_KEY)
          : null;
      const exists = stored && list.some((c) => c._id === stored);
      if (exists) {
        setSelectedId(stored);
      } else if (list.length > 0) {
        const first = list[0]._id;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SELECTED_KEY, first);
        }
        setSelectedId(first);
      } else {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SELECTED_KEY);
        }
        setSelectedId(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
    else {
      setColleges(null);
      setSelectedId(null);
    }
  }, [token, refresh]);

  const selectCollege = useCallback((id: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_KEY, id);
    }
    setSelectedId(id);
  }, []);

  const value = useMemo<CollegeContextValue>(() => {
    const selected = colleges?.find((c) => c._id === selectedId) ?? null;
    return {
      colleges,
      selected,
      selectedId,
      loading,
      error,
      refresh,
      selectCollege,
    };
  }, [colleges, selectedId, loading, error, refresh, selectCollege]);

  return (
    <CollegeContext.Provider value={value}>{children}</CollegeContext.Provider>
  );
}

export function useColleges(): CollegeContextValue {
  const ctx = useContext(CollegeContext);
  if (!ctx) throw new Error("useColleges must be used within a CollegeProvider");
  return ctx;
}
