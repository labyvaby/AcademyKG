import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Grid2,
    Card,
    CardContent,
    Typography,
    Skeleton,
    Stack,
    Box,
    alpha,
    useTheme
} from '@mui/material';
import { supabase } from '../../../utility/supabaseClient';
import { formatKGS } from '../../../utility/format';

interface ExtraCard {
    title: string;
    primaryValue: string;
    secondaryText: string;
    color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

interface AppointmentsSummaryCardsProps {
    dateFrom: string;
    dateTo: string;
    employeeId?: string;
    appointments?: any[];
    extraCards?: ExtraCard[];
}

// Force Vite HMR reload
export const AppointmentsSummaryCards: React.FC<AppointmentsSummaryCardsProps> = ({
    dateFrom,
    dateTo,
    employeeId,
    appointments: providedAppointments,
    extraCards = [],
}) => {
    const theme = useTheme();

    const { data: fetchedAppointments, isLoading } = useQuery({
        queryKey: ['appointments-summary', dateFrom, dateTo, employeeId],
        queryFn: async () => {
            if (providedAppointments) return providedAppointments;
            let query = supabase
                .from('AppointmentsAggregated')
                .select('status, paid_cash, paid_card, discount, doctor_id, performer_ids')
                .gte('appointment_at', dateFrom)
                .lte('appointment_at', dateTo)
                .limit(10000);

            if (employeeId) {
                query = query.or(`doctor_id.eq.${employeeId},performer_ids.cs.{${employeeId}}`);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        },
        enabled: !providedAppointments,
        staleTime: 5 * 60 * 1000,
    });

    const appointments = providedAppointments || fetchedAppointments || [];

    const metrics = useMemo(() => {
        let total = 0;
        let waiting = 0;
        let cancelled = 0;
        let discountedCount = 0;
        let discountSum = 0;
        let paidCount = 0;
        let paidSum = 0;

        appointments.forEach((app: any) => {
            const isWaiting = app.status === 'Ожидаем' || app.status === 'Клиент здесь';
            const isCancelled = app.status === 'Отменено' || app.status === 'Клиент не пришел';

            if (!isWaiting && !isCancelled) {
                total++;
            }

            if (isWaiting) {
                waiting++;
            }

            if (isCancelled) {
                cancelled++;
            }

            if (app.status === 'Со скидкой' || app.status === 'Бесплатно') {
                discountedCount++;
                discountSum += Number(app.discount || 0);
            }

            if (app.status === 'Оплачено' || app.status === 'Частично оплачено' || app.status === 'Со скидкой' || app.status === 'Бесплатно' || app.status === 'Завершено') {
                paidCount++;
                paidSum += Number(app.paid_cash || 0) + Number(app.paid_card || 0);
            }
        });

        return {
            total,
            waiting,
            cancelled,
            discountedCount,
            discountSum,
            paidCount,
            paidSum
        };
    }, [appointments]);

    const baseCards = [
        {
            title: 'Оплачено',
            primaryValue: metrics.paidCount.toString(),
            secondaryText: `Всего: ${metrics.total} · Отменено: ${metrics.cancelled}`,
            color: 'success' as const
        },
        {
            title: 'Со скидкой',
            primaryValue: metrics.discountedCount.toString(),
            secondaryText: `Сумма скидок: ${formatKGS(metrics.discountSum)}`,
            color: 'info' as const
        },
        {
            title: 'Ожидание',
            primaryValue: metrics.waiting.toString(),
            secondaryText: 'Ожидают или здесь',
            color: 'warning' as const
        },
        {
            title: 'Отменены',
            primaryValue: metrics.cancelled.toString(),
            secondaryText: 'Не пришли или отменены',
            color: 'error' as const
        },
        ...extraCards,
    ];

    const totalCards = baseCards.length;
    // For small counts use equal grid fractions; for large counts use flex
    const useFlex = totalCards > 6;
    const lgSize = useFlex ? undefined : Math.floor(12 / totalCards) as any;

    if (!providedAppointments && isLoading) {
        return (
            <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, flexWrap: 'wrap' }}>
                {Array.from({ length: totalCards }).map((_, i) => (
                    <Box key={i} sx={{ flex: '1 1 140px', minWidth: 0 }}>
                        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 3 }} />
                    </Box>
                ))}
            </Box>
        );
    }

    if (useFlex) {
        return (
            <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
                {baseCards.map((card, idx) => (
                    <Box key={idx} sx={{ flex: '1 1 0', minWidth: { xs: 'calc(50% - 4px)', lg: 0 } }}>
                        <Card
                            variant="outlined"
                            sx={{
                                background: `linear-gradient(135deg, ${alpha(theme.palette[card.color].main, 0.02)} 0%, ${alpha(theme.palette[card.color].main, 0.1)} 100%)`,
                                border: `1px solid ${alpha(theme.palette[card.color].main, 0.2)}`,
                                borderRadius: { xs: 1.5, md: 3 },
                                height: '100%'
                            }}
                        >
                            <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                                <Stack spacing={0}>
                                    <Typography
                                        sx={{
                                            color: `${card.color}.main`,
                                            fontWeight: 700,
                                            fontSize: { xs: '0.6rem', md: '0.65rem' },
                                            letterSpacing: 0.5,
                                            textTransform: 'uppercase',
                                            lineHeight: 1.3
                                        }}
                                    >
                                        {card.title}
                                    </Typography>
                                    <Box>
                                        <Typography
                                            fontWeight={800}
                                            noWrap
                                            sx={{
                                                color: `${card.color}.dark`,
                                                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                                                lineHeight: 1.1
                                            }}
                                        >
                                            {card.primaryValue}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        noWrap
                                        sx={{
                                            color: 'text.secondary',
                                            fontWeight: 500,
                                            display: 'block',
                                            fontSize: { xs: '0.55rem', md: '0.6rem' },
                                            lineHeight: 1.3
                                        }}
                                    >
                                        {card.secondaryText}
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Box>
                ))}
            </Box>
        );
    }

    return (
        <Grid2 container spacing={{ xs: 1, md: 2 }}>
            {baseCards.map((card, idx) => (
                <Grid2 key={idx} size={{ xs: 6, lg: lgSize }}>
                    <Card
                        variant="outlined"
                        sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette[card.color].main, 0.02)} 0%, ${alpha(theme.palette[card.color].main, 0.1)} 100%)`,
                            border: `1px solid ${alpha(theme.palette[card.color].main, 0.2)}`,
                            borderRadius: { xs: 1.5, md: 3 },
                            height: '100%'
                        }}
                    >
                        <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                            <Stack spacing={0}>
                                <Typography
                                    sx={{
                                        color: `${card.color}.main`,
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', md: '0.7rem' },
                                        letterSpacing: 0.5,
                                        textTransform: 'uppercase',
                                        lineHeight: 1.3
                                    }}
                                >
                                    {card.title}
                                </Typography>
                                <Box>
                                    <Typography
                                        fontWeight={800}
                                        noWrap
                                        sx={{
                                            color: `${card.color}.dark`,
                                            fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
                                            lineHeight: 1.1
                                        }}
                                    >
                                        {card.primaryValue}
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 500,
                                        display: 'block',
                                        fontSize: { xs: '0.6rem', md: '0.7rem' },
                                        lineHeight: 1.3
                                    }}
                                >
                                    {card.secondaryText}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid2>
            ))}
        </Grid2>
    );
};
