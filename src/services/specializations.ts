import { apiFetch } from "../utility/apiClient";

export type SpecializationRow = {
  id: string;
  name: string;
};

export const fetchSpecializations = async (): Promise<SpecializationRow[]> => {
  try {
    const res: any = await apiFetch("/api/v1/specializations/?pageSize=1000");
    const data = res?.data?.results ?? res?.results ?? [];
    
    return data.map((r: any) => ({ 
      id: String(r.id), 
      name: r.name ?? "" 
    }));
  } catch (e) {
    console.error("fetchSpecializations failed", e);
    return [];
  }
};
