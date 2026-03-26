import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Button,
    Stack,
    TextField,
    Typography,
    Drawer,
    IconButton,
    Divider,
    Autocomplete,
    Paper,
    CircularProgress,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import StarBorderOutlined from "@mui/icons-material/StarBorderOutlined";
import { useNotification } from "@refinedev/core";
import { apiFetch } from "../../utility/apiClient";
import { getClinicDiagnoses, type ClinicDiagnosis } from "../../services/diagnoses";
import type { Appointment } from "../../pages/home/types";
import { usePermissions } from "../../hooks/usePermissions";
import { ConclusionTemplatesDrawer } from "../../pages/doctor/components/ConclusionTemplatesDrawer";
import { ProfigramInviteDialog } from "../profigram/ProfigramInviteDialog";

interface DoctorWorkDrawerProps {
    open: boolean;
    onClose: () => void;
    appointment: Appointment | null;
    onSuccess?: () => void;
}

// Элемент диагноза, сохраняемый в MedicalConclusions.diagnosis_data
interface ConclusionDiagnosisItem {
    id: string;
    diagnosis_code: string;
    title: string;
}

// В памяти кэш для заключений в Drawer, чтобы не дергать базу при каждом открытии
// Ключ теперь: appointmentId-doctorId
const DRAWER_CONCLUSION_CACHE = new Map<string, {
    data: {
        conclusion: string;
        anamnesis: string;
        objective: string;
        internalComment: string;
        photoUrls: string[];
    };
    timestamp: number;
}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

