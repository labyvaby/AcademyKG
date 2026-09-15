import React from "react";
import { useTranslation } from "react-i18next";
import {
    Card,
    CardContent,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableFooter,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";

import type { BranchOption } from "../../../contexts/branch-context";
import type { CashboxSummaryData } from "../../../types/cashbox";
import { DEFAULT_CURRENCY, formatMoney } from "../../../utility/currency";

export type CashboxBranchRow = {
    branch: BranchOption;
    data?: CashboxSummaryData;
    loading: boolean;
    error?: string;
};

type Props = {
    rows: CashboxBranchRow[];
    onSelectBranch: (branch: BranchOption) => void;
};

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

// Режим «Все филиалы»: бэк без branch/organization отвечает 400, а суммы филиалов
// в разных валютах складывать нельзя — поэтому строка на филиал и итоги по валютам.
export const CashboxBranchesTable: React.FC<Props> = ({ rows, onSelectBranch }) => {
    const { t } = useTranslation();

    const totalsByCurrency = React.useMemo(() => {
        const map = new Map<string, { cash: number; card: number; count: number }>();
        for (const r of rows) {
            if (!r.data) continue;
            const cur = r.branch.currency || DEFAULT_CURRENCY;
            const acc = map.get(cur) ?? { cash: 0, card: 0, count: 0 };
            acc.cash += n(r.data.net.cashSum);
            acc.card += n(r.data.net.cardSum);
            acc.count += r.data.counts.appointmentsCount;
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
                <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 640 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.branch")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cash")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.cashless")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.total")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.appointments")}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map(({ branch, data, loading, error }) => {
                                const cur = branch.currency;
                                const cash = n(data?.net.cashSum);
                                const card = n(data?.net.cardSum);
                                return (
                                    <TableRow
                                        key={branch.id}
                                        hover
                                        onClick={() => onSelectBranch(branch)}
                                        sx={{ cursor: "pointer" }}
                                    >
                                        <TableCell sx={{ fontWeight: 600 }}>{branch.brandName || branch.name}</TableCell>
                                        {loading ? (
                                            <TableCell colSpan={4} align="right">
                                                <CircularProgress size={16} />
                                            </TableCell>
                                        ) : error || !data ? (
                                            <TableCell colSpan={4} align="right" sx={{ color: "error.main" }}>
                                                {error || t("cashbox.loadFailed")}
                                            </TableCell>
                                        ) : (
                                            <>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(cash, cur)}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatMoney(card, cur)}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                                                    {formatMoney(cash + card, cur)}
                                                </TableCell>
                                                <TableCell align="right">{data.counts.appointmentsCount}</TableCell>
                                            </>
                                        )}
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
                                        <TableCell align="right">{v.count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableFooter>
                        )}
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
};

export default CashboxBranchesTable;
