const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://academy.operator.kg";

// Глобальный фильтр по филиалу для суперадмина.
// Устанавливается из BranchContext через setBranchFilter().
let _activeBranchId: string | null = null;
export const setBranchFilter = (branchId: string | null) => { _activeBranchId = branchId; };
export const getBranchFilter = () => _activeBranchId;

const TOKEN_KEY = "academy_access_token";
const REFRESH_KEY = "academy_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      tokenStorage.clear();
      return null;
    }

    const json = await res.json();
    const newAccess: string = json?.data?.accessToken ?? json?.data?.access ?? json?.access;
    if (newAccess) {
      localStorage.setItem("academy_access_token", newAccess);
      return newAccess;
    }
    return null;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

// Эндпоинты, для которых НЕ нужно подставлять branch (справочники, аутентификация)
const BRANCH_FILTER_SKIP = [
  "/api/v1/branches/",
  "/api/v1/auth/",
  "/api/v1/users/me",
  "/api/v1/roles/",
  "/api/v1/permissions/",
  "/api/v1/organizations/",
  "/api/v1/clients/",
  "/api/v1/services/",
];

// UUID regex — детальные запросы по ID не должны фильтроваться по филиалу
const UUID_PATH_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

function injectBranchParam(path: string, method: string): string {
  if (!_activeBranchId) return path;
  if (method && method !== "GET") return path;
  if (BRANCH_FILTER_SKIP.some((skip) => path.startsWith(skip))) return path;
  // Детальный запрос по UUID — не фильтруем по филиалу
  if (UUID_PATH_RE.test(path.split("?")[0])) return path;
  // Уже есть branch= в URL — не дублируем
  if (path.includes("branch=")) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}branch=${_activeBranchId}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const resolvedPath = injectBranchParam(path, method);
  const url = `${BASE_URL}${resolvedPath}`;

  const buildHeaders = (token?: string | null): HeadersInit => {
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    };

    // Only set Content-Type if it's not FormData (browser sets it for FormData)
    // and if it's not already set in options.headers
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  };

  const doRequest = async (token?: string | null): Promise<Response> =>
    fetch(url, {
      ...options,
      cache: "no-store", // Prevent browser caching of API responses
      headers: buildHeaders(skipAuth ? undefined : token),
    });

  let accessToken = skipAuth ? null : tokenStorage.getAccess();
  let response = await doRequest(accessToken);

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth) {
    if (isRefreshing) {
      const newToken = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      });
      response = await doRequest(newToken);
    } else {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];

      if (newToken) {
        response = await doRequest(newToken);
      } else {
        // Session expired — redirect to login
        tokenStorage.clear();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      const firstError = errJson?.errors?.[0];
      if (firstError?.detail) errorDetail = firstError.detail;
      else if (errJson?.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }

    // 403 — недостаточно прав. Не ломаем UI глобальной ошибкой,
    // бросаем специфичный класс — caller может обработать или проигнорировать.
    if (response.status === 403) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[apiFetch] 403 Forbidden: ${path}`, errorDetail);
      }
      const err = new Error(errorDetail) as Error & { status: number };
      err.status = 403;
      throw err;
    }

    throw new Error(errorDetail);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  return json as T;
}
