import React from "react";

import { getPublicInfo, type PublicBranch, type PublicInfo } from "../../services/publicBooking";
import { useLoad } from "./shared";

// Организация и филиалы витрины: один запрос на все страницы /book — переходы
// «занятие → специалист → назад» не дёргают сеть заново.

type BookInfoState = {
  info: PublicInfo | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

const BookInfoContext = React.createContext<BookInfoState>({
  info: null,
  loading: true,
  error: null,
  reload: () => undefined,
});

export const BookInfoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useLoad((signal) => getPublicInfo(signal), []);
  const value = React.useMemo(
    () => ({ info: state.data, loading: state.loading, error: state.error, reload: state.reload }),
    [state.data, state.loading, state.error, state.reload],
  );
  return <BookInfoContext.Provider value={value}>{children}</BookInfoContext.Provider>;
};

export const useBookInfo = () => React.useContext(BookInfoContext);

/** Филиал по части адреса: короткий адрес или id (ссылка, выданная до короткого адреса). */
export function findBranch(branches: PublicBranch[], ref: string | undefined): PublicBranch | null {
  if (!ref) return null;
  const normalized = ref.trim().toLowerCase();
  return branches.find((b) => (b.slug && b.slug === normalized) || b.id === normalized) ?? null;
}

/** Адрес страницы филиала: по короткому адресу, если он задан. */
export function branchPath(branch: Pick<PublicBranch, "id" | "slug">, rest = ""): string {
  return `/book/${branch.slug || branch.id}${rest}`;
}

/** Название филиала для гостя: бренд, иначе название. */
export const branchTitle = (branch: Pick<PublicBranch, "brandName" | "name">) => branch.brandName || branch.name;
