import React, { useMemo, useState } from "react";
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
    CircularProgress,
    Alert,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ru";

import { getSpecialistPayslip } from "../../../services/reports";
import { generateSpecialistPayslipPDF } from "../../../utility/specialistPayslipPdf";
import { assemblePayslipAdjustments } from "../../../services/payslipAdjustments";
import { useReportBranchScope } from "../../../hooks/useReportBranchScope";
import type { PeriodHalf } from "../../../types/reports";

dayjs.locale("ru");

interface SpecialistPayslipDialogProps {
    open: boolean;
    onClose: () => void;
    employeeId: string;
    employeeName: string;
    month: string; // YYYY-MM
}

// "first" | "second" — половина месяца; "month" — весь календарный месяц
// (в запрос periodHalf не уходит, бэк отдаёт detailScope: "month").
type RangeMode = PeriodHalf | "month";

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const computeRange = (monthStart: Dayjs, mode: RangeMode): { from: Dayjs; to: Dayjs } => {
    if (mode === "first") {
        return { from: monthStart.date(1), to: monthStart.date(15) };
    }
    if (mode === "second") {
        return { from: monthStart.date(16), to: monthStart.endOf("month") };
    }
    return { from: monthStart.date(1), to: monthStart.endOf("month") };
};

// По умолчанию формируем за весь месяц (пожелание заказчика).
const DEFAULT_RANGE_MODE: RangeMode = "month";

const SpecialistPayslipDialog: React.FC<SpecialistPayslipDialogProps> = ({
    open,
    onClose,
    employeeId,
    employeeName,
    month,
}) => {
    const { branchId } = useReportBranchScope();
    const [monthStart, setMonthStart] = useState<Dayjs>(() => dayjs(`${month}-01`).startOf("month"));
    const [half, setHalf] = useState<RangeMode>(DEFAULT_RANGE_MODE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            const ms = dayjs(`${month}-01`).startOf("month");
            setMonthStart(ms);
            setHalf(DEFAULT_RANGE_MODE);
            setError(null);
        }
    }, [open, month]);

    const range = useMemo(() => computeRange(monthStart, half), [monthStart, half]);

    const periodLabel = useMemo(() => {
        return `с ${range.from.format("DD.MM")} - ${range.to.format("DD.MM.YYYY")}`;
    }, [range]);

    const monthName = useMemo(() => capitalize(monthStart.format("MMMM YYYY")), [monthStart]);

    const renderPdf = async (
        data: Parameters<typeof generateSpecialistPayslipPDF>[0],
        adjustments?: Parameters<typeof generateSpecialistPayslipPDF>[1],
    ) => {
        const blob = await generateSpecialistPayslipPDF(data, adjustments);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payslip_${employeeName.replace(/\s+/g, "_")}_${range.from.format("YYYY-MM-DD")}_${range.to.format("YYYY-MM-DD")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getSpecialistPayslip(
                employeeId,
                monthStart.format("YYYY-MM"),
                half === "month" ? undefined : half,
                branchId,
            );
            if (!res?.data) throw new Error("Пустой ответ от сервера");

            // Авансы/удержания специалиста за период — подмешиваем в дни PDF.
            // Сбой дозагрузки не должен срывать сам расчётный лист.
            let adjustments;
            try {
                adjustments = await assemblePayslipAdjustments({
                    employeeId,
                    month: monthStart.format("YYYY-MM"),
                    dateFrom: range.from.format("YYYY-MM-DD"),
                    dateTo: range.to.format("YYYY-MM-DD"),
                    branchId,
                });
            } catch (adjErr) {
                console.error("payslip adjustments:", adjErr);
            }

            await renderPdf(res.data, adjustments);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError(
                e?.message ||
                    "Не удалось сформировать расчётный лист. Проверьте, что эндпоинт /api/v1/reports/specialist-payslip/ реализован на бэкенде.",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={800}>Расчётный лист</Typography>
                    <Typography variant="caption" color="text.secondary">{employeeName}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" disabled={loading} aria-label="Закрыть">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Выберите месяц и период: половину месяца или весь месяц.
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <IconButton
                            size="small"
                            onClick={() => setMonthStart((m) => m.subtract(1, "month").startOf("month"))}
                            disabled={loading}
                            aria-label="Предыдущий месяц"
                        >
                            <ChevronLeftIcon />
                        </IconButton>
                        <Box textAlign="center" sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={700}>{monthName}</Typography>
                            <Typography variant="caption" color="text.disabled">{periodLabel}</Typography>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={() => setMonthStart((m) => m.add(1, "month").startOf("month"))}
                            disabled={loading}
                            aria-label="Следующий месяц"
                        >
                            <ChevronRightIcon />
                        </IconButton>
                    </Stack>

                    <ToggleButtonGroup
                        value={half}
                        exclusive
                        size="small"
                        onChange={(_, v: RangeMode | null) => v && setHalf(v)}
                        disabled={loading}
                        fullWidth
                    >
                        <ToggleButton value="first">1 – 15</ToggleButton>
                        <ToggleButton value="second">
                            16 – {monthStart.endOf("month").format("DD")}
                        </ToggleButton>
                        <ToggleButton value="month">Весь месяц</ToggleButton>
                    </ToggleButtonGroup>

                    {error && (
                        <Alert severity="error" variant="outlined" sx={{ fontSize: "0.8rem" }}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, justifyContent: "flex-end" }}>
                <Stack direction="row" spacing={1}>
                    <Button onClick={onClose} disabled={loading}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={handleGenerate}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                    >
                        Сформировать PDF
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default SpecialistPayslipDialog;
