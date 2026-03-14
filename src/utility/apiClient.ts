const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://academy.operator.kg";

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

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  const url = `${BASE_URL}${path}`;

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
    throw new Error(errorDetail);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  return json as T;
}
