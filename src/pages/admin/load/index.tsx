import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { fetchAllPages } from '../../../utility/pagination';
import { dayjsBranch } from '../../../utility/branchTime';
import { mapAggregatedRowToAppointment, type AggregatedAppointmentRow } from '../../home/types';
import dayjs, { Dayjs } from 'dayjs';

import { LoadFilters } from './LoadFilters';
import { LoadChart } from './LoadChart';
import { LoadSummaryCard } from './LoadSummaryCard';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { useBranchContext } from '../../../contexts/branch-context';

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

export const LoadAnalyticsPage: React.FC = () => {
    const { t } = useTranslation();
    usePageTitle(t("menu.load"));
    const { selectedBranch } = useBranchContext();
    const branchId = selectedBranch?.id ?? "all";
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([dayjs().startOf('day'), dayjs().endOf('day')]);

    const dateFrom = dateRange[0]?.format('YYYY-MM-DD');
    const dateTo = dateRange[1]?.format('YYYY-MM-DD');

    // Fetch appointments for the selected date range
    const { data: appointments, isLoading } = useQuery({
        queryKey: ['appointmentsLoad', branchId, dateFrom, dateTo],
        queryFn: async () => {
            // Бэк принимает даты в формате YYYY-MM-DD и отдаёт camelCase —
            // все страницы забираем через fetchAllPages и нормализуем общим маппером.
            const params = new URLSearchParams({ dateFrom: dateFrom!, dateTo: dateTo! });
            const rows = await fetchAllPages<AggregatedAppointmentRow>(`/api/v1/appointments/?${params.toString()}`);
            return rows
                .filter(r => !CANCELLED_STATUSES.has(String((r as any).status ?? '').toLowerCase()))
                .map(mapAggregatedRowToAppointment);
        },
        enabled: !!dateFrom && !!dateTo,
    });

    // Filter by employee locally to avoid refetching on UI changes.
    const filteredData = useMemo(() => {
        if (!appointments) return [];
        if (selectedEmployees.length === 0) return appointments;

        return appointments.filter(app =>
            Array.isArray(app.performer_ids) &&
            app.performer_ids.some((id: string) => selectedEmployees.includes(id))
        );
    }, [appointments, selectedEmployees]);

    // Aggregate into hourly bins
    const chartData = useMemo(() => {
        const bins: Record<string, number> = {};

        // Initialize all 24 hours of the day (00:00 to 23:00)
        for (let i = 0; i < 24; i++) {
            const hourStr = i.toString().padStart(2, '0') + ':00';
            bins[hourStr] = 0;
        }

        filteredData.forEach(app => {
            if (app.appointment_at) {
                const hour = dayjsBranch(app.appointment_at).hour();
                const hourStr = hour.toString().padStart(2, '0') + ':00';
                // Only count within 8-22 or add dynamically
                if (bins[hourStr] !== undefined) {
                    bins[hourStr] += 1;
                }
            }
        });

        return Object.entries(bins)
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [filteredData]);

    const daysCount = useMemo(() => {
        if (!dateRange[0] || !dateRange[1]) return 1;
        const diff = dateRange[1].diff(dateRange[0], 'day') + 1;
        return diff > 0 ? diff : 1;
    }, [dateRange]);

    return (
        <Box
            sx={{
                p: 2,
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <Typography variant="h5" sx={{ fontWeight: 600 }}>{t("admin.loadAnalyticsTitle")}</Typography>

            <LoadFilters
                selectedEmployees={selectedEmployees}
                onEmployeesChange={setSelectedEmployees}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            />

            <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0, flexDirection: { xs: 'column', md: 'row' } }}>
                <Paper sx={{
                    p: { xs: 1.5, sm: 2 },
                    flex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    minHeight: { xs: 260, sm: 320, md: 0 },
                }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <LoadChart data={chartData} />
                    )}
                </Paper>
                <Box sx={{ flex: 1, minWidth: { md: 280 } }}>
                    <LoadSummaryCard data={chartData} totalAppointments={filteredData.length} daysCount={daysCount} />
                </Box>
            </Box>
        </Box>
    );
};
