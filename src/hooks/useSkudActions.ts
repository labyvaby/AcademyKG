import React from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useNotification } from "@refinedev/core";
import { usePermissions } from "./usePermissions";
import { PERMISSIONS } from "../constants/permissions";

import { useWorkShift } from "./useWorkShift";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "../utility/apiClient";
import { fetchShifts, createShift, updateShift } from "../services/shifts";

dayjs.extend(duration);

export interface WorkShift {
    id: string;
    employee_id: string;
    clock_in: string;
    clock_out: string | null;
    is_night_shift: boolean;
    created_at: string;
    employee?: {
        full_name: string;
    };
}

export const useSkudActions = (
    enableHistory: boolean = false,
    filterEmployeeId?: string | null,
    filterStartDate?: string | null,
    filterEndDate?: string | null
) => {
    const { hasPermission } = usePermissions();
    const { open: notify } = useNotification();
    const queryClient = useQueryClient();
    
    // Use centralized work shift state (deduplicated)
    const { activeShift, employeeId, loading: shiftLoading } = useWorkShift();
    const currentUserEmployeeId = employeeId;
    const currentShift = activeShift;

    // IP Logic
    // 1. Fetch User IP (Cached forever)
    const { data: userIp } = useQuery({
        queryKey: ['common', 'userIp'],
        queryFn: async () => {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip as string;
        },
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
    });

    // 2. Fetch Allowed IP from Settings (Cached 5 mins)
    const { data: dbAllowedIp } = useQuery({
        queryKey: ['appSettings', 'skud_api_url'],
        queryFn: async () => {
            try {
                const res: any = await apiFetch("/api/v1/app_settings/skud_api_url/");
                const data = res?.data || res;
                return data?.value as string | null;
            } catch (e) {
                console.error("Failed to fetch skud_api_url setting", e);
                return null;
            }
        },
        staleTime: 5 * 60 * 1000,
    });

    const effectiveAllowedIp = dbAllowedIp || import.meta.env.VITE_OFFICE_IP || "";
    const isIpCorrect = !effectiveAllowedIp || userIp === effectiveAllowedIp;
    const [actionLoading, setActionLoading] = React.useState(false);

    // History Logic (Only fetch if enabled)
    const { data: shiftsData, isLoading: historyLoading, refetch: refetchShifts, isFetching: historyFetching } = useQuery({
        queryKey: ['workShifts', 'history', currentUserEmployeeId, filterEmployeeId, filterStartDate, filterEndDate],
        queryFn: async () => {
            // Need employee ID to fetch history
            if (!currentUserEmployeeId && !hasPermission(PERMISSIONS.EMPLOYEES_READ)) return [];

            const employeeFilter = hasPermission(PERMISSIONS.EMPLOYEES_READ) ? filterEmployeeId : (currentUserEmployeeId || null);

            return await fetchShifts({
                employee: employeeFilter ?? undefined,
                startDate: filterStartDate ?? undefined,
                endDate: filterEndDate ?? undefined
            });
        },
        enabled: enableHistory, // Enable fetching only if requested
        staleTime: 5 * 60 * 1000, 
        placeholderData: keepPreviousData,
    });

    const shifts = shiftsData ?? [];
    const loading = shiftLoading || (enableHistory ? historyLoading : false);

    // Realtime Subscription removed - relying on active invalidation

    // Helpers
    const isNightShiftTime = (clockIn: string) => {
        const hour = dayjs(clockIn).hour();
        return hour < 8 || hour >= 20;
    };

    // Actions
    const handleStartShift = async () => {
        if (!currentUserEmployeeId) return;

        if (!isIpCorrect) {
            notify?.({ type: "error", message: "Неверный IP адрес. Смена может быть начата только из офиса." });
            return;
        }

        try {
            setActionLoading(true);
            const now = new Date();
            const isNight = isNightShiftTime(now.toISOString());

            const result = await createShift({
                employes_id: currentUserEmployeeId,
                shift_date: dayjs(now).format('YYYY-MM-DD'),
                start_time: dayjs(now).format('HH:mm'),
                is_night_shift: isNight,
                clock_in: now.toISOString(),
            });
            if (!result) throw new Error("Failed to create shift");
            
            notify?.({ type: "success", message: "Смена началась" });
            
            // Invalidate to update UI immediately
            queryClient.invalidateQueries({ queryKey: ['workShift', 'current'] });
            if (enableHistory) queryClient.invalidateQueries({ queryKey: ['workShifts', 'history'] });
            
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка начала смены" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndShift = async () => {
        if (!currentShift) return;
        try {
            setActionLoading(true);
            const result = await updateShift(currentShift.id, {
                clock_out: new Date().toISOString(),
                shift_date: dayjs(currentShift.clock_in).format('YYYY-MM-DD'),
                end_time: dayjs().format('HH:mm')
            });
            if (!result) throw new Error("Failed to end shift");
            
            notify?.({ type: "success", message: "Смена завершена" });
            
            // Invalidate
            queryClient.invalidateQueries({ queryKey: ['workShift', 'current'] });
             if (enableHistory) queryClient.invalidateQueries({ queryKey: ['workShifts', 'history'] });

        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка завершения смены" });
        } finally {
            setActionLoading(false);
        }
    };

    return {
        shifts,
        loading,
        isFetching: historyFetching,
        currentUserEmployeeId,
        actionLoading,
        effectiveAllowedIp,
        userIp,
        isIpCorrect,
        currentShift,
        fetchShifts: refetchShifts, // Alias refetch
        handleStartShift,
        handleEndShift,
        isNightShiftTime, 
    };
};
