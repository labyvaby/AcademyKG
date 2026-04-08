import { API_BASE_URL, apiFetch, clearBranchFilter, tokenStorage } from "../utility/apiClient";

export interface LoginResponse {
  data?: { access?: string; refresh?: string };
  access?: string;
  refresh?: string;
}

export interface VerifyResponse {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    access?: string;
    refresh?: string;
    success?: boolean;
  };
  access?: string;
  refresh?: string;
}

export interface TokenRefreshResponse {
  data?: { access: string };
  access?: string;
}

/**
 * Шаг 1: Запрос SMS-кода на телефон.
 * POST /api/v1/auth/login/
 * Body: { phoneNumber: string }
 */
export async function requestSmsCode(phoneNumber: string): Promise<void> {
  await apiFetch("/api/v1/auth/login/", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  }, true);
}

/**
 * Шаг 2: Подтверждение SMS-кода.
 * POST /api/v1/auth/verify/
 * Body: { phoneNumber, code, purpose: "login" }
 * Response: { data: { access, refresh } }
 */
export async function verifySmsCode(
  phoneNumber: string,
  code: string
): Promise<{ access: string; refresh: string }> {
  const res = await apiFetch<VerifyResponse>(
    "/api/v1/auth/verify/",
    {
      method: "POST",
      body: JSON.stringify({ phoneNumber, code, purpose: "login" }),
    },
    true
  );

  const access = res?.data?.accessToken ?? res?.data?.access ?? res?.access ?? "";
  const refresh = res?.data?.refreshToken ?? res?.data?.refresh ?? res?.refresh ?? "";

  if (!access || !refresh) {
    throw new Error("Не удалось получить токены авторизации");
  }

  tokenStorage.set(access, refresh);
  return { access, refresh };
}

/**
 * Вход по Email и паролю.
 * POST /api/v1/auth/login/password/
 * Body: { email, password }
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ access: string; refresh: string }> {
  const res = await apiFetch<VerifyResponse>(
    "/api/v1/auth/login/password/",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    true
  );

  const access = res?.data?.accessToken ?? res?.data?.access ?? res?.access ?? "";
  const refresh = res?.data?.refreshToken ?? res?.data?.refresh ?? res?.refresh ?? "";

  if (!access || !refresh) {
    throw new Error("Не удалось получить токены авторизации");
  }

  tokenStorage.set(access, refresh);
  return { access, refresh };
}

/**
 * Запрос сброса пароля.
 * POST /api/v1/auth/reset-password/request/
 * Body: { email, redirectUrl }
 */
export async function requestPasswordReset(email: string, redirectUrl?: string): Promise<void> {
  await apiFetch("/api/v1/auth/reset-password/request/", {
    method: "POST",
    body: JSON.stringify({ email, redirectUrl }),
  }, true);
}

/**
 * Подтверждение нового пароля.
 * POST /api/v1/auth/reset-password/confirm/
 * Body: { uid, token, newPassword, passwordConfirm }
 */
export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
  passwordConfirm: string
): Promise<void> {
  await apiFetch("/api/v1/auth/reset-password/confirm/", {
    method: "POST",
    body: JSON.stringify({ uid, token, newPassword, passwordConfirm }),
  }, true);
}

import { clearPermissions } from "../hooks/usePermissions";

/**
 * Выход из аккаунта.
 * Инвалидирует сессию на сервере (POST /auth/logout/), затем очищает локальные токены.
 * Вызов — fire-and-forget: даже если сервер недоступен, локальные токены очищаются.
 */
export function logout(): void {
  const access = tokenStorage.getAccess();
  const refresh = tokenStorage.getRefresh();

  // Сначала чистим локально — UI не должен ждать ответа сервера
  tokenStorage.clear();
  clearPermissions();
  clearBranchFilter();

  // Инвалидируем сессию на сервере в фоне
  if (access && refresh) {
    fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access}`,
      },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => { /* игнорируем — токены уже очищены локально */ });
  }
}

/**
 * Смена пароля.
 * POST /api/v1/auth/change-password/
 * После успеха refresh-токены инвалидируются на сервере — нужна повторная авторизация.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  passwordConfirm: string
): Promise<void> {
  await apiFetch("/api/v1/auth/change-password/", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword, passwordConfirm }),
  });
}

/**
 * Проверяет, авторизован ли пользователь (есть ли access-токен).
 */
export function isAuthenticated(): boolean {
  return !!tokenStorage.getAccess();
}
