const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://academy.operator.kg";
export const API_BASE_URL = BASE_URL;

export function resolveApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  return `${BASE_URL}${url}`;
}

// Глобальный фильтр по филиалу для суперадмина.
// Устанавливается из BranchContext через setBranchFilter().
let _activeBranchId: string | null = null;
export const BRANCH_FILTER_STORAGE_KEY = "superadmin_selected_branch";
export const setBranchFilter = (branchId: string | null) => { _activeBranchId = branchId; };
export const getBranchFilter = () => _activeBranchId;
export const clearBranchFilter = () => {
  _activeBranchId = null;
  try {
    localStorage.removeItem(BRANCH_FILTER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const TOKEN_KEY = "academy_access_token";
const REFRESH_KEY = "academy_refresh_token";
const SESSION_STARTED_AT_KEY = "academy_session_started_at";
const LOGOUT_AT_KEY = "academy_logout_at";

type ApiError = Error & { status?: number; retryAfterSeconds?: number };

const CLIENT_RATE_LIMITS = {
  auth: { windowMs: 5 * 60 * 1000, max: 5 },
  general: { windowMs: 3_000, max: 12 },
} as const;

const requestHistory = new Map<string, number[]>();

function createApiError(detail: string, status?: number, retryAfterSeconds?: number): ApiError {
  const err = new Error(detail) as ApiError;
  if (status !== undefined) err.status = status;
  if (retryAfterSeconds !== undefined) err.retryAfterSeconds = retryAfterSeconds;
  return err;
}

function isAuthPath(path: string): boolean {
  return path.startsWith("/api/v1/auth/");
}

function getRateLimitKey(path: string, method: string): string {
  return `${method}:${path.split("?")[0]}`;
}

function enforceClientRateLimit(path: string, method: string): void {
  const { windowMs, max } = isAuthPath(path) ? CLIENT_RATE_LIMITS.auth : CLIENT_RATE_LIMITS.general;
  const key = getRateLimitKey(path, method);
  const now = Date.now();
  const active = (requestHistory.get(key) ?? []).filter((ts) => now - ts < windowMs);

  if (active.length >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1000));
    throw createApiError(
      `Слишком много запросов. Повторите попытку через ${retryAfterSeconds} сек.`,
      429,
      retryAfterSeconds,
    );
  }

  active.push(now);
  requestHistory.set(key, active);
}

function getSessionStartedAt(): number {
  const raw = localStorage.getItem(SESSION_STARTED_AT_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function getLogoutAt(): number {
  const raw = localStorage.getItem(LOGOUT_AT_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function isClientSessionRevoked(): boolean {
  const sessionStartedAt = getSessionStartedAt();
  const logoutAt = getLogoutAt();
  return logoutAt > 0 && logoutAt >= sessionStartedAt;
}

/**
 * Декодирует payload JWT и возвращает `exp` (секунды Unix), если он есть.
 * Без верификации подписи — используется только для подсказки про истечение,
 * чтобы не отправлять заведомо протухший токен на /users/me/ и не получать
 * "техническую" 401-ку с последующим retry-после-refresh.
 */
function getJwtExp(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // atob падает на не-ASCII, для JWT exp это безопасно (число)
    const json = JSON.parse(atob(payloadB64));
    const exp = Number(json?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

// Запас на сетевую задержку — refresh-им чуть заранее, чтобы успеть до серверного expiry.
const ACCESS_EXPIRY_LEEWAY_SECONDS = 5;

function isAccessTokenExpired(token: string | null | undefined): boolean {
  const exp = getJwtExp(token);
  if (exp == null) return false; // не смогли распарсить — пусть сервер сам решит
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + ACCESS_EXPIRY_LEEWAY_SECONDS;
}

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(SESSION_STARTED_AT_KEY, String(Date.now()));
    localStorage.removeItem(LOGOUT_AT_KEY);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.setItem(LOGOUT_AT_KEY, String(Date.now()));
  },
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  if (isClientSessionRevoked()) {
    tokenStorage.clear();
    return null;
  }

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

// Эндпоинты, для которых НЕ нужно подставлять branch (аутентификация, оргструктура).
// /api/v1/clients/ и /api/v1/services/ удалены — они теперь branch-scoped.
const BRANCH_FILTER_SKIP = [
  "/api/v1/branches/",
  "/api/v1/auth/",
  "/api/v1/users/me",
  "/api/v1/roles/",
  "/api/v1/permissions/",
  "/api/v1/organizations/",
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

  enforceClientRateLimit(resolvedPath, method);

  if (!skipAuth && isClientSessionRevoked()) {
    tokenStorage.clear();
    window.location.href = "/login";
    throw createApiError("Сессия завершена. Войдите снова.", 401);
  }

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

  // Pro-active refresh: если access JWT уже протух по exp, обновляем токен ДО запроса,
  // чтобы не пачкать Network "техническими" 401-ками с последующим retry. Если refresh
  // не сработал — оставляем старый access; ниже стандартная reactive ветка очистит сессию
  // и сделает редирект на /login.
  if (!skipAuth && accessToken && isAccessTokenExpired(accessToken) && tokenStorage.getRefresh()) {
    if (isRefreshing) {
      const refreshed = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      });
      if (refreshed) accessToken = refreshed;
    } else {
      isRefreshing = true;
      const refreshed = await refreshAccessToken();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(refreshed));
      refreshQueue = [];
      if (refreshed) accessToken = refreshed;
    }
  }

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
        // Если после refresh всё равно 401 — сессия окончательно недействительна
        if (response.status === 401) {
          tokenStorage.clear();
          window.location.href = "/login";
          throw createApiError("Сессия завершена. Войдите снова.", 401);
        }
      } else {
        // Refresh провалился — сессия истекла или инвалидирована (logout / смена пароля)
        tokenStorage.clear();
        window.location.href = "/login";
        throw createApiError("Сессия завершена. Войдите снова.", 401);
      }
    }
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
    try {
      const errJson = await response.json();
      const firstError = errJson?.errors?.[0];
      if (firstError?.detail) {
        errorDetail = firstError.attr
          ? `[${firstError.attr}] ${firstError.detail}`
          : firstError.detail;
      } else if (errJson?.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }

    // 403 — недостаточно прав. Не ломаем UI глобальной ошибкой,
    // бросаем специфичный класс — caller может обработать или проигнорировать.
    if (response.status === 403) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[apiFetch] 403 Forbidden: ${path}`, errorDetail);
      }
      throw createApiError(errorDetail, 403);
    }

    if (response.status === 429) {
      const friendlyMsg = retryAfterSeconds
        ? `Слишком много запросов. Повторите через ${retryAfterSeconds} сек.`
        : "Слишком много запросов. Подождите немного и попробуйте снова.";
      throw createApiError(
        errorDetail !== `HTTP ${response.status}` ? errorDetail : friendlyMsg,
        429,
        retryAfterSeconds
      );
    }

    throw createApiError(errorDetail, response.status, retryAfterSeconds);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  return json as T;
}
