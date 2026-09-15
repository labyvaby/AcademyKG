import React from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Card,
    CardContent,
    Chip,
    Grid2,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    Avatar,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import WalletIcon from "@mui/icons-material/Wallet";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import FunctionsIcon from "@mui/icons-material/Functions";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { CashboxSummaryData } from "../../../types/cashbox";

type Props = {
    data: CashboxSummaryData;
    format: (value: number | string | null | undefined) => string;
};

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

// Расшифровка кассы одного филиала: приход − расходы ± корректировки = остаток.
export const CashboxBreakdown: React.FC<Props> = ({ data, format }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    const income = { cash: n(data.appointments.cashSum), card: n(data.appointments.cardSum) };
    const expenses = { cash: n(data.expenses.cashSum), card: n(data.expenses.cashlessSum) };
    const net = { cash: n(data.net.cashSum), card: n(data.net.cardSum) };
    // Корректировки выводим как разницу: net − (приход − расходы). Так строка всегда
    // сходится с итогом, какой бы знак ни был у adjustments.*NetSum на бэке
    // (сейчас везде 0, знак не подтверждён — см. тикет 2026-09-15-cashbox).
    const adjustments = {
        cash: net.cash - (income.cash - expenses.cash),
        card: net.card - (income.card - expenses.card),
    };
    const hasAdjustments = adjustments.cash !== 0 || adjustments.card !== 0 || data.counts.adjustmentsCount > 0;

    const nonCash = { balance: n(data.appointments.balanceSum), bonuses: n(data.appointments.bonusesSum) };
    const isEmpty =
        data.counts.appointmentsCount === 0 &&
        data.counts.expensesCount === 0 &&
        data.counts.adjustmentsCount === 0 &&
        net.cash === 0 &&
        net.card === 0;

    const kpi = (
        title: string,
        value: number,
        color: "success" | "info" | "primary",
        icon: React.ReactNode,
    ) => (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 4,
                height: "100%",
                bgcolor: alpha(theme.palette[color].main, 0.04),
                borderColor: alpha(theme.palette[color].main, 0.14),
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box minWidth={0}>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 700, mb: 0.75 }}>
                            {title}
                        </Typography>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 900,
                                color: `${color}.main`,
                                fontSize: { xs: "1.7rem", md: "2.2rem" },
                                lineHeight: 1.1,
                                wordBreak: "break-word",
                            }}
                        >
                            {format(value)}
                        </Typography>
                    </Box>
                    <Avatar
                        sx={{
                            width: { xs: 48, md: 60 },
                            height: { xs: 48, md: 60 },
                            bgcolor: alpha(theme.palette[color].main, 0.12),
                            color: `${color}.main`,
                            flexShrink: 0,
                        }}
                    >
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </Card>
    );

    const signed = (value: number, sign: "+" | "−" | "±") => {
        if (value === 0) return format(0);
        if (sign === "±") return `${value > 0 ? "+" : "−"} ${format(Math.abs(value))}`;
        return `${sign} ${format(Math.abs(value))}`;
    };

    const row = (
        label: React.ReactNode,
        cash: string,
        card: string,
        total: string,
        opts: { bold?: boolean; count?: number; tone?: "success" | "error" | "warning" } = {},
    ) => (
        <TableRow
            sx={opts.bold ? { "& td": { borderBottom: "none", fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.04) } } : undefined}
        >
            <TableCell sx={{ fontWeight: opts.bold ? 800 : 600 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <span>{label}</span>
                    {opts.count !== undefined && (
                        <Chip size="small" variant="outlined" label={t("cashbox.operationsCount", { count: opts.count })} />
                    )}
                </Stack>
            </TableCell>
            {[cash, card, total].map((v, i) => (
                <TableCell
                    key={i}
                    align="right"
                    sx={{ whiteSpace: "nowrap", color: opts.tone ? `${opts.tone}.main` : undefined, fontWeight: opts.bold ? 800 : 500 }}
                >
                    {v}
                </TableCell>
            ))}
        </TableRow>
    );

    return (
        <Stack spacing={2.5}>
            <Grid2 container spacing={2.5}>
                <Grid2 size={{ xs: 12, md: 4 }}>
                    {kpi(t("cashbox.cash"), net.cash, "success", <WalletIcon />)}
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                    {kpi(t("cashbox.cashless"), net.card, "info", <CreditCardIcon />)}
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                    {kpi(t("cashbox.totalMoney"), net.cash + net.card, "primary", <FunctionsIcon />)}
                </Grid2>
            </Grid2>

            {isEmpty && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    {t("cashbox.emptyPeriod")}
                </Typography>
            )}

            <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                        {t("cashbox.movementTitle")}
                    </Typography>
                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small" sx={{ minWidth: 560 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell />
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cash")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cashless")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.total")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {row(
                                    t("cashbox.incomeAppointments"),
                                    signed(income.cash, "+"),
                                    signed(income.card, "+"),
                                    signed(income.cash + income.card, "+"),
                                    { count: data.counts.appointmentsCount, tone: "success" },
                                )}
                                {row(
                                    t("cashbox.expenses"),
                                    signed(expenses.cash, "−"),
                                    signed(expenses.card, "−"),
                                    signed(expenses.cash + expenses.card, "−"),
                                    { count: data.counts.expensesCount, tone: "error" },
                                )}
                                {hasAdjustments &&
                                    row(
                                        <Tooltip
                                            title={t("cashbox.adjustmentsHint", {
                                                refunds: format(data.adjustments.refundsSum),
                                                reversals: format(data.adjustments.reversalsSum),
                                                adjustments: format(data.adjustments.adjustmentsSum),
                                            })}
                                        >
                                            <Stack direction="row" spacing={0.5} alignItems="center" component="span">
                                                <span>{t("cashbox.adjustments")}</span>
                                                <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                            </Stack>
                                        </Tooltip>,
                                        signed(adjustments.cash, "±"),
                                        signed(adjustments.card, "±"),
                                        signed(adjustments.cash + adjustments.card, "±"),
                                        { count: data.counts.adjustmentsCount, tone: "warning" },
                                    )}
                                {row(
                                    t("cashbox.netForPeriod"),
                                    format(net.cash),
                                    format(net.card),
                                    format(net.cash + net.card),
                                    { bold: true },
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                        {t("cashbox.turnoverNote")}
                    </Typography>
                </CardContent>
            </Card>

            {(nonCash.balance !== 0 || nonCash.bonuses !== 0) && (
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {t("cashbox.nonCashTitle")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {t("cashbox.nonCashNote")}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 4 }}>
                            <Typography>
                                {t("cashbox.paidByBalance")}: <b>{format(nonCash.balance)}</b>
                            </Typography>
                            <Typography>
                                {t("cashbox.paidByBonuses")}: <b>{format(nonCash.bonuses)}</b>
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    );
};

export default CashboxBreakdown;
