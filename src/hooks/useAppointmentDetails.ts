import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utility/apiClient';
import { Appointment, AggregatedAppointmentRow, mapAggregatedRowToAppointment } from '../pages/home/types';

export interface AppointmentDetailsData {
    item: Appointment | null;
    patientData: {
        phone: string | null;
        birth_date: string | null;
        inn: string | null;
        photo_url: string | null;
    } | null;
    appointmentDoctors: Array<{
        id: string;
        full_name: string;
        phone: string | null;
        auth_user_id?: string | null;
        photo_url?: string | null;
    }>;
    servicesPhotos: Map<string, string>;
}

const emptyResult: AppointmentDetailsData = {
    item: null,
    patientData: null,
    appointmentDoctors: [],
    servicesPhotos: new Map(),
};

export const useAppointmentDetails = (appointmentId: string | null) => {
    const queryClient = useQueryClient();

    const { data, isLoading, error, refetch } = useQuery<AppointmentDetailsData>({
        queryKey: ['appointment-details', appointmentId],
        queryFn: async () => {
            if (!appointmentId) return emptyResult;

            try {
                // 1. Детали приёма через новый endpoint
                let apptData: any = null;
                const res: any = await apiFetch(`/api/v1/appointments/${appointmentId}/`);
                apptData = res?.data ?? res;

                if (!apptData) return emptyResult;

                const mapped = mapAggregatedRowToAppointment(apptData as any);

                // 2. Данные пациента
                const patientData = {
                    phone: apptData.patient_phone || apptData.patient?.phone || null,
                    birth_date: apptData.patient_birth_date || apptData.patient?.birth_date || null,
                    inn: apptData.patient_inn || apptData.patient?.inn || null,
                    photo_url: apptData.patient_photo_url || apptData.patient?.photo_url || null,
                };

                // 3. Doctors — из services (performer — UUID строка + performerName)
                const doctorMap = new Map<string, any>();
                const services: any[] = apptData.services ?? [];
                services.forEach((s: any) => {
                    const pid = typeof s.performer === "string" ? s.performer : s.performer?.id;
                    const pname = s.performerName ?? s.performer_name ?? (typeof s.performer === "object" ? (s.performer?.fullName ?? s.performer?.full_name ?? "") : null) ?? "Специалист";
                    if (pid) {
                        doctorMap.set(pid, {
                            id: pid,
                            full_name: pname,
                            phone: s.performer?.phone ?? null,
                            photo_url: s.performer?.photoUrl ?? s.performer?.photo_url ?? null,
                        });
                    }
                });
                if (apptData.doctor_id && !doctorMap.has(apptData.doctor_id)) {
                    doctorMap.set(apptData.doctor_id, {
                        id: apptData.doctor_id,
                        full_name: apptData.doctor_name || "Специалист",
                        phone: apptData.doctor_phone || null,
                        photo_url: apptData.doctor_photo_url || null,
                    });
                }
                const doctors = Array.from(doctorMap.values());

                // 4. Load sellable item names if they are plain UUIDs
                const sellableIds = services
                    .map((s: any) => typeof s.sellableItem === "string" ? s.sellableItem : null)
                    .filter(Boolean) as string[];
                const sellableNameMap = new Map<string, string>();
                if (sellableIds.length > 0) {
                    try {
                        const siRes: any = await apiFetch(`/api/v1/sellable-items/?ids=${sellableIds.join(",")}&page_size=50`);
                        const siItems: any[] = siRes?.data?.results ?? siRes?.results ?? siRes?.data ?? [];
                        siItems.forEach((si: any) => {
                            if (si.id) sellableNameMap.set(String(si.id), si.displayName ?? si.display_name ?? si.name ?? "Услуга");
                        });
                    } catch { /* ignore, show UUID fallback */ }
                }
                // Patch services with loaded names
                services.forEach((s: any) => {
                    if (typeof s.sellableItem === "string" && sellableNameMap.has(s.sellableItem)) {
                        s.sellableItemName = sellableNameMap.get(s.sellableItem);
                    }
                });

                // 5. Services photos map
                const servicesPhotos = new Map<string, string>();
                services.forEach((s: any) => {
                    const id = typeof s.sellableItem === "string" ? s.sellableItem : s.sellable_item?.id ?? s.id;
                    const photo = s.sellable_item?.service?.image_url ?? s.image_url;
                    if (id && photo) servicesPhotos.set(id, photo);
                });

                return {
                    item: mapped,
                    patientData,
                    appointmentDoctors: doctors as any,
                    servicesPhotos,
                };
            } catch (err) {
                console.error("[useAppointmentDetails] Unexpected error:", err);
                throw err;
            }
        },
        enabled: !!appointmentId,
        staleTime: 5000,
    });

    const refresh = () => {
        if (appointmentId) {
            queryClient.invalidateQueries({ queryKey: ['appointment-details', appointmentId] });
        }
        return refetch();
    };

    return {
        item: data?.item || null,
        patientData: data?.patientData || null,
        appointmentDoctors: data?.appointmentDoctors || [],
        servicesPhotos: data?.servicesPhotos || new Map(),
        loading: isLoading,
        error: error instanceof Error ? error.message : null,
        refresh
    };
};
