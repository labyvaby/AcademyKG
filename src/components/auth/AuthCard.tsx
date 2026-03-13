import React from "react";
import { CardContent, Box } from "@mui/material";

type Props = {
  children: React.ReactNode;
};

const AuthCard: React.FC<Props> = ({ children }) => {
  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        maxWidth: 420,
        borderRadius: "24px",
        overflow: "hidden",
        position: "relative",

        // Glassmorphism эффект
        backdropFilter: "blur(20px) saturate(120%)",
        WebkitBackdropFilter: "blur(20px) saturate(120%)", // для iOS Safari

        bgcolor: theme.palette.mode === "dark"
          ? "rgba(18, 18, 18, 0.7)"
          : "rgba(255, 255, 255, 0.8)",

        // Градиентная обводка (имитация блика)
        border: "1px solid",
        borderColor: theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(255, 255, 255, 0.4)",

        // Премиальная мягкая тень
        boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.1), 0 12px 24px -16px rgba(0, 0, 0, 0.05)",

        // Внутренний блик
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
          zIndex: 1,
        }
      })}
    >
      <CardContent sx={{ p: { xs: 4, sm: 5 }, position: "relative", zIndex: 2 }}>
        {children}
      </CardContent>
    </Box>
  );
};

export default AuthCard;
