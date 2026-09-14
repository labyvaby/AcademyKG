/**
 * VisitCreateDialog.tsx
 * Презентационный диалог создания приема (без API-логики).
 * Отвечает за: отображение формы, ввод полей и делегирование событий наверх.
 * Все данные и колбэки приходят через пропсы (SRP).
 */
import React from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { CustomDateTimePicker } from "../../../components/ui";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import { roundDateTimeLocalToStep } from "../../../utility/time";
import { useModalBackdropGuard } from "../../../hooks/useModalBackdropGuard";

type Props = {
  open: boolean;
  fullScreen?: boolean;

  // режим: создание (по умолчанию) или редактирование
  mode?: "create" | "edit";
  // переопределение заголовка и текста кнопки (необязательно)
  titleText?: string;
  submitLabel?: string;

  dateTime: string;
  doctor: string;
  service: string;
  price: number | "";

  onChangeDateTime: (v: string) => void;
  onChangeDoctor: (v: string) => void;
  onChangeService: (v: string) => void;
  onChangePrice: (v: number | "") => void;

  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean; // например, когда клиент не выбран
  touched?: boolean; // показывать ли ошибки валидации
  isDirty?: boolean; // есть ли введённые данные
};

const VisitCreateDialog: React.FC<Props> = ({
  open,
  fullScreen,
  mode = "create",
  titleText,
  submitLabel,
  dateTime,
  doctor,
  service,
  price,
  onChangeDateTime,
  onChangeDoctor,
  onChangeService,
  onChangePrice,
  onClose,
  onSubmit,
  submitting = false,
  disabled = false,
  touched = false,
  isDirty = false,
}) => {
  const { t } = useTranslation();
  const isEdit = mode === "edit";
  const resolvedTitle = titleText ?? (isEdit ? t("patientSearch.editAppointment") : t("patientSearch.createAppointment"));
  const resolvedSubmit = submitLabel ?? (isEdit ? t("common.save") : t("employees.createButton"));

  const { handleClose, handleCloseButton, ConfirmLeaveDialog } = useModalBackdropGuard({
    isDirty,
    onClose,
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={submitting ? undefined : handleClose}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
      >
        <DialogTitle>{resolvedTitle}</DialogTitle>
        <DialogContent>
          {/* Секция: Поля формы приема */}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <CustomDateTimePicker
              label={t("patientSearch.dateTimeRequired")}
              value={dateTime ? dayjs(dateTime) : null}
              onChange={(val) => onChangeDateTime(val ? val.format("YYYY-MM-DDTHH:mm") : "")}
              minutesStep={5}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: touched && !dateTime,
                  helperText: touched && !dateTime ? t("common.requiredField") : "",
                }
              }}
            />
            <TextField
              label={t("patientSearch.doctorFioOrId")}
              value={doctor}
              onChange={(e) => onChangeDoctor(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("patientSearch.serviceIdOrName")}
              value={service}
              onChange={(e) => onChangeService(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("products.cost")}
              type="number"
              value={price}
              onChange={(e) => onChangePrice(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {/* Секция: Кнопки управления */}
          <Button onClick={handleCloseButton} disabled={submitting}>{t("common.cancel")}</Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={disabled || submitting || !dateTime}
          >
            {resolvedSubmit}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmLeaveDialog />
    </>
  );
};

export default VisitCreateDialog;
