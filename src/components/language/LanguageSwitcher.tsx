import React from "react";
import { useTranslation } from "react-i18next";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Check from "@mui/icons-material/Check";
import TranslateOutlined from "@mui/icons-material/TranslateOutlined";
import { useTheme } from "@mui/material/styles";

import { SUPPORTED_LANGUAGES, type LanguageCode } from "../../i18n";

/**
 * Компактный переключатель языка интерфейса (RU / KG / UZ) для шапки.
 * Выбор сохраняется в localStorage самим i18next (LanguageDetector).
 */
export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const currentCode = (i18n.resolvedLanguage ?? i18n.language ?? "ru").slice(0, 2) as LanguageCode;
  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentCode) ?? SUPPORTED_LANGUAGES[0];

  const handleSelect = (code: LanguageCode) => {
    void i18n.changeLanguage(code);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t("common.language")}>
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          startIcon={<TranslateOutlined sx={{ fontSize: { xs: 16, sm: 18 } }} />}
          sx={{
            minWidth: 0,
            px: { xs: 0.75, sm: 1 },
            height: 34,
            color: "text.primary",
            borderRadius: 2,
            fontWeight: 700,
            fontSize: "0.8rem",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)",
            "&:hover": {
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(0,0,0,0.08)",
            },
          }}
          aria-label={t("common.language")}
        >
          {current.short}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            selected={lang.code === current.code}
            onClick={() => handleSelect(lang.code)}
            sx={{ minWidth: 160, gap: 1 }}
          >
            <ListItemText primary={lang.label} />
            {lang.code === current.code && (
              <Check fontSize="small" color="primary" />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSwitcher;
