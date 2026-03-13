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
    appointmentProducts: Array<{
        sellable_item_id: string;
        name: string;
        price: number;
        quantity: number;
        photo_url?: string | null;
    }>;
    servicesPhotos: Map<string, string>;
}

const emptyResult: AppointmentDetailsData = {
    item: null,
    patientData: null,
    appointmentDoctors: [],
    appointmentProducts: [],
    servicesPhotos: new Map(),
};

export const useAppointmentDetails = (appointmentId: string | null) => {
    const queryClient = useQueryClient();

    const { data, isLoading, error, refetch } = useQuery<AppointmentDetailsData>({
        queryKey: ['appointment-details', appointmentId],
        queryFn: async () => {
            if (!appointmentId) return emptyResult;

            try {
                // 1. Детали приёма
                const apptRes: any = await apiFetch(`/api/v1/appointments/${appointmentId}/`);
                const apptData: AggregatedAppointmentRow = apptRes?.data ?? apptRes;

                if (!apptData?.id) return emptyResult;

                const mapped = mapAggregatedRowToAppointment(apptData);
                const patientId = apptData.patient_id ?? (apptData as any).patient;

                // 2. Данные пациента
                let patientData: AppointmentDetailsData['patientData'] = null;
                if (patientId) {
                    try {
                        const pRes: any = await apiFetch(`/api/v1/children/${patientId}/`);
                        const p = pRes?.data ?? pRes;
                        patientData = {
                            phone: p?.phone ?? p?.contactPhone ?? null,
                            birth_date: p?.birthDate ?? p?.birth_date ?? null,
                            inn: p?.inn ?? null,
                            photo_url: p?.photoUrl ?? p?.photo_url ?? null,
                        };
                    } catch {
                        // patient not critical
                    }
                }

                return {
                    item: mapped,
                    patientData,
                    appointmentDoctors: [],
                    appointmentProducts: [],
                    servicesPhotos: new Map(),
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
        appointmentProducts: data?.appointmentProducts || [],
        servicesPhotos: data?.servicesPhotos || new Map(),
        loading: isLoading,
        error: error instanceof Error ? error.message : null,
        refresh
    };
};
