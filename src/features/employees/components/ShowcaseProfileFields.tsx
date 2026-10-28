import React from "react";
import { useTranslation } from "react-i18next";
import { Chip, Stack, TextField, Typography } from "@mui/material";

// Профиль специалиста на витрине онлайн-записи (/book): общий для всех его филиалов.
// Стаж храним годом начала работы — число на витрине не устаревает.

export const SPECIALIST_LANGUAGES = ["ru", "ky", "uz", "en"] as const;

export type ShowcaseProfile = {
  publicBio: string;
  /** Год строкой — как в поле ввода; "" — не указан. */
  careerStartYear: string;
  languages: string[];
};

export const EMPTY_SHOWCASE_PROFILE: ShowcaseProfile = { publicBio: "", careerStartYear: "", languages: [] };

export const showcaseProfileFromDetail = (d: any): ShowcaseProfile => ({
  publicBio: d?.publicBio ?? "",
  careerStartYear: d?.careerStartYear ? String(d.careerStartYear) : "",
  languages: Array.isArray(d?.languages) ? d.languages : [],
});

/** Поля для PATCH /employees/{id}/: пустые значения очищают профиль. */
export const showcaseProfilePayload = (p: ShowcaseProfile) => ({
  publicBio: p.publicBio.trim(),
  careerStartYear: p.careerStartYear ? Number(p.careerStartYear) : null,
  languages: SPECIALIST_LANGUAGES.filter((code) => p.languages.includes(code)),
});

export const isCareerYearInvalid = (value: string): boolean => {
  if (!value) return false;
  const year = Number(value);
  return !Number.isInteger(year) || year < 1960 || year > new Date().getFullYear();
};

const ShowcaseProfileFields: React.FC<{ value: ShowcaseProfile; onChange: (next: ShowcaseProfile) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const yearInvalid = isCareerYearInvalid(value.careerStartYear);
  const toggleLanguage = (code: string) =>
    onChange({
      ...value,
      languages: value.languages.includes(code) ? value.languages.filter((c) => c !== code) : [...value.languages, code],
    });

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.25}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t("employees.showcase.title")}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t("employees.showcase.hint")}
        </Typography>
      </Stack>
      <TextField
        label={t("employees.showcase.bio")}
        value={value.publicBio}
        onChange={(e) => onChange({ ...value, publicBio: e.target.value })}
        multiline
        minRows={3}
        fullWidth
        inputProps={{ maxLength: 2000 }}
        helperText={`${value.publicBio.length}/2000`}
      />
      <TextField
        label={t("employees.showcase.careerStartYear")}
        value={value.careerStartYear}
        onChange={(e) => onChange({ ...value, careerStartYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
        error={yearInvalid}
        helperText={yearInvalid ? t("employees.showcase.careerStartYearInvalid") : t("employees.showcase.careerStartYearHint")}
        inputProps={{ inputMode: "numeric" }}
        sx={{ maxWidth: 260 }}
      />
      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary">
          {t("employees.showcase.languages")}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {SPECIALIST_LANGUAGES.map((code) => {
            const selected = value.languages.includes(code);
            return (
              <Chip
                key={code}
                label={t(`employees.showcase.lang.${code}`)}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => toggleLanguage(code)}
              />
            );
          })}
        </Stack>
      </Stack>
    </Stack>
  );
};

export default ShowcaseProfileFields;
