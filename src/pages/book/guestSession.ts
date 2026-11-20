import React from "react";

// Сессия гостя витрины («Мои записи»): токен и номер в localStorage этого браузера.
// Отдельно от токена сотрудника CRM — у них разные ключи и разные заголовки.

const KEY = "academy.book.guest";

export type GuestSession = { token: string; phone: string };

const listeners = new Set<() => void>();

function read(): GuestSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value && typeof value.token === "string" && typeof value.phone === "string" ? value : null;
  } catch {
    return null;
  }
}

let current: GuestSession | null = read();

function write(next: GuestSession | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* приватный режим — сессия живёт до перезагрузки */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useGuestSession() {
  const session = React.useSyncExternalStore(subscribe, () => current);
  return {
    session,
    signIn: React.useCallback((token: string, phone: string) => write({ token, phone }), []),
    signOut: React.useCallback(() => write(null), []),
  };
}
