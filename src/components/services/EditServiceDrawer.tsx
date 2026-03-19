import React from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  CircularProgress
} from "@mui/material";
import ServiceDetailsForm from "./ServiceDetailsForm";
import { useNotification } from "@refinedev/core";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { fetchEmployees } from "../../services/employees";
import type { EmployeesRow } from "../../pages/expenses/types";
import type { CreatedService } from "./useAddServiceForm";
import ServicePhotoUploader from "./ServicePhotoUploader";
import { updateService } from "../../services/services";

type Props = {
  open: boolean;
  onClose: () => void;
  record: {
    id: string | number;
    name: string;
    price: number;
    employee_id: string | null;
    employee_name?: string | null;
    photo_url?: string | null;
    description?: string | null;
    is_active?: boolean;
    isGroup?: boolean;
    maxParticipants?: number | null;
    durationMinutes?: number | null;
  };
  onUpdated?: (rec: CreatedService) => void;
};

const DrawerBase: React.FC<{
  open: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  children?: React.ReactNode;
}> = ({ open, title, busy, onClose, onSubmit, submitDisabled, children }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw", display: "flex", flexDirection: "column" },
      }}
    >
      <Box sx={{ width: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Stack>
        <Divider />
        <Box
          px={2}
          py={2}
          sx={{
            flex: 1,
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          {children}
        </Box>
        <Divider />
        <Box px={2} py={1.5} display="flex" justifyContent="flex-end" gap={1.5}>
          <Button onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={busy || !!submitDisabled}
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
        </Box>
      </Box>
    </Drawer>
  );
};

const EditServiceDrawer: React.FC<Props> = ({ open, onClose, record, onUpdated }) => {
  const { open: notify } = useNotification();
  const [name, setName] = React.useState(record.name);
  const [price, setPrice] = React.useState<string>(String(record.price ?? ""));
  const [description, setDescription] = React.useState(record.description || "");
  const [isActive, setIsActive] = React.useState(record.is_active ?? true);
  const [isGroup, setIsGroup] = React.useState(record.isGroup ?? false);
  const [maxParticipants, setMaxParticipants] = React.useState(
    record.maxParticipants != null ? String(record.maxParticipants) : ""
  );
  const [durationMinutes, setDurationMinutes] = React.useState(
    record.durationMinutes != null ? String(record.durationMinutes) : ""
  );

  const [selectedEmps, setSelectedEmps] = React.useState<EmployeesRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [loadingEmps, setLoadingEmps] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(record.photo_url ?? null);

  const fileToDataUrl = React.useCallback(
    (f: File) =>
      new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(f);
      }),
    []
  );

  const onPickPhoto = React.useCallback(
    async (f: File | null) => {
      setPhotoFile(f);
      if (f) {
        try {
          const url = await fileToDataUrl(f);
          setPhotoPreview(url);
        } catch {
          setPhotoPreview(null);
        }
      } else {
        setPhotoPreview(record.photo_url ?? null);
      }
    },
    [fileToDataUrl, record.photo_url]
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const load = async () => {
      try {
        setLoadingEmps(true);
        const emps = await fetchEmployees();
        if (!cancelled) {
          setEmployees(emps);
          if (record.employee_id) {
            const found = emps.filter(e => String(e.id) === String(record.employee_id));
            setSelectedEmps(found);
          }
        }
      } finally {
        if (!cancelled) setLoadingEmps(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [open, record.id, record.employee_id]);

  React.useEffect(() => {
    if (!open) {
      setName(record.name);
      setPrice(String(record.price ?? ""));
      setDescription(record.description || "");
      setIsActive(record.is_active ?? true);
      setIsGroup(record.isGroup ?? false);
      setMaxParticipants(record.maxParticipants != null ? String(record.maxParticipants) : "");
      setDurationMinutes(record.durationMinutes != null ? String(record.durationMinutes) : "");
      setSelectedEmps([]);
      setPhotoFile(null);
      setPhotoPreview(record.photo_url ?? null);
      setBusy(false);
      setTouched(false);
    }
  }, [open, record]);

  const handleSubmit = async () => {
    setTouched(true);
    const priceNum = Number(price);
    if (!name.trim() || !price || !Number.isFinite(priceNum) || priceNum <= 0) {
      notify?.({ type: "error", message: "Заполните название и положительную стоимость услуги" });
      return;
    }
    if (isGroup && (!maxParticipants || Number(maxParticipants) <= 0)) {
      notify?.({ type: "error", message: "Укажите максимальное количество участников" });
      return;
    }

    try {
      setBusy(true);

      const updated = await updateService(record.id, {
        name: name.trim(),
        priceSom: priceNum,
        description: description.trim(),
        isActive,
        isGroup,
        maxParticipants: isGroup && maxParticipants ? Number(maxParticipants) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        imageUrl: photoFile || undefined,
      });

      const out: CreatedService = {
        id: updated.id,
        name: updated.name,
        price: updated.price || 0,
        service_name: updated.name,
        price_som: updated.price || 0,
        employee_id: null,
        employee_name: record.employee_name ?? null,
        photo_url: updated.photoUrl || null,
      };

      onUpdated?.(out);
      onClose();
    } catch (e) {
      console.error("Update service failed:", e);
      notify?.({ type: "error", message: "Не удалось обновить услугу." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase
      open={open}
      title="Редактирование услуги"
      busy={busy}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim() || !price || Number(price) <= 0 || (isGroup && (!maxParticipants || Number(maxParticipants) <= 0))}
    >
      <Stack spacing={3}>
        <ServicePhotoUploader
          photoFile={photoFile}
          photoPreview={photoPreview}
          onPickPhoto={onPickPhoto}
        />

        <ServiceDetailsForm
          name={name}
          setName={setName}
          price={price}
          setPrice={setPrice}
          description={description}
          setDescription={setDescription}
          isActive={isActive}
          setIsActive={setIsActive}
          isGroup={isGroup}
          setIsGroup={setIsGroup}
          maxParticipants={maxParticipants}
          setMaxParticipants={setMaxParticipants}
          durationMinutes={durationMinutes}
          setDurationMinutes={setDurationMinutes}
          touched={touched}
        />
      </Stack>
    </DrawerBase>
  );
};

export default EditServiceDrawer;
