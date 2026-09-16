import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Stack,
    Typography,
    Box,
    TextField,
    MenuItem,
    CircularProgress,
    Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import dayjs from "dayjs";

import { assembleDailySummary } from "../../../services/dailySummary";
import { generateDailySummaryPDF } from "../../../utility/dailySummaryPdf";
import { useReportBranchScope, useReportCurrency } from "../../../hooks/useReportBranchScope";
import { usePermissions } from "../../../hooks/usePermissions";
import { useEmployees } from "../../../hooks/useEmployees";
import type { EmployeesRow } from "../../expenses/types";

interface DailySummaryDialogProps {
    open: boolean;
    onClose: () => void;
    /** Стартовая дата (YYYY-MM-DD); по умолчанию — выбранная на странице/сегодня. */
    initialDate?: string;
}

// «Ответственный» в сводке = руководитель филиала (заказчик: там всегда руководитель).
// Роль руководителя — slug `manager` (управляющий); ловим и возможные display-варианты.
const MANAGER_ROLE_TOKENS = ["manager", "управляющий", "руководитель", "администратор", "administrator", "admin"];
const isManagerRole = (role?: string): boolean =>
    MANAGER_ROLE_TOKENS.includes((role ?? "").toLowerCase().trim());

const DailySummaryDialog: React.FC<DailySummaryDialogProps> = ({ open, onClose, initialDate }) => {
    const { t } = useTranslation();
    const { branch } = useReportBranchScope();
    const { suffix: currencySuffix } = useReportCurrency();
    const { employeeId } = usePermissions();
    // Сотрудники строго филиала сводки: бэк отклоняет responsibleEmployee
    // из другого филиала (400).
    const { employees, loading: employeesLoading } = useEmployees(open, branch?.id);

    const brandName = branch?.brandName || branch?.name || "Academy KG";

    const [date, setDate] = useState<string>(initialDate ?? dayjs().format("YYYY-MM-DD"));
    const [responsible, setResponsible] = useState<EmployeesRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDate(initialDate ?? dayjs().format("YYYY-MM-DD"));
            setError(null);
        }
    }, [open, initialDate]);

    // Руководители филиала (роль manager). Если их несколько — даём выбор;
    // один — read-only; ноль — fallback на текущего пользователя + предупреждение.
    const managers = useMemo(() => employees.filter((e) => isManagerRole(e.role)), [employees]);

    useEffect(() => {
        if (!open || !employees.length) return;
        setResponsible((prev) => {
            // Сохраняем выбор пользователя, если он всё ещё в списке филиала.
            if (prev && employees.some((e) => e.id === prev.id)) return prev;
            // Дефолт — руководитель филиала, иначе текущий пользователь.
            return managers[0] ?? employees.find((e) => e.id === employeeId) ?? null;
        });
    }, [open, employees, managers, employeeId]);

    const handleGenerate = async () => {
        if (!branch?.id) {
            setError(t("salaryReports.selectSpecificBranch"));
            return;
        }
        if (!date || !dayjs(date).isValid()) {
            setError(t("salaryReports.specifySummaryDate"));
            return;
        }
        if (dayjs(date).isAfter(dayjs(), "day")) {
            setError(t("salaryReports.futureDateError"));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // ФИО только при выбранном id: без responsibleEmployee бэк отдаёт
            // нули, и секция с ФИО вводила бы в заблуждение (PDF её опустит).
            const data = await assembleDailySummary({
                date,
                responsibleName: responsible?.full_name ?? "",
                responsibleEmployeeId: responsible?.id ?? null,
                branchId: branch.id,
            });

            const blob = await generateDailySummaryPDF(data, currencySuffix);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `svodka_${date}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError(e?.message || t("salaryReports.summaryGenerationError"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={800}>{t("salaryReports.daySummary")}</Typography>
                    <Typography variant="caption" color="text.secondary">{brandName}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" disabled={loading} aria-label={t("common.close")}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        {t("salaryReports.selectDayHint")}
                    </Typography>

                    <TextField
                        label={t("reports.date")}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={loading}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: dayjs().format("YYYY-MM-DD") }}
                    />

                    {/* Ответственный — любой сотрудник филиала (по умолчанию руководитель).
                        Его расходы за день и за период попадут в сводку. */}
                    <TextField
                        select
                        label={t("salaryReports.responsibleEmployee")}
                        value={responsible?.id ?? ""}
                        onChange={(e) =>
                            setResponsible(employees.find((emp) => emp.id === e.target.value) ?? null)
                        }
                        disabled={loading || employeesLoading || !employees.length}
                        fullWidth
                        size="small"
                        helperText={
                            employeesLoading
                                ? t("salaryReports.loadingEmployees")
                                : !employees.length
                                    ? t("salaryReports.noBranchEmployees")
                                    : t("salaryReports.responsibleEmployeeHint")
                        }
                    >
                        {employees.map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                                {emp.full_name}
                                {isManagerRole(emp.role) ? ` — ${t("salaryReports.managerSuffix")}` : ""}
                            </MenuItem>
                        ))}
                    </TextField>

                    {error && (
                        <Alert severity="error" variant="outlined" sx={{ fontSize: "0.8rem" }}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, justifyContent: "flex-end" }}>
                <Stack direction="row" spacing={1}>
                    <Button onClick={onClose} disabled={loading}>{t("common.cancel")}</Button>
                    <Button
                        variant="contained"
                        onClick={handleGenerate}
                        // employeesLoading: иначе можно сформировать до подстановки
                        // дефолтного ответственного — PDF уйдёт без его расходов
                        disabled={loading || employeesLoading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                    >
                        {t("salaryReports.generatePdf")}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default DailySummaryDialog;
