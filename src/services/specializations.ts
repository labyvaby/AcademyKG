import { apiFetch } from "../utility/apiClient";

export type SpecializationRow = {
  id: string;
  name: string;
};

export const fetchSpecializations = async (): Promise<SpecializationRow[]> => {
  try {
    const res: any = await apiFetch("/api/v1/specializations/?page_size=200&ordering=name");
    const items: any[] = res?.data?.results ?? res?.results ?? [];
    return items.map(r => ({ id: String(r.id), name: r.name ?? "" }));
  } catch (e) {
    console.error("fetchSpecializations failed", e);
    return [];
  }
};
