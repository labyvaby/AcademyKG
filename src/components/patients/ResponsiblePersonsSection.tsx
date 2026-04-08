import React from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { PhoneCountryCodeSelect } from "../ui";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  parsePhone,
  type PhoneCountryCode,
} from "../../utility/phone";

export type ResponsiblePersonPayload = {
  fullName: string;
  phone: string;
};

export type ResponsiblePersonValue = {
  id: string;
  fullName: string;
  phone: string;
  phoneCountryCode: PhoneCountryCode;
};

export type ResponsiblePersonFieldErrors = {
  fullName?: string;
  phone?: string;
};

const createDraftId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function createResponsiblePersonValue(
  person?: Partial<ResponsiblePersonPayload> | null,
): ResponsiblePersonValue {
  const parsedPhone = parsePhone(person?.phone ?? "");
  const maxLength = getPhoneLocalMaxLength(parsedPhone.countryCode);

  return {
    id: createDraftId(),
    fullName: String(person?.fullName ?? ""),
    phone: parsedPhone.local.replace(/[^\d]/g, "").slice(0, maxLength),
    phoneCountryCode: parsedPhone.countryCode,
  };
}

export function ensureResponsiblePersonValues(
  persons?: Array<Partial<ResponsiblePersonPayload> | null | undefined>,
): ResponsiblePersonValue[] {
  const mapped = (persons ?? [])
    .filter(Boolean)
    .map((person) => createResponsiblePersonValue(person));

  return mapped.length > 0 ? mapped : [createResponsiblePersonValue()];
}

type Props = {
  persons: ResponsiblePersonValue[];
  errors?: ResponsiblePersonFieldErrors[];
  onChange: (
    index: number,
    patch: Partial<Omit<ResponsiblePersonValue, "id">>,
  ) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  title?: string;
  helperText?: string;
};

const ResponsiblePersonsSection: React.FC<Props> = ({
  persons,
  errors = [],
  onChange,
  onAdd,
  onRemove,
  disabled = false,
  title = "Ответственные лица *",
  helperText = "Минимум один контакт обязателен. Дополнительные пустые строки не отправляются.",
}) => {
  const hasErrors = errors.some((error) => error?.fullName || error?.phone);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: hasErrors ? "error.main" : "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600, mb: 0.5 }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            color={hasErrors ? "error.main" : "text.secondary"}
          >
            {helperText}
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          {persons.map((person, index) => {
            const phoneMaxLength = getPhoneLocalMaxLength(person.phoneCountryCode);

            return (
              <Box
                key={person.id}
                sx={{
                  border: "1px solid",
                  borderColor:
                    errors[index]?.fullName || errors[index]?.phone
                      ? "error.main"
                      : "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {index === 0
                        ? "Основное ответственное лицо *"
                        : `Ответственное лицо ${index + 1}`}
                    </Typography>
                    {persons.length > 1 && (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={disabled}
                        onClick={() => onRemove(index)}
                      >
                        <CloseOutlined fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <TextField
                    value={person.fullName}
                    onChange={(event) =>
                      onChange(index, { fullName: event.target.value })
                    }
                    fullWidth
                    size="small"
                    disabled={disabled}
                    placeholder="ФИО ответственного лица"
                    error={Boolean(errors[index]?.fullName)}
                    helperText={errors[index]?.fullName || ""}
                  />

                  <TextField
                    value={person.phone}
                    onChange={(event) =>
                      onChange(index, {
                        phone: event.target.value
                          .replace(/[^\d]/g, "")
                          .slice(0, phoneMaxLength),
                      })
                    }
                    fullWidth
                    size="small"
                    disabled={disabled}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment
                          position="start"
                          sx={{ mr: 1, ml: "-14px" }}
                        >
                          <PhoneCountryCodeSelect
                            value={person.phoneCountryCode}
                            onChange={(countryCode) =>
                              onChange(index, {
                                phoneCountryCode: countryCode,
                                phone: person.phone.slice(
                                  0,
                                  getPhoneLocalMaxLength(countryCode),
                                ),
                              })
                            }
                          />
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{
                      inputMode: "tel",
                      pattern: "[0-9]*",
                      maxLength: phoneMaxLength,
                    }}
                    placeholder={
                      phoneMaxLength === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"
                    }
                    error={Boolean(errors[index]?.phone)}
                    helperText={errors[index]?.phone || ""}
                  />
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddOutlined />}
          onClick={onAdd}
          disabled={disabled}
          sx={{ alignSelf: "flex-start" }}
        >
          Добавить ещё
        </Button>
      </Stack>
    </Box>
  );
};

export default ResponsiblePersonsSection;
