import React, { useEffect, useState } from "react";
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
    CircularProgress,
    Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import dayjs from "dayjs";

import { assembleDailyDetails } from "../../../services/dailyDetails";
import { generateDailyDetailsPDF } from "../../../utility/dailyDetailsPdf";
import { useReportBranchScope, useReportCurrency } from "../../../hooks/useReportBranchScope";

interface DailyAdvancesDebtsDialogProps {
    open: boolean;
    onClose: () => void;
    /** Стартовая дата (YYYY-MM-DD); по умолчанию — выбранная на странице/сегодня. */
    initialDate?: string;
}

const DailyAdvancesDebtsDialog: React.FC<DailyAdvancesDebtsDialogProps> = ({ open, onClose, initialDate }) => {
    const { t } = useTranslation();
    const { branch } = useReportBranchScope();
    const { suffix: currencySuffix } = useReportCurrency();
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
            setError(t("salaryReports.selectSpecificBranchReport"));
            return;
        }
        if (!date || !dayjs(date).isValid()) {
            setError(t("salaryReports.specifyReportDate"));
            return;
        }
        if (dayjs(date).isAfter(dayjs(), "day")) {
            setError(t("salaryReports.futureDateReportError"));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await assembleDailyDetails({
                date,
                branchId: branch.id,
                brandName,
            });

            const blob = await generateDailyDetailsPDF(data, currencySuffix);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `avansy_dolgi_${date}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError(e?.message || t("salaryReports.advancesDebtsGenerationError"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={800}>{t("salaryReports.advancesAndDebts")}</Typography>
                    <Typography variant="caption" color="text.secondary">{brandName}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small" disabled={loading} aria-label={t("common.close")}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        {t("salaryReports.advancesDebtsHint")}
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
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                    >
                        {t("salaryReports.generatePdf")}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default DailyAdvancesDebtsDialog;
