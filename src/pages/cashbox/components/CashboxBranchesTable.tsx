import React from "react";
import { useTranslation } from "react-i18next";
import {
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableFooter,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";

import type { CashboxBranchSummary } from "../../../types/cashbox";
import { DEFAULT_CURRENCY, formatMoney } from "../../../utility/currency";

type Props = {
    rows: CashboxBranchSummary[];
    onSelectBranch: (branchId: string) => void;
};

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

// Режим «Все филиалы»: одна сводка по организации с byBranch[] (ответ бэка A2).
// Верхний уровень бэк суммирует «как есть», а суммы в разных валютах складывать
// нельзя — поэтому строка на филиал и итоги отдельно по каждой валюте.
export const CashboxBranchesTable: React.FC<Props> = ({ rows, onSelectBranch }) => {
    const { t } = useTranslation();

    const totalsByCurrency = React.useMemo(() => {
        const map = new Map<string, { cash: number; card: number; closingCash: number; count: number }>();
        for (const r of rows) {
            const cur = r.currency || DEFAULT_CURRENCY;
            const acc = map.get(cur) ?? { cash: 0, card: 0, closingCash: 0, count: 0 };
            acc.cash += n(r.net.cashSum);
            acc.card += n(r.net.cardSum);
            acc.closingCash += n(r.closingBalance?.cash);
            acc.count += r.counts.appointmentsCount;
            map.set(cur, acc);
        }
        return Array.from(map.entries());
    }, [rows]);

    return (
        <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {t("cashbox.byBranchesTitle")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {t("cashbox.byBranchesNote")}
                </Typography>
                {rows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                        {t("cashbox.emptyPeriod")}
                    </Typography>
                ) : (
                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small" sx={{ minWidth: 720 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.branch")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cash")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cashless")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.total")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cashOnHand")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.appointments")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((r) => {
                                    const cur = r.currency || undefined;
                                    const cash = n(r.net.cashSum);
                                    const card = n(r.net.cardSum);
                                    return (
                                        <TableRow
                                            key={r.branchId}
                                            hover
                                            onClick={() => onSelectBranch(r.branchId)}
                                            sx={{ cursor: "pointer" }}
                                        >
                                            <TableCell sx={{ fontWeight: 600 }}>{r.branchName}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(cash, cur)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(card, cur)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                                                {formatMoney(cash + card, cur)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                {r.closingBalance ? formatMoney(n(r.closingBalance.cash), cur) : "—"}
                                            </TableCell>
                                            <TableCell align="right">{r.counts.appointmentsCount}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            {totalsByCurrency.length > 0 && (
                                <TableFooter>
                                    {totalsByCurrency.map(([cur, v]) => (
                                        <TableRow key={cur} sx={{ "& td": { fontWeight: 800, color: "text.primary", fontSize: "0.875rem" } }}>
                                            <TableCell>{t("cashbox.totalInCurrency", { currency: cur })}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(v.cash, cur)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(v.card, cur)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(v.cash + v.card, cur)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(v.closingCash, cur)}</TableCell>
                                            <TableCell align="right">{v.count}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableFooter>
                            )}
                        </Table>
                    </TableContainer>
                )}
            </CardContent>
        </Card>
    );
};

export default CashboxBranchesTable;
