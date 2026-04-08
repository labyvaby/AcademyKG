import React from "react";
import { Box } from "@mui/material";

// Используем картинку напрямую из папки public
const authBg = "/samsung-galaxy-tab-5120x3632-25729.jpg";

type Props = {
  children: React.ReactNode;
};

const AuthLayout: React.FC<Props> = ({ children }) => {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "center",
        px: { xs: 2, md: 3 },
        py: { xs: 4, md: 3 },
        overflowX: "hidden",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        bgcolor: "#000",
      }}
    >
      {/* Основной фон с блюром */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${authBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(5px)", // 5% блюра (примерно 5px)
          transform: "scale(1.05)", // Компенсация краев из-за блюра
          zIndex: 0,
        }}
      />

      {/* Затемняющий/смягчающий слой */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: "rgba(255, 255, 255, 0.1)", // Легкое осветление
          zIndex: 1,
        }}
      />

      {/* Контент авторизации по центру */}
      <Box
        sx={{
          position: "relative",
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AuthLayout;
