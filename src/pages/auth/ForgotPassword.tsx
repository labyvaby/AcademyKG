import React from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import smallIcon from "../../assets/img/icon_2s.png";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthCard from "../../components/auth/AuthCard";
import { requestPasswordReset } from "../../services/auth";

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Введите email");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Можно передать redirectUrl, если нужно переправить пользователя на конкретную страницу
      // Дефолт берется из бекенда.
      await requestPasswordReset(email.trim(), window.location.origin + "/reset-password");
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ошибка при отправке запроса");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
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
            Сброс пароля
          </Typography>
          <Typography variant="body1" color="text.secondary" fontWeight={500}>
            {success ? "Письмо отправлено" : "Введите email для восстановления доступа"}
          </Typography>
        </Box>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="request-form"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Stack component="form" onSubmit={handleSubmit} spacing={3}>
                {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
                
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1} color="text.primary">
                    Email адрес
                  </Typography>
                  <TextField
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    autoFocus
                    placeholder="example@mail.com"
                    type="email"
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
                  disabled={loading}
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
                  {loading ? "Отправка..." : "Отправить ссылку"}
                </Button>

                <Button
                  variant="text"
                  startIcon={<ArrowBackOutlined />}
                  onClick={() => navigate("/login")}
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    color: "text.secondary",
                    "&:hover": { color: "primary.main", background: "transparent" }
                  }}
                >
                  Вернуться ко входу
                </Button>
              </Stack>
            </motion.div>
          ) : (
            <motion.div
              key="success-message"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Box textAlign="center" py={2}>
                <Typography variant="body1" color="text.secondary" mb={4}>
                  Мы отправили инструкцию по сбросу пароля на адрес <b>{email}</b>. 
                  Пожалуйста, проверьте вашу почту (включая папку "Спам").
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate("/login")}
                  sx={{
                    py: 1.5,
                    borderRadius: "16px",
                    fontSize: "1.05rem",
                    fontWeight: 600,
                    textTransform: "none",
                    background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
                  }}
                >
                  Понятно
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthCard>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
