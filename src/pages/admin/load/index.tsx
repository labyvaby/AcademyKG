import React, { useState, useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../utility/apiClient';
import dayjs, { Dayjs } from 'dayjs';

import { LoadFilters } from './LoadFilters';
import { LoadChart } from './LoadChart';
import { LoadSummaryCard } from './LoadSummaryCard';
import { usePageTitle } from '../../../hooks/usePageTitle';

export const LoadAnalyticsPage: React.FC = () => {
    usePageTitle("Нагрузка");
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([dayjs().startOf('day'), dayjs().endOf('day')]);

    // Fetch appointments for the selected date range
    const { data: appointments, isLoading } = useQuery({
        queryKey: ['appointmentsLoad', dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
        queryFn: async () => {
            const params = new URLSearchParams({ pageSize: '500', excludeStatus: 'cancelled' });
            if (dateRange[0]) params.set('dateFrom', dateRange[0].startOf('day').toISOString());
            if (dateRange[1]) params.set('dateTo', dateRange[1].endOf('day').toISOString());
            const res: any = await apiFetch(`/api/v1/appointments/?${params.toString()}`);
            return (res?.data?.results ?? res?.results ?? []) as { id: string; appointment_at: string; performer_ids?: string[]; status: string }[];
        },
        enabled: !!dateRange[0] && !!dateRange[1],
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
                const hour = dayjs(app.appointment_at).hour();
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
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Нагрузка (Аналитика)</Typography>

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
