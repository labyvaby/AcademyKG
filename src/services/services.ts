import { apiFetch } from "../utility/apiClient";

const API_BASE = "https://academy.operator.kg";

function resolveUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

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
    photoUrl: resolveUrl(d.imageUrl ?? d.image_url),
    employee_ids: d.employeeIds ?? [],
    is_active: d.isActive ?? d.is_active ?? true,
  };
};

const fetchServicesBase = async (page?: number, pageSize?: number): Promise<{ items: ApiService[], total: number }> => {
  const queryParams = new URLSearchParams();
  if (page !== undefined) queryParams.append("page", (page + 1).toString());
  if (pageSize !== undefined) queryParams.append("page_size", pageSize.toString());

  const res: any = await apiFetch(`/api/v1/services/?${queryParams.toString()}`);
  const results = res?.data?.results ?? res?.results ?? [];
  const count = res?.data?.count ?? res?.count ?? results.length;

  const mapped: ApiService[] = results.map((item: any) => ({
    id: item.id,
    name: item.name,
    priceSom: item.priceSom ?? item.price_som ?? null,
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    isActive: item.isActive ?? item.is_active ?? true,
  }));

  return { items: mapped, total: count };
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
export type CreateServiceData = {
  name: string;
  priceSom: number;
  description?: string;
  isActive?: boolean;
  imageUrl?: File | string | null;
};

export type UpdateServiceData = Partial<CreateServiceData>;

export const createService = async (data: CreateServiceData): Promise<ServiceRow> => {
  const fd = new FormData();
  fd.append("name", data.name);
  fd.append("priceSom", String(data.priceSom));
  fd.append("isActive", String(data.isActive ?? true));
  if (data.description) fd.append("description", data.description);
  
  if (data.imageUrl instanceof File) {
    fd.append("imageUrl", data.imageUrl);
  } else if (data.imageUrl === null) {
      fd.append("imageUrl", ""); // or how to clear? instruction says {"imageUrl": null} for JSON
  }

  const res: any = await apiFetch("/api/v1/services/", {
    method: "POST",
    body: fd,
  });

  const item = res?.data ?? res;
  return toRow(item);
};

export const updateService = async (id: string | number, data: UpdateServiceData): Promise<ServiceRow> => {
  const fd = new FormData();
  if (data.name) fd.append("name", data.name);
  if (data.priceSom !== undefined) fd.append("priceSom", String(data.priceSom));
  if (data.isActive !== undefined) fd.append("isActive", String(data.isActive));
  if (data.description !== undefined) fd.append("description", data.description || "");

  if (data.imageUrl instanceof File) {
    fd.append("imageUrl", data.imageUrl);
  }

  const res: any = await apiFetch(`/api/v1/services/${id}/`, {
    method: "PATCH",
    body: fd,
  });

  const item = res?.data ?? res;
  return toRow(item);
};

export const deleteService = async (id: string | number): Promise<void> => {
    await apiFetch(`/api/v1/services/${id}/`, {
        method: "DELETE"
    });
};
