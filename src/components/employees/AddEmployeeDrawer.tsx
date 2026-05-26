import React from "react";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import dayjs from "dayjs";
import { CustomDatePicker } from "../ui";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  InputAdornment
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { apiFetch } from "../../utility/apiClient";
import { fetchSpecializations, type SpecializationRow } from "../../services/specializations";
import { PhoneCountryCodeSelect } from "../ui";
import {
  composePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  type PhoneCountryCode
} from "../../utility/phone";

export type CreatedEmployee = {
  id: string;
  full_name: string;
  phone?: string | null;
  employee_type?: string | null;
  specialization?: string | null;
  specialization_id?: string | null;
  birth_date?: string | null; // yyyy-MM-dd
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (e: CreatedEmployee) => void;
};


const AddEmployeeDrawer: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState(""); // локальная часть без кода страны
  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [employeeType, setEmployeeType] = React.useState("");
  // const [specialization, setSpecialization] = React.useState(""); // Legacy text state
  const [selectedSpec, setSelectedSpec] = React.useState<SpecializationRow | null>(null);
  const [specs, setSpecs] = React.useState<SpecializationRow[]>([]);
  const [loadingSpecs, setLoadingSpecs] = React.useState(false);

  const [birthDate, setBirthDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setLoadingSpecs(true);
      fetchSpecializations()
        .then(setSpecs)
        .catch((e) => console.error(e))
        .finally(() => setLoadingSpecs(false));
    } else {
      setFullName("");
      setPhone("");
      setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setEmployeeType("");
      setSelectedSpec(null);
      setBirthDate("");
      setBusy(false);
      setTouched(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setTouched(true);
    const fio = fullName.trim();
    if (!fio) {
      return;
    }
    try {
      setBusy(true);

      const fullPhone = composePhone(phoneCountryCode, phone);

      const payload: Record<string, unknown> = {
        full_name: fio,
        phone: fullPhone,
        employee_type: employeeType.trim() || null,
        specialization: selectedSpec ? selectedSpec.name : null,
        specialization_id: selectedSpec ? selectedSpec.id : null,
        birth_date: birthDate || null
};

      const res: any = await apiFetch("/api/v1/employees/", {
        method: "POST",
        body: JSON.stringify(payload)
});

      const data = res?.data ?? res;

      handleSuccess(data, fio, fullPhone);

    } catch (e: unknown) {
       
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      alert(
        "Не удалось добавить сотрудника: " + message
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSuccess = (data: Record<string, unknown>, fio: string, fullPhone: string | null) => {
    const rawId = data["ID"] ?? data["id"] ?? "";
    const insertedId = String(rawId);
    if (!insertedId) {
      throw new Error("ID не был возвращен после вставки.");
    }

    const created: CreatedEmployee = {
      id: insertedId,
      full_name: fio,
      phone: fullPhone,
      employee_type: employeeType.trim() || null,
      specialization: selectedSpec?.name || null,
      specialization_id: selectedSpec?.id || null,
      birth_date: birthDate || null
};

    onCreated?.(created);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: 320, sm: 420 }, maxWidth: "100vw" } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1
}}
      >
        <Typography variant="h6">Добавить сотрудника</Typography>
        <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
          <CloseOutlined />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="ФИО сотрудника *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            autoFocus
            error={touched && !fullName.trim()}
            helperText={touched && !fullName.trim() ? "Обязательное поле" : ""}
          />
          <TextField
            label="Телефон"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 9))
            }
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ mr: 1, ml: '-14px' }}>
                  <PhoneCountryCodeSelect
                    value={phoneCountryCode}
                    onChange={(code) => {
                      setPhoneCountryCode(code);
                    }}
                  />
                </InputAdornment>
              )
}}
            inputProps={{ inputMode: "tel", pattern: "[0-9]*", maxLength: 9 }}
          />

          <TextField
            label="Тип сотрудника"
            value={employeeType}
            onChange={(e) => setEmployeeType(e.target.value)}
            fullWidth
          />

          <AppAutocomplete
            options={specs}
            loading={loadingSpecs}
            value={selectedSpec}
            onChange={(_, v) => setSelectedSpec(v)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Специализация"
                placeholder="Выберите специализацию"
                fullWidth
              />
            )}
            noOptionsText="Нет специализаций"
          />

          <CustomDatePicker
            label="Дата рождения"
            value={birthDate ? dayjs(birthDate) : null}
            onChange={(val) => setBirthDate(val ? val.format("YYYY-MM-DD") : "")}
            slotProps={{ textField: { fullWidth: true } }}
          />
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy || !fullName.trim()}
            >
              {busy ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <span>Сохранение…</span>
                </Stack>
              ) : (
                "Сохранить"
              )}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
};

export default AddEmployeeDrawer;
