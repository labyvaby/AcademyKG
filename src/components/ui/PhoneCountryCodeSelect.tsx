import React from "react";
import { TextField, MenuItem, Box, Typography } from "@mui/material";
import { PHONE_COUNTRIES, type PhoneCountryCode } from "../../utility/phone";

export interface PhoneCountryCodeSelectProps {
  value: PhoneCountryCode;
  onChange: (code: PhoneCountryCode) => void;
  disabled?: boolean;
  size?: "small" | "medium";
}

/**
 * Единый селект кода страны для телефонных полей.
 * Список стран СНГ берётся из PHONE_COUNTRIES (utility/phone).
 * В закрытом виде показывает только код (поле остаётся узким),
 * в выпадающем списке — код + название страны.
 */
export const PhoneCountryCodeSelect: React.FC<PhoneCountryCodeSelectProps> = ({
  value,
  onChange,
  disabled,
  size = "small",
}) => {
  return (
    <TextField
      select
      value={value}
      onChange={(e) => onChange(e.target.value as PhoneCountryCode)}
      disabled={disabled}
      size={size}
      SelectProps={{
        // В закрытом виде — только код, чтобы не растягивать поле.
        renderValue: (selected) => selected as string,
      }}
      sx={{
        minWidth: 96,
        maxWidth: 110,
        '& .MuiInputBase-input': {
          paddingLeft: '15px',
        }
      }}
    >
      {PHONE_COUNTRIES.map((country) => (
        <MenuItem key={country.code} value={country.code}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, width: "100%" }}>
            <Typography component="span" sx={{ fontWeight: 600, minWidth: 44 }}>
              {country.code}
            </Typography>
            <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
              {country.name}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
};

export default PhoneCountryCodeSelect;