const DoctorWorkDrawer: React.FC<DoctorWorkDrawerProps> = ({
    open,
    onClose,
    appointment,
    onSuccess,
}) => {
    const { open: notify } = useNotification();
    const { hasRole, employeeId, employee } = usePermissions();
    const isDoctor = hasRole('specialist');

    // State
    const [conclusion, setConclusion] = useState("");
    const [doctorComplaints, setDoctorComplaints] = useState("");
    const [anamnesis, setAnamnesis] = useState("");
    const [objective, setObjective] = useState("");

    // Vitals
    const [weight, setWeight] = useState<string>("");
    const [height, setHeight] = useState<string>("");
    const [temperature, setTemperature] = useState<string>("");

    // Diagnosis
    const [selectedDiagnoses, setSelectedDiagnoses] = useState<ClinicDiagnosis[]>([]);
    const [diagnoses, setDiagnoses] = useState<ClinicDiagnosis[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);

    // New Fields
    const [photoUrls, setPhotoUrls] = useState<string[]>([]);
    const [internalComment, setInternalComment] = useState("");
    const [uploading, setUploading] = useState(false);
    const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());

    // Templates / Revisions
    const [templatesOpen, setTemplatesOpen] = useState(false);

    // Profigram Integration State
    const [profigramOpen, setProfigramOpen] = useState(false);
    const [patientPhoneStr, setPatientPhoneStr] = useState("");
    const [saveSuccessCallback, setSaveSuccessCallback] = useState<(() => void) | null>(null);

    // CSS for standardized quantity inputs
    const noSpinnersSx = {
        '& input[type=number]': {
            MozAppearance: 'textfield'
        },
        '& input[type=number]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0
        },
        '& input[type=number]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0
        }
    };

    const lastAppointmentId = useRef<string | null>(null);

    const resetForm = () => {
        setConclusion("");
        setAnamnesis("");
        setObjective("");
        setWeight("");
        setHeight("");
        setTemperature("");
        setSelectedDiagnoses([]);
        setPhotoUrls([]);
        setInternalComment("");
        setLoadingImages(new Set());
        setProfigramOpen(false);
        setSaveSuccessCallback(null);
    };

    const loadMedicalConclusion = async (force = false) => {
        if (!appointment) return;

        const targetDoctorId = employeeId;
        if (!targetDoctorId) return;

        const cacheKey = `${appointment.id}-${targetDoctorId}`;

        // Check cache
        if (!force && DRAWER_CONCLUSION_CACHE.has(cacheKey)) {
            const entry = DRAWER_CONCLUSION_CACHE.get(cacheKey)!;
            if (Date.now() - entry.timestamp < CACHE_TTL) {
                const d = entry.data;
                setConclusion(d.conclusion);
                setAnamnesis(d.anamnesis);
                setObjective(d.objective);
                setInternalComment(d.internalComment);
                setPhotoUrls(d.photoUrls);
                setLoadingImages(new Set());
                return;
            }
        }

        try {
            const res: any = await apiFetch(`/api/v1/conclusions/?appointment=${appointment.id}&doctor=${targetDoctorId}`);
            const data = (res?.results || [])[0];

            setDoctorComplaints(appointment.doctor_complaints || "");

            let vConc = "";
            let vAnam = "";
            let vObj = "";
            let vIntComm = "";
            let vPhotos: string[] = [];

            if (data) {
                vConc = data.conclusion || "";
                vAnam = data.anamnesis || "";
                vObj = data.objective || "";
                vIntComm = data.internalComment || "";
                vPhotos = data.photoUrls || [];
            } else {
                // Fallback (Migration/Legacy support)
                vConc = (appointment as any).conclusion || "";
                vAnam = (appointment as any).anamnesis || "";
                vObj = (appointment as any).objective || "";
            }

            setConclusion(vConc);
            setAnamnesis(vAnam);
            setObjective(vObj);
            setInternalComment(vIntComm);
            setPhotoUrls(vPhotos);
            setLoadingImages(new Set());

            // Save to cache
            DRAWER_CONCLUSION_CACHE.set(cacheKey, {
                data: {
                    conclusion: vConc,
                    anamnesis: vAnam,
                    objective: vObj,
                    internalComment: vIntComm,
                    photoUrls: vPhotos
                },
                timestamp: Date.now()
            });

        } catch (e) {
            console.error("Error loading conclusion:", e);
        }
    };

    const loadDiagnoses = async () => {
        if (!appointment) return;
        try {
            setLoadingDiagnoses(true);
            const data = await getClinicDiagnoses();
            setDiagnoses(data);

            const targetDoctorId = employeeId;
            if (!targetDoctorId) return;

            // Fetch fresh conclusion data for diagnosis sync
            const res: any = await apiFetch(`/api/v1/conclusions/?appointment=${appointment.id}&doctor=${targetDoctorId}`);
            const conclusionData = (res?.results || [])[0];

            let sourceData: ConclusionDiagnosisItem[] | null | undefined = conclusionData?.diagnosisData as
                | ConclusionDiagnosisItem[]
                | null
                | undefined;

            if (!sourceData && Array.isArray((appointment as any).diagnosis_data)) {
                sourceData = (appointment as any).diagnosis_data as ConclusionDiagnosisItem[]; // fallback
            }

            const preselected: ClinicDiagnosis[] = [];

            if (Array.isArray(sourceData)) {
                sourceData.forEach((d: any) => {
                    // Try match by ID first
                    let found = data.find((c) => c.id === d.id);
                    if (!found && d.diagnosis_code) {
                        found = data.find((c) => c.diagnosis_code === d.diagnosis_code);
                    }
                    if (found) preselected.push(found);
                });
            }
            else if ((appointment as any).diagnosis_code) { // Legacy fallback
                const found = data.find(d => d.diagnosis_code === (appointment as any).diagnosis_code);
                if (found) preselected.push(found);
            }

            // Ensure unique items in the selection array
            const unique = Array.from(new Set(preselected.map(d => d.id)))
                .map(id => preselected.find(d => d.id === id)!);

            setSelectedDiagnoses(unique);
        } catch (error) {
            console.error("Error loading diagnoses:", error);
            notify?.({ type: "error", message: "Ошибка загрузки диагнозов" });
        } finally {
            setLoadingDiagnoses(false);
        }
    };

    useEffect(() => {
        if (open) {
            // Check if we actually switched the appointment or just re-opened same one
            if (appointment?.id !== lastAppointmentId.current) {
                // Initial clear ONLY when ID changes
                setConclusion("");
                setAnamnesis("");
                setObjective("");
                setInternalComment("");
                setPhotoUrls([]);
                setSelectedDiagnoses([]);
                lastAppointmentId.current = appointment?.id || null;

                loadDiagnoses();
                if (appointment) {
                    setWeight(appointment.weight ? String(appointment.weight) : "");
                    setHeight(appointment.height ? String(appointment.height) : "");
                    setTemperature(appointment.temperature ? String(appointment.temperature) : "");
                    loadMedicalConclusion();
                }
            }
        } else {
            resetForm();
            lastAppointmentId.current = null;
        }
    }, [open, appointment?.id]);

    // REALTIME: Removed as per REST API migration
    useEffect(() => {
        if (!open || !appointment) return;
        // Subscriptions are no longer needed with standard REST workflows
    }, [open, appointment]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const filesCount = event.target.files.length;
        const startIndex = photoUrls.length;

        const placeholders = new Array(filesCount).fill('');
        setPhotoUrls(prev => [...prev, ...placeholders]);

        setLoadingImages(prev => {
            const updated = new Set(prev);
            for (let i = 0; i < filesCount; i++) {
                updated.add(startIndex + i);
            }
            return updated;
        });

        setUploading(true);

        try {
            const urls: string[] = [];
            // В REST API мы загружаем файлы вместе с заключением в POST/PATCH запросе 
            // Однако текущая логика UI ожидает общедоступные ссылки сразу после выбора.
            // Нам нужно либо:
            // 1. Создать отдельный эндпоинт для загрузки файлов в REST (если есть)
            // 2. Либо хранить File объекты и отправлять их в handleSave.
            
            // В данном случае, судя по Swagger, файл передается как часть MedicalConclusionWriteRequest.
            // Поэтому мы просто сохраняем объекты File локально и отображаем превью.
            
            for (let i = 0; i < event.target.files.length; i++) {
                const file = event.target.files[i];
                const previewUrl = URL.createObjectURL(file);
                urls.push(previewUrl);
                // ВАЖНО: Мы сохраним сами файлы для handleSave
                (window as any)._pendingFiles = (window as any)._pendingFiles || [];
                (window as any)._pendingFiles.push(file);
            }

            setPhotoUrls(prev => {
                const updated = [...prev];
                urls.forEach((url, i) => {
                    updated[startIndex + i] = url;
                });
                return updated;
            });
        } catch (error) {
            console.error('Error handling files:', error);
            notify?.({ type: "error", message: "Ошибка обработки фото" });
            setPhotoUrls(prev => prev.slice(0, startIndex));
        } finally {
            setLoadingImages(prev => {
                const updated = new Set(prev);
                for (let i = 0; i < filesCount; i++) {
                    updated.delete(startIndex + i);
                }
                return updated;
            });
            setUploading(false);
        }
    };

    const handleApplyTemplate = (rev: { conclusion: string | null; anamnesis: string | null; objective: string | null }) => {
        if (rev.conclusion) setConclusion(rev.conclusion);
        if (rev.anamnesis) setAnamnesis(rev.anamnesis);
        if (rev.objective) setObjective(rev.objective);
        setTemplatesOpen(false);
        notify?.({ type: "success", message: "Шаблон применен" });
    };

    const handleSaveTemplate = async () => {
        if (!appointment) return;

        if (!conclusion.trim()) {
            notify?.({ type: "error", message: "Заполните заключение для шаблона" });
            return;
        }

        try {
            setLoading(true);
            if (!employeeId) {
                notify?.({ type: "error", message: "Сотрудник не найден" });
                return;
            }

            const templateData = {
                name: `Шаблон ${new Date().toLocaleDateString()}`,
                structure: {
                    conclusion: conclusion.trim(),
                    anamnesis: anamnesis.trim(),
                    objective: objective.trim(),
                },
                isActive: true,
                createdBy: employeeId
            };

            await apiFetch("/api/v1/conclusion-templates/", {
                method: "POST",
                body: JSON.stringify(templateData)
            });

            notify?.({ type: "success", message: "Шаблон успешно сохранен" });
        } catch (error: any) {
            console.error("Error saving template:", error);
            notify?.({ type: "error", message: `Ошибка сохранения шаблона: ${error?.message || 'Неизвестная ошибка'}` });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!appointment) return;

        if (!conclusion.trim()) {
            notify?.({ type: "error", message: "Заполните заключение" });
            return;
        }
        if (temperature) {
            const t = parseFloat(temperature);
            if (t < 34 || t > 42) {
                notify?.({ type: "error", message: "Температура должна быть в диапазоне 34 - 42" });
                return;
            }
        }

        try {
            setLoading(true);

            if (!employeeId) {
                notify?.({ type: "error", message: "Сотрудник не найден" });
                return;
            }

            // Формируем FormData для поддержки загрузки файлов и полей заключения
            const formData = new FormData();
            formData.append("appointment", appointment.id);
            formData.append("doctor", employeeId);
            formData.append("conclusion", conclusion.trim());
            formData.append("anamnesis", anamnesis.trim());
            formData.append("objective", objective.trim());
            formData.append("internalComment", internalComment.trim());
            formData.append("temperature", temperature ? String(parseFloat(temperature)) : "");
            formData.append("weightKg", weight ? String(parseFloat(weight)) : "");
            formData.append("heightCm", height ? String(parseFloat(height)) : "");
            formData.append("doctorComment", doctorComplaints.trim());
            
            // Диагнозы
            formData.append("diagnosisData", JSON.stringify(selectedDiagnoses.map(d => ({
                id: d.id,
                diagnosisCode: d.diagnosis_code,
                title: d.title
            }))));

            // Добавляем новые файлы, если они есть
            const pendingFiles = (window as any)._pendingFiles || [];
            pendingFiles.forEach((file: File) => {
                formData.append("photoUrls", file); // В Swagger поле называется photoUrls (массив)
            });

            // Отправляем запрос на создание/обновление заключения
            const res: any = await apiFetch("/api/v1/conclusions/", {
                method: "POST",
                body: formData,
                headers: {} // Даем браузеру самому установить Content-Type: multipart/form-data
            });

            // Обновляем статусы услуг
            const servicesRes: any = await apiFetch(`/api/v1/appointment-services/?appointment=${appointment.id}&performer=${employeeId}`);
            const services = servicesRes?.results || [];
            
            for (const s of services) {
                await apiFetch(`/api/v1/appointment-services/${s.id}/`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "performed" })
                });
            }

            notify?.({ type: "success", message: "Данные сохранены" });

            DRAWER_CONCLUSION_CACHE.delete(`${appointment.id}-${employeeId}`);
            (window as any)._pendingFiles = [];

            // Open Profigram invite after successful save, only if it's a doctor
            if (isDoctor && employee?.phone) {
                try {
                    const pRes: any = await apiFetch(`/api/v1/patients/${appointment.patient_id}/`);
                    setPatientPhoneStr(pRes?.contactPhone || "");
                } catch (e) {
                    console.error("Error fetching patient phone:", e);
                    setPatientPhoneStr("");
                }
                setProfigramOpen(true);
            } else {
                onSuccess?.();
                onClose();
            }
        } catch (error: any) {
            console.error("Error saving:", error);
            notify?.({ type: "error", message: `Ошибка сохранения: ${error?.message || 'Неизвестная ошибка'}` });
        } finally {
            setLoading(false);
        }
    };

    const handleProfigramClose = () => {
        setProfigramOpen(false);
        onSuccess?.();
        onClose();
    };

    const renderQuantityInput = (
        label: string,
        value: string,
        setValue: (v: string) => void,
        suffix: string,
        step: number = 1,
        min: number = 0,
        max?: number
    ) => (
        <Stack spacing={0.5} sx={{ minWidth: 100, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
                {label}, {suffix}
            </Typography>
            <Box
                sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 40,
                }}
            >
                <Button
                    size="small"
                    onClick={() => {
                        const cur = value === "" ? (min !== undefined ? min : 0) : (parseFloat(value) || 0);
                        const next = Math.max(min, cur - step);
                        setValue(step < 1 ? next.toFixed(1) : String(next));
                    }}
                    sx={{ minWidth: 32, px: 0.5, minHeight: 34 }}
                >
                    −
                </Button>
                <TextField
                    size="small"
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => {
                        const val = parseFloat(value);
                        if (!isNaN(val)) {
                            if (min !== undefined && val < min) setValue(String(min));
                            else if (max !== undefined && val > max) setValue(String(max));
                        }
                    }}
                    placeholder="0"
                    inputProps={{
                        style: { textAlign: 'center', padding: '8px 4px' },
                        min: min,
                        step: step,
                        max: max
                    }}
                    sx={{
                        flex: 1,
                        ...noSpinnersSx,
                        '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } }
                    }}
                />
                <Button
                    size="small"
                    onClick={() => {
                        const cur = value === "" ? (min !== undefined ? min : 0) : (parseFloat(value) || 0);
                        const next = cur + step;
                        if (max !== undefined && next > max) return;
                        setValue(step < 1 ? next.toFixed(1) : String(next));
                    }}
                    sx={{ minWidth: 32, px: 0.5, minHeight: 34 }}
                >
                    +
                </Button>
            </Box>
        </Stack>
    );

    if (!appointment) return null;

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={loading ? undefined : onClose}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 600, md: 700 },
                        maxWidth: "100vw",
                        overscrollBehavior: "contain",
                    },
                }}
            >

                <ConclusionTemplatesDrawer
                    open={templatesOpen}
                    onClose={() => setTemplatesOpen(false)}
                    onApplyTemplate={handleApplyTemplate}
                />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5 }}>
                    <Typography variant="h6">
                        {appointment.formatted_date} - {appointment.patient_name}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Сохранить как шаблон">
                            <IconButton
                                onClick={handleSaveTemplate}
                                disabled={loading}
                                color="primary"
                            >
                                <StarBorderOutlined />
                            </IconButton>
                        </Tooltip>
                        <Button
                            size="small"
                            startIcon={<ContentCopyOutlined />}
                            onClick={() => setTemplatesOpen(true)}
                            variant="outlined"
                        >
                            Шаблоны
                        </Button>
                        <IconButton onClick={loading ? undefined : onClose} disabled={loading}>
                            <CloseOutlined />
                        </IconButton>
                    </Stack>
                </Box>
                <Divider />

                <Stack
                    spacing={3}
                    sx={{
                        p: 3,
                        flex: 1,
                        overflowY: "auto",
                    }}
                >
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" spacing={2}>
                            {renderQuantityInput("Рост", height, setHeight, "см")}
                            {renderQuantityInput("Вес", weight, setWeight, "кг")}
                            {renderQuantityInput("Температура", temperature, setTemperature, "°C", 0.1, 34, 42)}
                        </Stack>
                    </Paper>
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Жалобы клиента
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="body1">
                                {appointment.complaints || "Нет жалоб"}
                            </Typography>
                        </Paper>
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Жалобы (врач)
                        </Typography>
                        <TextField
                            value={doctorComplaints}
                            onChange={(e) => setDoctorComplaints(e.target.value)}
                            multiline
                            minRows={2}
                            placeholder="Запишите жалобы с точки зрения сотрудника..."
                            fullWidth
                        />
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Каталог диагнозов
                        </Typography>
                        <Autocomplete
                            multiple
                            value={selectedDiagnoses}
                            onChange={(_, newValue) => setSelectedDiagnoses(newValue)}
                            options={diagnoses}
                            getOptionLabel={(option) => `${option.diagnosis_code} - ${option.title}`}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            loading={loadingDiagnoses}
                            filterSelectedOptions
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <li key={key} {...otherProps}>
                                        {option.diagnosis_code} - {option.title}
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Выберите диагнозы..."
                                    error={false}
                                    helperText=""
                                />
                            )}
                        />
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Диагноз
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.5, minHeight: 56, display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body1">
                                {selectedDiagnoses.length > 0
                                    ? selectedDiagnoses.map(d => `${d.title}`).join('. ')
                                    : "Выберите 1 или несколько из каталога диагнозов"}
                            </Typography>
                        </Paper>
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Анамнез
                        </Typography>
                        <TextField
                            value={anamnesis}
                            onChange={(e) => setAnamnesis(e.target.value)}
                            multiline
                            minRows={3}
                            placeholder="История заболевания..."
                            fullWidth
                        />
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Объективно
                        </Typography>
                        <TextField
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            multiline
                            minRows={4}
                            placeholder="Объективные данные..."
                            fullWidth
                        />
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Заключение <span style={{ color: "#d32f2f" }}>*</span>
                        </Typography>
                        <TextField
                            value={conclusion}
                            onChange={(e) => setConclusion(e.target.value)}
                            multiline
                            minRows={4}
                            fullWidth
                            required
                            placeholder="Рекомендации и назначения..."
                            error={!conclusion.trim()}
                            helperText={!conclusion.trim() ? "Обязательное поле" : ""}
                        />
                    </Stack>

                    {isDoctor && (
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                Комментарий (виден только сотруднику)
                            </Typography>
                            <TextField
                                value={internalComment}
                                onChange={(e) => setInternalComment(e.target.value)}
                                multiline
                                minRows={2}
                                fullWidth
                                placeholder="Личные заметки..."
                                sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? alpha(theme.palette.warning.main, 0.08) : '#fffbed' }}
                            />
                        </Stack>
                    )}

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Фотографии
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {photoUrls.map((url, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        position: 'relative',
                                        width: 60,
                                        height: 60,
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: loadingImages.has(idx) ? 'action.hover' : 'transparent'
                                    }}
                                >
                                    {loadingImages.has(idx) ? (
                                        <Box
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <CircularProgress size={24} />
                                        </Box>
                                    ) : (
                                        <img
                                            src={url}
                                            alt="Conclusion"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                </Box>
                            ))}
                            <Button
                                variant="outlined"
                                component="label"
                                disabled={uploading}
                                sx={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 1,
                                    minWidth: 0,
                                    p: 0,
                                    borderStyle: 'dashed'
                                }}
                            >
                                {uploading ? <CircularProgress size={20} /> : <AddPhotoAlternateOutlined fontSize="small" />}
                                <input
                                    type="file"
                                    hidden
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                />
                            </Button>
                        </Box>
                    </Stack>

                </Stack>

                <Box sx={{
                    pt: 2,
                    pb: 4,
                    px: 2,
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveOutlined />}
                        onClick={handleSave}
                        disabled={loading || !conclusion.trim()}
                        sx={{
                            minWidth: 240,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            py: 1.5,
                            boxShadow: 3,
                            '&:hover': {
                                boxShadow: 6
                            }
                        }}
                    >
                        {loading ? "Сохранение..." : "Сохранить заключение"}
                    </Button>
                </Box>
            </Drawer>

            <ProfigramInviteDialog
                open={profigramOpen}
                onClose={handleProfigramClose}
                patientName={appointment?.patient_name || ""}
                patientPhone={patientPhoneStr}
                doctorPhone={employee?.phone || ""}
                doctorId={employeeId || ""}
            />
        </>
    );
}
export { DoctorWorkDrawer };
export default DoctorWorkDrawer;
