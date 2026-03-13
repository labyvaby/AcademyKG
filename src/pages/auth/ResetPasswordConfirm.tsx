import React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import smallIcon from "../../assets/img/icon_2s.png";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthCard from "../../components/auth/AuthCard";
import { confirmPasswordReset } from "../../services/auth";

const ResetPasswordConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = params.get("uid");
  const token = params.get("token");

  const [newPassword, setNewPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!uid || !token) {
      setErrorMsg("Ссылка недействительна или не содержит параметров безопасности");
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !token) {
      setErrorMsg("Ошибка: отсутствуют UID или Token");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setErrorMsg("Пароли не совпадают");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg("Пароль слишком короткий (минимум 8 символов)");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await confirmPasswordReset(uid, token, newPassword, passwordConfirm);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ошибка при сбросе пароля. Возможно, ссылка истекла.");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  };

  return (
    <AuthLayout>
      <AuthCard>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              p: 1.5,
              mb: 2,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.7)",
              boxShadow: "0 8px 16px -4px rgba(0,0,0,0.1)",
              backdropFilter: "blur(4px)"
            }}
          >
            <Box
              component="img"
              src={smallIcon}
              sx={{
                height: 48,
                width: 48,
                borderRadius: "50%",
                mixBlendMode: "darken",
                objectFit: "contain"
              }}
            />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{
            background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 1
          }}>
            Новый пароль
          </Typography>
          <Typography variant="body1" color="text.secondary" fontWeight={500}>
            Установите новый пароль для вашей учетной записи
          </Typography>
        </Box>

        {success ? (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Пароль успешно изменен! Сейчас вы будете перенаправлены на страницу входа.
            </Alert>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <Stack component="form" onSubmit={handleSubmit} spacing={3}>
              {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
              
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1} color="text.primary">
                  Новый пароль
                </Typography>
                <TextField
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "16px",
                      bgcolor: "rgba(255, 255, 255, 0.6)",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.9)" },
                      "&.Mui-focused": {
                        bgcolor: "#fff",
                        boxShadow: "0 0 0 4px rgba(42, 82, 152, 0.1)",
                      }
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1} color="text.primary">
                  Подтверждение пароля
                </Typography>
                <TextField
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "16px",
                      bgcolor: "rgba(255, 255, 255, 0.6)",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.9)" },
                      "&.Mui-focused": {
                        bgcolor: "#fff",
                        boxShadow: "0 0 0 4px rgba(42, 82, 152, 0.1)",
                      }
                    }
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !uid || !token}
                sx={{
                  py: 1.5,
                  borderRadius: "16px",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  textTransform: "none",
                  background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
                  boxShadow: "0 8px 20px -6px rgba(42, 82, 152, 0.5)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 12px 24px -6px rgba(42, 82, 152, 0.6)",
                  }
                }}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {loading ? "Сохранение..." : "Сбросить пароль"}
              </Button>
            </Stack>
          </motion.div>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default ResetPasswordConfirmPage;
