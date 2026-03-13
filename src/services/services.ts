import { apiFetch } from "../utility/apiClient";

// Frontend DTO used across the app
export type ServiceRow = {
  id: string;
  name: string;
  price?: number;
  photoUrl?: string;
  employee_id?: string | null;
  employee_ids?: string[];
  is_active?: boolean;
};

// Paged variant kept consistent with strict typing
export type PagedResult<T> = { items: T[]; total: number };

type ApiService = {
  id?: string;
  sellableItem?: string;
  sellable_item?: string;
  name?: string;
  imageUrl?: string | null;
  image_url?: string | null;
  price?: number | null;
  priceSom?: number | null;
  employeeIds?: string[];
  isActive?: boolean;
  is_active?: boolean;
};

const toRow = (d: ApiService): ServiceRow => {
  const id = d.id ?? d.sellableItem ?? d.sellable_item ?? "";
  return {
    id: String(id),
    name: d.name ?? "Без названия",
    price: d.price ?? d.priceSom ?? undefined,
    photoUrl: d.imageUrl ?? d.image_url ?? undefined,
    employee_ids: d.employeeIds ?? [],
    is_active: d.isActive ?? d.is_active ?? true,
  };
};

const fetchAllPages = async (url: string): Promise<ApiService[]> => {
  const results: ApiService[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res: any = await apiFetch(nextUrl);
    const items: ApiService[] = res?.data?.results ?? res?.results ?? [];
    results.push(...items);
    const next = res?.data?.next ?? res?.next ?? null;
    if (next) {
      try {
        const u = new URL(next);
        nextUrl = u.pathname + u.search;
      } catch {
        nextUrl = null;
      }
    } else {
      nextUrl = null;
    }
  }

  return results;
};

export const fetchServices = async (): Promise<ServiceRow[]> => {
  try {
    const data = await fetchAllPages("/api/v1/services/?page_size=500");
    const mapped = data.map(toRow).filter((r) => r.id);
    mapped.sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
    return mapped;
  } catch (e) {
    console.error("fetchServices unexpected error:", e);
    return [];
  }
};

export const fetchServicesPaged = async (
  page: number,
  rowsPerPage: number = 10
): Promise<PagedResult<ServiceRow>> => {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.trunc(page) : 0;
  const size = Number.isFinite(rowsPerPage) && rowsPerPage > 0 ? Math.trunc(rowsPerPage) : 10;
  const apiPage = safePage + 1; // API 1-indexed

  try {
    const res: any = await apiFetch(`/api/v1/services/?page=${apiPage}&page_size=${size}`);
    const items: ApiService[] = res?.data?.results ?? res?.results ?? [];
    const total: number = res?.data?.count ?? res?.count ?? items.length;

    const mapped = items.map(toRow).filter((r) => r.id);
    mapped.sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));

    return { items: mapped, total };
  } catch (e) {
    console.error("fetchServicesPaged unexpected error:", e);
    return { items: [], total: 0 };
  }
};
