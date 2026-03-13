import React from "react";
import { apiFetch } from "../../utility/apiClient";
import type { Patient } from "../../types/models";

const PER_PAGE = 30;

function useDebouncedValue<T>(value: T, delay = 100) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface UsePatientListOptions {
  initialPatients?: Patient[];
  initialQuery?: string;
  initialHasMore?: boolean;
  skipInitialFetch?: boolean;
}

function mapApiPatient(r: Record<string, unknown>): Patient {
  return {
    id: String(r["id"] ?? ""),
    fio: String(r["fullName"] ?? ""),
    phone: (r["phone"] as string) ?? undefined,
    inn: (r["inn"] as string) ?? null,
    photo: (r["photoUrl"] as string) ?? undefined,
    birth_date: (r["birthDate"] as string) ?? undefined,
    is_blacklisted: (r["isBlacklisted"] as boolean) ?? false,
    blacklist_reason: (r["blacklistReason"] as string) ?? null,
  };
}

/**
 * Управляет списком пациентов: поиск и бесконечная прокрутка через /api/v1/children/
 */
export function usePatientList(options?: UsePatientListOptions) {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [patients, setPatients] = React.useState<Patient[]>(options?.initialPatients ?? []);
  const [query, setQuery] = React.useState(options?.initialQuery ?? "");
  const debouncedQuery = useDebouncedValue(query, 400);
  const [hasMore, setHasMore] = React.useState(options?.initialHasMore ?? true);
  const skipInitialFetchRef = React.useRef(options?.skipInitialFetch ?? false);

  const abortRef = React.useRef<AbortController | null>(null);
  const inFlightRef = React.useRef(false);

  const fetchChunk = React.useCallback(async (page: number, q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    inFlightRef.current = true;
    setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({
        page_size: String(PER_PAGE),
        page: String(page + 1),
      });
      if (q.trim()) params.set("search", q.trim());

      const res: any = await apiFetch(`/api/v1/children/?${params.toString()}`);
      if (ctrl.signal.aborted) return;

      const results: Record<string, unknown>[] = res?.data?.results ?? res?.results ?? [];
      const mapped = results.map(mapApiPatient).filter((p) => p.id);
      const count: number = res?.data?.count ?? res?.count ?? 0;

      setPatients((prev) => (page === 0 ? mapped : [...prev, ...mapped]));
      setHasMore((page + 1) * PER_PAGE < count);
    } catch (e: any) {
      if (ctrl.signal.aborted || e?.name === "AbortError") return;
      console.error(e);
      setErrorMsg(e?.message ?? String(e));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  const currentPageRef = React.useRef(0);

  const loadMore = React.useCallback(() => {
    if (loading || !hasMore || inFlightRef.current) return;
    currentPageRef.current += 1;
    void fetchChunk(currentPageRef.current, debouncedQuery);
  }, [loading, hasMore, debouncedQuery, fetchChunk]);

  const reload = React.useCallback(() => {
    currentPageRef.current = 0;
    setPatients([]);
    setHasMore(true);
    setErrorMsg(null);
    void fetchChunk(0, debouncedQuery);
  }, [debouncedQuery, fetchChunk]);

  // Сброс и первичная загрузка при изменении поискового запроса
  React.useEffect(() => {
    if (skipInitialFetchRef.current && patients.length > 0) {
      skipInitialFetchRef.current = false;
      return;
    }
    currentPageRef.current = 0;
    setPatients([]);
    setHasMore(true);
    setErrorMsg(null);
    void fetchChunk(0, debouncedQuery);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, fetchChunk]);

  // Быстрое добавление пациента через API
  const addPatient = React.useCallback(
    async (fioRaw: string, phoneRaw?: string | null) => {
      const fio = fioRaw.trim();
      const phone = (phoneRaw ?? "").trim() || null;

      await apiFetch("/api/v1/children/", {
        method: "POST",
        body: JSON.stringify({ fullName: fio, phone }),
      });

      reload();
    },
    [reload]
  );

  return {
    loading,
    errorMsg,
    patients,
    query,
    setQuery,
    hasMore,
    loadMore,
    addPatient,
    reload,
    PER_PAGE,
  };
}
