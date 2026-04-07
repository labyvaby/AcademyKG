import { apiFetch, resolveApiUrl } from "../utility/apiClient";
import { fetchAllPages } from "../utility/pagination";

function resolveUrl(url: string | null | undefined): string | undefined {
  return resolveApiUrl(url) ?? undefined;
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
  isGroup?: boolean;
  maxParticipants?: number | null;
  durationMinutes?: number | null;
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
  isGroup?: boolean;
  is_group?: boolean;
  maxParticipants?: number | null;
  max_participants?: number | null;
  durationMinutes?: number | null;
  duration_minutes?: number | null;
  duration?: number | null;
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
    isGroup: d.isGroup ?? d.is_group ?? false,
    maxParticipants: d.maxParticipants ?? d.max_participants ?? null,
    durationMinutes: d.durationMinutes ?? d.duration_minutes ?? null,
  };
};

const fetchServicesBase = async (page?: number, pageSize?: number): Promise<{ items: ApiService[], total: number }> => {
  const queryParams = new URLSearchParams();
  if (page !== undefined) queryParams.append("page", (page + 1).toString());
  if (pageSize !== undefined) queryParams.append("pageSize", pageSize.toString());

  const res: any = await apiFetch(`/api/v1/services/?${queryParams.toString()}`);
  const results = res?.data?.results ?? res?.results ?? [];
  const count = res?.data?.count ?? res?.count ?? results.length;

  const mapped: ApiService[] = results.map((item: any) => ({
    id: item.id,
    name: item.name,
    priceSom: item.priceSom ?? item.price_som ?? null,
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    isActive: item.isActive ?? item.is_active ?? true,
    isGroup: item.isGroup ?? item.is_group ?? false,
    maxParticipants: item.maxParticipants ?? item.max_participants ?? null,
    durationMinutes: item.durationMinutes ?? item.duration_minutes ?? item.duration ?? null,
  }));

  return { items: mapped, total: count };
};

// Для привязки услуг к сотруднику — грузит из /api/v1/sellable-items/?type=service
// Используем тот же источник, что и страница "Услуги", чтобы не показывать
// удаленные/устаревшие записи в форме привязки сотруднику.
export const fetchSellableServices = async (): Promise<ServiceRow[]> => {
  const results = await fetchAllPages<any>(
    "/api/v1/services/?ordering=name&pageSize=200"
  );

  return Array.from(
    new Map(
      results
        .filter((item: any) => (item?.isActive ?? item?.is_active ?? true) !== false)
        .map((item: any): [string, ServiceRow] => [
          String(item.sellableItem ?? item.sellable_item ?? item.id ?? ""),
          {
            id: String(item.sellableItem ?? item.sellable_item ?? item.id ?? ""),
            name: item.name || item.displayName || item.service?.name || "",
            price:
              item.price != null
                ? Number(item.price)
                : item.priceSom != null
                  ? Number(item.priceSom)
                  : item.displayPrice != null
                    ? Number(item.displayPrice)
                    : item.service?.price != null
                      ? Number(item.service.price)
                      : undefined,
            photoUrl: resolveUrl(item.imageUrl ?? item.image_url ?? item.service?.imageUrl ?? item.service?.image_url),
            is_active: item.isActive ?? item.is_active ?? true,
          },
        ])
        .filter(([id, service]) => id && service.name)
    ).values()
  );
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
  isGroup?: boolean;
  maxParticipants?: number | null;
  durationMinutes?: number | null;
};

export type UpdateServiceData = Partial<CreateServiceData>;

export const createService = async (data: CreateServiceData): Promise<ServiceRow> => {
  const fd = new FormData();
  fd.append("name", data.name);
  fd.append("priceSom", String(data.priceSom));
  fd.append("isActive", String(data.isActive ?? true));
  fd.append("isGroup", String(data.isGroup ?? false));
  if (data.isGroup && data.maxParticipants != null) {
    fd.append("maxParticipants", String(data.maxParticipants));
  }
  if (data.durationMinutes != null) {
    fd.append("durationMinutes", String(data.durationMinutes));
    fd.append("duration_minutes", String(data.durationMinutes));
  }
  if (data.description) fd.append("description", data.description);

  if (data.imageUrl instanceof File) {
    fd.append("imageUrl", data.imageUrl);
  } else if (data.imageUrl === null) {
    fd.append("imageUrl", "");
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
  if (data.isGroup !== undefined) fd.append("isGroup", String(data.isGroup));
  if (data.isGroup && data.maxParticipants != null) {
    fd.append("maxParticipants", String(data.maxParticipants));
  } else if (data.isGroup === false) {
    fd.append("maxParticipants", "");
  }
  if (data.durationMinutes != null) {
    fd.append("durationMinutes", String(data.durationMinutes));
    fd.append("duration_minutes", String(data.durationMinutes));
  } else {
    fd.append("durationMinutes", "");
    fd.append("duration_minutes", "");
  }

  if (data.imageUrl instanceof File) {
    fd.append("imageUrl", data.imageUrl);
  }

  const res: any = await apiFetch(`/api/v1/services/${id}/`, {
    method: "PATCH",
    body: fd,
  });

  // API может вернуть 204 No Content — в таком случае grузим актуальные данные отдельным GET
  if (res === undefined || res === null) {
    try {
      const getRes: any = await apiFetch(`/api/v1/services/${id}/`);
      const item = getRes?.data ?? getRes;
      return toRow(item);
    } catch {
      // Если GET тоже упал — возвращаем то что отправили
      return toRow({
        id: String(id),
        name: data.name,
        priceSom: data.priceSom,
        isActive: data.isActive,
        isGroup: data.isGroup,
        maxParticipants: data.maxParticipants,
        durationMinutes: data.durationMinutes,
      });
    }
  }

  const item = res?.data ?? res;
  return toRow(item);
};

export const deleteService = async (id: string | number): Promise<void> => {
    await apiFetch(`/api/v1/services/${id}/`, {
        method: "DELETE"
    });
};
