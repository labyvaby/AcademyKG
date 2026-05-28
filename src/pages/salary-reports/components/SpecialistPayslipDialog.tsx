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
import { buildMockPayslip } from "../../../utility/specialistPayslipMock";
import { useBranchContext } from "../../../contexts/branch-context";
import type { PeriodHalf } from "../../../types/reports";

dayjs.locale("ru");

interface SpecialistPayslipDialogProps {
    open: boolean;
    onClose: () => void;
    employeeId: string;
    employeeName: string;
    month: string; // YYYY-MM
}

type Half = PeriodHalf;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const computeRange = (monthStart: Dayjs, half: Half): { from: Dayjs; to: Dayjs } => {
    if (half === "first") {
        return { from: monthStart.date(1), to: monthStart.date(15) };
    }
    return { from: monthStart.date(16), to: monthStart.endOf("month") };
};

const defaultHalfFor = (monthStart: Dayjs): Half => {
    const today = dayjs();
    if (today.format("YYYY-MM") !== monthStart.format("YYYY-MM")) return "first";
    return today.date() <= 15 ? "first" : "second";
};

const SpecialistPayslipDialog: React.FC<SpecialistPayslipDialogProps> = ({
    open,
    onClose,
    employeeId,
    employeeName,
    month,
}) => {
    const { selectedBranch } = useBranchContext();
    const [monthStart, setMonthStart] = useState<Dayjs>(() => dayjs(`${month}-01`).startOf("month"));
    const [half, setHalf] = useState<Half>(() => defaultHalfFor(dayjs(`${month}-01`)));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            const ms = dayjs(`${month}-01`).startOf("month");
            setMonthStart(ms);
            setHalf(defaultHalfFor(ms));
            setError(null);
        }
    }, [open, month]);

    const range = useMemo(() => computeRange(monthStart, half), [monthStart, half]);

    const periodLabel = useMemo(() => {
        return `с ${range.from.format("DD.MM")} - ${range.to.format("DD.MM.YYYY")}`;
    }, [range]);

    const monthName = useMemo(() => capitalize(monthStart.format("MMMM YYYY")), [monthStart]);

    const renderPdf = async (data: Parameters<typeof generateSpecialistPayslipPDF>[0]) => {
        const blob = await generateSpecialistPayslipPDF(data);
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
                half,
                selectedBranch?.id ?? undefined,
            );
            if (!res?.data) throw new Error("Пустой ответ от сервера");
            await renderPdf(res.data);
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

    const handleMock = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = buildMockPayslip(
                { id: employeeId, fullName: employeeName, roleName: "Специалист" },
                monthStart.format("YYYY-MM"),
                half,
            );
            await renderPdf(data);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError(e?.message || "Не удалось сформировать mock PDF");
        } finally {
            setLoading(false);
        }
    };

    const showMockButton = import.meta.env.DEV;

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
                        Выберите месяц и половину месяца.
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
                        onChange={(_, v: Half | null) => v && setHalf(v)}
                        disabled={loading}
                        fullWidth
                    >
                        <ToggleButton value="first">1 – 15</ToggleButton>
                        <ToggleButton value="second">
                            16 – {monthStart.endOf("month").format("DD")}
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {error && (
                        <Alert severity="error" variant="outlined" sx={{ fontSize: "0.8rem" }}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
                <Box>
                    {showMockButton && (
                        <Button
                            onClick={handleMock}
                            disabled={loading}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: "0.72rem" }}
                        >
                            Тест (mock)
                        </Button>
                    )}
                </Box>
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
