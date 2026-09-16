import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router";
import { AppButton } from "../../components/ui";

export const UnderConstruction: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={(theme) => ({ minHeight: theme.appLayout.fullPage.minHeight, p: 3 })}
    >
      <Typography variant="h4" textAlign="center">
        {t("placeholder.underConstruction")}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {t("placeholder.workingOnFeature")}
      </Typography>
      <Box>
        <AppButton component={RouterLink} to="/home" variant="contained">
          {t("placeholder.goBack")}
        </AppButton>
      </Box>
    </Stack>
  );
};
