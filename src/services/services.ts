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

const fetchServicesBase = async (page?: number, pageSize?: number): Promise<{ items: ApiService[], total: number }> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append("type", "service");
    queryParams.append("is_active", "true");
    if (page !== undefined) queryParams.append("page", (page + 1).toString());
    if (pageSize !== undefined) queryParams.append("page_size", pageSize.toString());

    const res: any = await apiFetch(`/catalog/sellable-items/?${queryParams.toString()}`);
    const results = res?.data?.results ?? res?.results ?? [];
    const count = res?.data?.count ?? res?.count ?? results.length;

    // Map catalog/sellable-items response fields
    const mapped = results.map((item: any) => ({
      id: item.id,
      sellableItem: item.id,
      name: item.display_name ?? item.name,
      price: item.display_price ?? item.price,
      imageUrl: item.service?.image_url ?? item.image_url,
      employeeIds: item.employee_ids ?? [],
      isActive: item.is_active ?? true,
    }));

    return { items: mapped, total: count };
  } catch (err) {
    // Fallback to old endpoint
    try {
      const queryParams2 = new URLSearchParams();
      if (page !== undefined) queryParams2.append("page", (page + 1).toString());
      if (pageSize !== undefined) queryParams2.append("page_size", pageSize.toString());
      const res2: any = await apiFetch(`/api/v1/services/?${queryParams2.toString()}`);
      const results2 = res2?.data?.results ?? res2?.results ?? [];
      const count2 = res2?.data?.count ?? res2?.count ?? results2.length;
      return { items: results2, total: count2 };
    } catch (err2) {
      console.error("apiFetch fetchServicesBase error:", err2);
      throw err2;
    }
  }
};

export const fetchServices = async (): Promise<ServiceRow[]> => {
  try {
    const { items } = await fetchServicesBase(0, 1000);
    return items.map(toRow);
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

  try {
    const { items, total } = await fetchServicesBase(safePage, size);
    return { items: items.map(toRow), total };
  } catch (e) {
    console.error("fetchServicesPaged unexpected error:", e);
    return { items: [], total: 0 };
  }
};
