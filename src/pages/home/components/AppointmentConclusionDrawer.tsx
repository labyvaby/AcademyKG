import React, { useEffect, useState } from "react";
import AppAutocomplete from "../../../components/ui/AppAutocomplete";
import { useUpdate } from "@refinedev/core";
import { apiFetch } from "../../../utility/apiClient";
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Stack,
    Button,
    TextField,
    CircularProgress
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";

import { useTheme } from "@mui/material/styles";

// Интерфейсы (можно вынести в types.ts)
interface ClinicDiagnosis {
    id: string;
    title: string | null;
    diagnosis_code: string | null;
    sort_order: number;
}

interface AppointmentConclusionDrawerProps {
    open: boolean;
    onClose: () => void;
    appointmentId: string | null;
    initialDiagnosisCode?: string | null;
    initialConclusion?: string | null;
    initialDoctorComplaints?: string | null;
    onSuccess?: () => void;
}

export const AppointmentConclusionDrawer: React.FC<AppointmentConclusionDrawerProps> = ({
    open,
    onClose,
    appointmentId,
    initialDiagnosisCode,
    initialConclusion,
    initialDoctorComplaints,
    onSuccess
}) => {
    const theme = useTheme();

    // Состояние формы (локальное для простоты, или react-hook-form)
    // Используем локальный стейт для полей, так как это не создание, а апдейт конкретных полей
    const [conclusion, setConclusion] = useState("");
    const [doctorComplaints, setDoctorComplaints] = useState("");
    const [selectedDiagnosis, setSelectedDiagnosis] = useState<ClinicDiagnosis | null>(null);
    const initializedForAppointment = React.useRef<string | null>(null);

    // Обновление данных через Refine
    const { mutateAsync: updateAppointment } = useUpdate();
    const [isUpdating, setIsUpdating] = useState(false);

    // Загрузка справочника ClinicDiagnoses через REST API
    const [diagnosesList, setDiagnosesList] = useState<ClinicDiagnosis[]>([]);
    const [isLoadingDiagnoses, setIsLoadingDiagnoses] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingDiagnoses(true);
        apiFetch("/api/v1/clinic-diagnoses/?pageSize=200&ordering=name")
            .then((res: any) => {
                if (!cancelled) {
                    const items: ClinicDiagnosis[] = res?.data?.results ?? res?.results ?? [];
                    setDiagnosesList(items);
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setIsLoadingDiagnoses(false); });
        return () => { cancelled = true; };
    }, []);

    // Инициализация данных при открытии
    useEffect(() => {
        if (open && appointmentId) {
            if (initializedForAppointment.current !== appointmentId) {
                setConclusion(initialConclusion || "");
                setDoctorComplaints(initialDoctorComplaints || "");
                initializedForAppointment.current = appointmentId;
            }

            // Попытка найти диагноз в списке
            if (!selectedDiagnosis && initialDiagnosisCode && diagnosesList.length > 0) {
                const found = diagnosesList.find((d: ClinicDiagnosis) => d.diagnosis_code === initialDiagnosisCode);
                if (found) {
                    setSelectedDiagnosis(found);
                }
            }
        } else {
            if (!open) {
                initializedForAppointment.current = null;
                setSelectedDiagnosis(null);
                setConclusion("");
                setDoctorComplaints("");
            }
        }
    }, [open, appointmentId, initialConclusion, initialDoctorComplaints, initialDiagnosisCode, diagnosesList, selectedDiagnosis]);

    const handleSave = async () => {
        if (!appointmentId) return;

        try {
            setIsUpdating(true);
            await updateAppointment({
                resource: "Appointments",
                id: appointmentId,
                values: {
                    conclusion: conclusion,
                    doctor_complaints: doctorComplaints,
                    diagnosis_code: selectedDiagnosis?.diagnosis_code || null
}
});
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: "100%", md: 500 },
                    p: 0
}
}}
        >
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 3,
                    py: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`
}}
            >
                <Typography variant="h6">Заключение специалиста</Typography>
                <IconButton onClick={onClose}>
                    <CloseOutlined />
                </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3, flex: 1, overflowY: "auto" }}>
                <Stack spacing={3}>
                    {/* Выбор диагноза */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Диагноз (Избранное клиники)
                        </Typography>
                        {isLoadingDiagnoses ? (
                            <CircularProgress size={20} />
                        ) : (
                            <AppAutocomplete
                                options={diagnosesList}
                                getOptionLabel={(option) => option.title || option.diagnosis_code || ""}
                                value={selectedDiagnosis}
                                onChange={(_, newValue) => {
                                    setSelectedDiagnosis(newValue);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Выберите диагноз (например, ОРВИ)"
                                        variant="outlined"
                                        helperText={
                                            selectedDiagnosis?.diagnosis_code
                                                ? `Код МКБ-10: ${selectedDiagnosis.diagnosis_code}`
                                                : "Выберите диагноз из списка"
                                        }
                                    />
                                )}
                                renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    return (
                                        <li key={key} {...optionProps}>
                                            <Stack>
                                                <Typography variant="body1">{option.title}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Код: {option.diagnosis_code}
                                                </Typography>
                                            </Stack>
                                        </li>
                                    )
                                }}
                            />
                        )}
                    </Box>

                    {/* Жалобы (специалист) */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Жалобы (специалист)
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            placeholder="Запишите жалобы клиента..."
                            value={doctorComplaints}
                            onChange={(e) => setDoctorComplaints(e.target.value)}
                        />
                    </Box>

                    {/* Поле заключения */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Медицинское заключение
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            minRows={6}
                            placeholder="Опишите жалобы, анамнез, объективные данные и рекомендации..."
                            value={conclusion}
                            onChange={(e) => setConclusion(e.target.value)}
                        />
                    </Box>
                </Stack>
            </Box>

            {/* Footer */}
            <Box
                sx={{
                    p: 2,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 2
}}
            >
                <Button variant="outlined" onClick={onClose} color="inherit">
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    startIcon={<SaveOutlined />}
                    disabled={isUpdating}
                >
                    {isUpdating ? "Сохранение..." : "Завершить прием"}
                </Button>
            </Box>
        </Drawer>
    );
};
