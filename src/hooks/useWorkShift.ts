import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '../hooks/usePermissions';
import { apiFetch } from '../utility/apiClient';

interface WorkShift {
    id: string;
    employee_id: string;
    clock_in: string;
    clock_out: string | null;
}

const fetchWorkShift = async (employeeId: string | null): Promise<{ activeShift: WorkShift | null; employeeId: string | null }> => {
    if (!employeeId) {
        return { activeShift: null, employeeId: null };
    }

    try {
        // Fetch the most recent shift for this employee
        const res: any = await apiFetch(`/api/v1/work-shifts/?employee=${employeeId}&ordering=-clock_in&page_size=1`);
        const shifts = res?.data?.results ?? res?.results ?? [];
        const latestShift = shifts[0];

        // If it exists and clock_out is null, it's active
        const isActive = latestShift && (latestShift.clock_out === null || latestShift.clockOut === null);
        
        if (isActive) {
            return { 
                activeShift: {
                    id: latestShift.id,
                    employee_id: latestShift.employee || latestShift.employe || "",
                    clock_in: latestShift.clock_in || latestShift.clockIn,
                    clock_out: latestShift.clock_out || latestShift.clockOut || null,
                }, 
                employeeId 
            };
        }
    } catch (e) {
        console.error('[useWorkShift] Error fetching shift:', e);
    }

    return { activeShift: null, employeeId };
};  

export const useWorkShift = () => {
    const { employeeId: globalEmployeeId } = usePermissions();

    const { data, isLoading } = useQuery({
        queryKey: ['workShift', 'current', globalEmployeeId],
        queryFn: () => fetchWorkShift(globalEmployeeId ?? null),
        enabled: !!globalEmployeeId,
        staleTime: 5 * 60 * 1000, 
    });

    // Realtime removed as we rely on query invalidation from actions
    
    return {
        activeShift: data?.activeShift ?? null,
        hasActiveShift: !!data?.activeShift,
        loading: isLoading,
        employeeId: data?.employeeId ?? null
    };
};
