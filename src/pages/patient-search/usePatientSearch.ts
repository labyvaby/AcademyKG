import React from "react";
import { apiFetch, resolveApiUrl } from "../../utility/apiClient";
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

function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  return resolveApiUrl(url) ?? undefined;
}

function mapApiPatient(r: Record<string, unknown>): Patient {
  const photoRaw = (r["photoUrl"] ?? r["photo_url"] ?? r["photo"] ?? r["avatar"] ?? r["image"]) as string | undefined;
  const rawResponsible = r["responsiblePersons"] ?? r["responsible_persons"];
  const responsiblePersons = Array.isArray(rawResponsible)
    ? (rawResponsible as any[]).map((p) => ({
        fullName: String(p.fullName ?? p.full_name ?? ""),
        phone: String(p.phone ?? ""),
      }))
    : undefined;
  return {
    id: String(r["id"] ?? ""),
    fio: String(r["fullName"] ?? ""),
    phone: (r["phone"] as string) ?? undefined,
    inn: (r["inn"] as string) ?? null,
    photo: resolvePhotoUrl(photoRaw),
    birth_date: (r["birthDate"] as string) ?? undefined,
    is_blacklisted: (r["isBlacklisted"] as boolean) ?? false,
    blacklist_reason: (r["blacklistReason"] as string) ?? null,
    responsiblePersons,
  };
}

/**
 * Управляет списком клиентов: поиск и бесконечная прокрутка через /api/v1/clients/
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
      const qTrim = q.trim();
      const params = new URLSearchParams({
        pageSize: String(PER_PAGE),
        page: String(page + 1),
        ordering: "-createdAt",
      });
      if (qTrim) {
        params.set("search", qTrim);
        // Если запрос выглядит как ИНН (только цифры, 10+ символов) — добавляем отдельный фильтр
        if (/^\d{10,14}$/.test(qTrim)) {
          params.set("inn", qTrim);
        }
        // Если запрос выглядит как телефон (только цифры/+, 7+ символов) — добавляем фильтр по телефону
        const digitsOnly = qTrim.replace(/[^\d]/g, "");
        if (/^[\d+\-() ]{7,}$/.test(qTrim) && digitsOnly.length >= 7 && !/^\d{10,14}$/.test(qTrim)) {
          params.set("phone", digitsOnly);
        }
      }

      const res: any = await apiFetch(`/api/v1/clients/?${params.toString()}`);
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

  const patchPatient = React.useCallback((id: string, patch: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }, []);

  return {
    loading,
    errorMsg,
    patients,
    query,
    setQuery,
    hasMore,
    loadMore,
    reload,
    patchPatient,
    PER_PAGE,
  };
}
