import React, { useEffect, useState } from "react";
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
    CircularProgress,
    Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import dayjs from "dayjs";

import { assembleDailyLessons } from "../../../services/dailyLessons";
import { generateDailyLessonsPDF } from "../../../utility/dailyLessonsPdf";
import { useReportBranchScope } from "../../../hooks/useReportBranchScope";

interface DailyLessonsDialogProps {
    open: boolean;
    onClose: () => void;
    /** Стартовая дата (YYYY-MM-DD); по умолчанию — выбранная на странице/сегодня. */
    initialDate?: string;
}

const DailyLessonsDialog: React.FC<DailyLessonsDialogProps> = ({ open, onClose, initialDate }) => {
    const { branch } = useReportBranchScope();
    const brandName = branch?.brandName || branch?.name || "Academy KG";

    const [date, setDate] = useState<string>(initialDate ?? dayjs().format("YYYY-MM-DD"));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDate(initialDate ?? dayjs().format("YYYY-MM-DD"));
            setError(null);
        }
    }, [open, initialDate]);

    const handleGenerate = async () => {
        if (!branch?.id) {
            setError("Выберите конкретный филиал (не «Все филиалы») — отчёт строится по филиалу.");
            return;
        }
        if (!date || !dayjs(date).isValid()) {
            setError("Укажите дату отчёта.");
            return;
        }
        if (dayjs(date).isAfter(dayjs(), "day")) {
            setError("Дата в будущем — отчёт доступен по сегодняшний день включительно.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await assembleDailyLessons({
                date,
                branchId: branch.id,
                brandName,
            });

            const blob = await generateDailyLessonsPDF(data);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `zanyatiya_${date}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            onClose();
        } catch (e: any) {
            console.error(e);
            // Ендпоинт может быть ещё не реализован бэком (404).
            const status = e?.status ?? e?.response?.status;
            if (status === 404) {
                setError("Ендпоинт отчёта ещё не реализован на бэкенде (см. docs/backend-requests-2026-06-15.md).");
            } else {
                setError(e?.message || "Не удалось сформировать отчёт «Занятия за день».");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={800}>Занятия за день</Typography>
                    <Typography variant="caption" color="text.secondary">{brandName}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" disabled={loading} aria-label="Закрыть">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Детализация занятий за выбранный день по услугам + блок АФК. В отчёт входят только оплаченные занятия.
                    </Typography>

                    <TextField
                        label="Дата"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={loading}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: dayjs().format("YYYY-MM-DD") }}
                    />

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

export default DailyLessonsDialog;
