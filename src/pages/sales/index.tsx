import React from "react";
import { Box, Typography } from "@mui/material";
import { usePageTitle } from "../../hooks/usePageTitle";

const SalesPage: React.FC = () => {
  usePageTitle("Продажи");
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", p: 4 }}>
      <Typography color="text.secondary">Раздел продаж находится в разработке</Typography>
    </Box>
  );
};

export default SalesPage;
