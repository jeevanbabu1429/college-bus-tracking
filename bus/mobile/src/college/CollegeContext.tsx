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
import { collegesApi, type College } from "../api/colleges";

const SELECTED_KEY = "bus.selectedCollegeId";

type CollegeContextValue = {
  colleges: College[] | null;
  selected: College | null;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectCollege: (id: string) => Promise<void>;
};

const CollegeContext = createContext<CollegeContextValue | null>(null);

export function CollegeProvider({ children }: { children: ReactNode }) {
  const [colleges, setColleges] = useState<College[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await collegesApi.list();
      setColleges(list);

      const stored = await SecureStore.getItemAsync(SELECTED_KEY);
      const exists = stored && list.some((c) => c._id === stored);
      if (exists) {
        setSelectedId(stored);
      } else if (list.length > 0) {
        const first = list[0]._id;
        await SecureStore.setItemAsync(SELECTED_KEY, first);
        setSelectedId(first);
      } else {
        await SecureStore.deleteItemAsync(SELECTED_KEY);
        setSelectedId(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectCollege = useCallback(async (id: string) => {
    await SecureStore.setItemAsync(SELECTED_KEY, id);
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
  if (!ctx)
    throw new Error("useColleges must be used within a CollegeProvider");
  return ctx;
}
