import { useState, useEffect } from "react";
import { apiFetch } from "../utility/apiClient";
import dayjs from "dayjs";

/**
 * Загружает уникальные месяцы из appointments-aggregated за последние 3 года.
 * Возвращает Set<'YYYY-MM'> или null пока загружается.
 */
export function useActiveMonths(
    _table: string,
    _dateColumn: string,
    enabled: boolean = true
): Set<string> | null {
    const [activeMonths, setActiveMonths] = useState<Set<string> | null>(null);

    useEffect(() => {
        if (!enabled) {
            setActiveMonths(null);
            return;
        }

        let cancelled = false;

        const fetchMonths = async () => {
            try {
                const threeYearsAgo = dayjs().subtract(3, 'year').startOf('month').format('YYYY-MM-DD');
                const oneYearAhead = dayjs().add(1, 'year').endOf('month').format('YYYY-MM-DD');

                const res: any = await apiFetch(`/api/v1/appointments/`);

                if (cancelled) return;

                const items: any[] = res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : []);
                const months = new Set<string>();
                items.forEach((row: any) => {
                    const val = row.appointmentAt ?? row.appointment_at;
                    if (val) months.add(dayjs(val).format('YYYY-MM'));
                });

                setActiveMonths(months);
            } catch (e) {
                console.error('useActiveMonths error:', e);
                // Вернуть пустой Set чтобы не блокировать UI
                if (!cancelled) setActiveMonths(new Set());
            }
        };

        fetchMonths();
        return () => { cancelled = true; };
    }, [enabled]);

    return activeMonths;
}
