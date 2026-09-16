import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { getCashboxEntries } from "../../../services/cashbox";
import type { CashboxEntry, CashboxEntryMethod, CashboxEntryType } from "../../../types/cashbox";
import { dayjsBranch } from "../../../utility/branchTime";
import { formatMoney } from "../../../utility/currency";

const ENTRY_TYPES: CashboxEntryType[] = [
    "payment",
    "balance_topup",
    "refund",
    "expense",
    "payroll_advance",
    "payroll_payout",
    "cash_in",
    "cash_out",
    "collection",
];
const ENTRY_METHODS: CashboxEntryMethod[] = ["cash", "card", "balance", "bonuses"];
const PAGE_SIZES = [25, 50, 100];

type Props = {
    branchId?: string;
    /** Режим «Все филиалы»: скоуп по организации, в таблице появляется колонка филиала */
    organizationId?: string;
    dateFrom: string;
    dateTo: string;
    /** Валюта выбранного филиала; в режиме «Все филиалы» берётся по филиалу строки */
    currency?: string;
    branchNameById: (id: string | null) => string;
    branchCurrencyById: (id: string | null) => string | undefined;
};

const n = (v: unknown): number => {
    const x = Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};

const typeColor = (type: CashboxEntryType): "success" | "error" | "warning" | "info" | "default" => {
    switch (type) {
        case "payment":
        case "balance_topup":
            return "success";
        case "expense":
        case "payroll_advance":
        case "payroll_payout":
        case "refund":
            return "error";
        case "cash_in":
        case "cash_out":
        case "collection":
            return "warning";
        default:
            return "default";
    }
};

// Журнал операций кассы (B1): одна строка = одно движение одним способом.
// Пагинация серверная (DRF внутри data), сортировка occurredAt desc.
export const CashboxJournal: React.FC<Props> = ({ branchId, organizationId, dateFrom, dateTo, currency, branchNameById, branchCurrencyById }) => {
    const { t } = useTranslation();
    const [type, setType] = useState<CashboxEntryType | "">("");
    const [method, setMethod] = useState<CashboxEntryMethod | "">("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

    // Любая смена фильтра/периода — на первую страницу.
    useEffect(() => {
        setPage(0);
    }, [branchId, organizationId, dateFrom, dateTo, type, method, pageSize]);

    const query = useQuery({
        queryKey: ["cashbox-entries", branchId, organizationId, dateFrom, dateTo, type, method, page, pageSize],
        queryFn: ({ signal }) =>
            getCashboxEntries({
                branch: branchId,
                organization: branchId ? undefined : organizationId,
                dateFrom,
                dateTo,
                type: type || undefined,
                method: method || undefined,
                page: page + 1,
                pageSize,
                signal,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: CashboxEntry[] = query.data?.results ?? [];
    const count = query.data?.count ?? 0;
    const showBranch = !branchId;

    const amountCell = (e: CashboxEntry) => {
        const v = n(e.amount);
        const sign = e.direction === "out" ? "−" : "+";
        const money = e.method === "cash" || e.method === "card";
        return (
            <Typography
                component="span"
                sx={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    color: !money ? "text.secondary" : e.direction === "out" ? "error.main" : "success.main",
                }}
            >
                {sign} {formatMoney(v, currency ?? branchCurrencyById(e.branch))}
            </Typography>
        );
    };

    return (
        <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "stretch", md: "center" }}
                    sx={{ mb: 2 }}
                >
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {t("cashbox.journalTitle")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t("cashbox.journalNote")}
                        </Typography>
                    </Box>
                    <TextField
                        select
                        size="small"
                        label={t("cashbox.entryType")}
                        value={type}
                        onChange={(e) => setType(e.target.value as CashboxEntryType | "")}
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">{t("cashbox.allTypes")}</MenuItem>
                        {ENTRY_TYPES.map((v) => (
                            <MenuItem key={v} value={v}>
                                {t(`cashbox.entryTypes.${v}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        size="small"
                        label={t("cashbox.entryMethod")}
                        value={method}
                        onChange={(e) => setMethod(e.target.value as CashboxEntryMethod | "")}
                        sx={{ minWidth: 160 }}
                    >
                        <MenuItem value="">{t("cashbox.allMethods")}</MenuItem>
                        {ENTRY_METHODS.map((v) => (
                            <MenuItem key={v} value={v}>
                                {t(`cashbox.methods.${v}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                </Stack>

                {query.isLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : query.error ? (
                    <Typography color="error.main" textAlign="center" sx={{ py: 4 }}>
                        {(query.error as Error).message || t("cashbox.loadFailed")}
                    </Typography>
                ) : rows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                        {t("cashbox.journalEmpty")}
                    </Typography>
                ) : (
                    <TableContainer sx={{ overflowX: "auto", opacity: query.isFetching ? 0.6 : 1 }}>
                        <Table size="small" sx={{ minWidth: 760 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{t("cashbox.entryDate")}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryType")}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryDescription")}</TableCell>
                                    {showBranch && <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.branch")}</TableCell>}
                                    <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryMethod")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t("cashbox.entryAmount")}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{t("cashbox.entryCreatedBy")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((e) => (
                                    <TableRow key={e.id} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {dayjsBranch(e.occurredAt).format("DD.MM.YYYY HH:mm")}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                color={typeColor(e.type)}
                                                variant="outlined"
                                                label={t(`cashbox.entryTypes.${e.type}`, { defaultValue: e.type })}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 360 }}>{e.description || "—"}</TableCell>
                                        {showBranch && <TableCell>{branchNameById(e.branch)}</TableCell>}
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            {t(`cashbox.methods.${e.method}`, { defaultValue: e.method })}
                                        </TableCell>
                                        <TableCell align="right">{amountCell(e)}</TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{e.createdBy?.fullName || "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {count > 0 && (
                    <TablePagination
                        component="div"
                        count={count}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={pageSize}
                        onRowsPerPageChange={(e) => setPageSize(Number(e.target.value))}
                        rowsPerPageOptions={PAGE_SIZES}
                        labelRowsPerPage={t("cashbox.rowsPerPage")}
                        labelDisplayedRows={({ from, to, count: c }) => `${from}–${to} / ${c}`}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default CashboxJournal;
