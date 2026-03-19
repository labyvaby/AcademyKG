/**
 * ServiceDetailsForm.tsx
 * Презентационный блок основных полей услуги: Название и Цена.
 * Отвечает ТОЛЬКО за UI: два TextField и стилизация. Не содержит бизнес-логики.
 * Данные и колбэки приходят сверху.
 */
import React from "react";
import { Stack, TextField, InputAdornment, Typography, Paper, Tabs, Tab, Collapse } from "@mui/material";

// Стили для вкладок-переключателей (копируем логику из товаров для единообразия)
const toggleTabStyles = (theme: any, color: string) => ({
  minHeight: 32,
  borderRadius: 1,
  textTransform: "none",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "text.secondary",
  "&.Mui-selected": {
    color: theme.palette.getContrastText(color),
    bgcolor: color,
  },
  transition: "all 0.2s",
});

export type ServiceDetailsFormProps = {
  name: string;
  setName: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  isGroup: boolean;
  setIsGroup: (v: boolean) => void;
  maxParticipants: string;
  setMaxParticipants: (v: string) => void;
  durationMinutes: string;
  setDurationMinutes: (v: string) => void;
  touched?: boolean;
};

const ServiceDetailsForm: React.FC<ServiceDetailsFormProps> = ({
  name,
  setName,
  price,
  setPrice,
  description,
  setDescription,
  isActive,
  setIsActive,
  isGroup,
  setIsGroup,
  maxParticipants,
  setMaxParticipants,
  durationMinutes,
  setDurationMinutes,
  touched = false,
}) => {
  const nameError = touched && !name.trim();
  const priceError = touched && (!price || Number(price) <= 0);
  return (
    <Stack spacing={3}>
      {/* Секция: Название услуги */}
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Название услуги *
        </Typography>
        <TextField
          placeholder="Например: Тренировка с тренером"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          fullWidth
          error={nameError}
          helperText={nameError ? "Обязательное поле" : ""}
        />
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Стоимость услуги *
        </Typography>
        <TextField
          type="text"
          inputMode="numeric"
          value={price}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value.replace(/[^\d]/g, "");
            setPrice(v);
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">сом</InputAdornment>,
          }}
          fullWidth
          placeholder="0"
          error={priceError}
          helperText={priceError ? "Введите положительную стоимость" : ""}
        />
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Описание
        </Typography>
        <TextField
          placeholder="Добавьте описание услуги (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
        />
      </Stack>

      {/* Тип услуги */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="body2">Тип услуги</Typography>
        <Tabs
          value={isGroup ? 1 : 0}
          onChange={(_, v) => setIsGroup(v === 1)}
          sx={{ minHeight: 32 }}
          TabIndicatorProps={{ style: { display: "none" } }}
        >
          <Tab
            label="Индивидуальная"
            sx={(theme) => ({
              ...toggleTabStyles(theme, theme.palette.primary.main),
              minHeight: 32, py: 0, px: 2,
            })}
          />
          <Tab
            label="Групповая"
            sx={(theme) => ({
              ...toggleTabStyles(theme, theme.palette.secondary.main),
              minHeight: 32, py: 0, px: 2,
            })}
          />
        </Tabs>
      </Paper>

      {/* Максимум участников — только для групповой */}
      <Collapse in={isGroup}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Максимум участников *
          </Typography>
          <TextField
            type="text"
            inputMode="numeric"
            placeholder="Например: 10"
            value={maxParticipants}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              setMaxParticipants(v);
            }}
            InputProps={{
              endAdornment: <InputAdornment position="end">чел.</InputAdornment>,
            }}
            fullWidth
            error={touched && isGroup && (!maxParticipants || Number(maxParticipants) <= 0)}
            helperText={touched && isGroup && (!maxParticipants || Number(maxParticipants) <= 0) ? "Укажите максимальное кол-во участников" : ""}
          />
        </Stack>
      </Collapse>

      {/* Длительность */}
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Длительность
        </Typography>
        <TextField
          type="text"
          inputMode="numeric"
          placeholder="Например: 60"
          value={durationMinutes}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "");
            setDurationMinutes(v);
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">мин.</InputAdornment>,
          }}
          fullWidth
          helperText="Влияет на отображение окон в расписании регистратуры"
        />
      </Stack>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2">Статус услуги</Typography>
        <Tabs
          value={isActive ? 0 : 1}
          onChange={(_, v) => setIsActive(v === 0)}
          sx={{ minHeight: 32 }}
          TabIndicatorProps={{ style: { display: "none" } }}
        >
          <Tab
            label="Активна"
            sx={(theme) => ({
              ...toggleTabStyles(theme, theme.palette.success.main),
              minHeight: 32,
              py: 0,
              px: 2,
            })}
          />
          <Tab
            label="Неактивна"
            sx={(theme) => ({
              ...toggleTabStyles(theme, theme.palette.action.disabledBackground),
              minHeight: 32,
              py: 0,
              px: 2,
              "&.Mui-selected": { bgcolor: "action.selected", color: "text.primary" },
            })}
          />
        </Tabs>
      </Paper>
    </Stack>
  );
};

export default ServiceDetailsForm;
