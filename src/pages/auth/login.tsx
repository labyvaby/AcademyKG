import React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
} from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import smallIcon from "../../assets/img/icon_2s.png";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthCard from "../../components/auth/AuthCard";
import { PhoneCountryCodeSelect } from "../../components/ui";
import {
  composePhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneLocalMaxLength,
  type PhoneCountryCode,
} from "../../utility/phone";
import { isAuthenticated, requestSmsCode, verifySmsCode, loginWithEmail, logout } from "../../services/auth";
import { refetchPermissions } from "../../hooks/usePermissions";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 минут

function getFailState(): { count: number; lockedUntil: number } {
  try {
    const raw = localStorage.getItem("login_fail_state");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { count: 0, lockedUntil: 0 };
}

function setFailState(count: number, lockedUntil: number) {
  localStorage.setItem("login_fail_state", JSON.stringify({ count, lockedUntil }));
}

function clearFailState() {
  localStorage.removeItem("login_fail_state");
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("to") || "/home";

  const [phoneCountryCode, setPhoneCountryCode] = React.useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [isOtpSent, setIsOtpSent] = React.useState(false);
  const [lastSentPhone, setLastSentPhone] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);

  // Brute-force protection state
  const [failCount, setFailCount] = React.useState(() => getFailState().count);
  const [lockedUntil, setLockedUntil] = React.useState(() => getFailState().lockedUntil);
  const [lockCountdown, setLockCountdown] = React.useState(0);

  React.useEffect(() => {
    if (lockedUntil <= 0) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockCountdown(0);
        setLockedUntil(0);
        setFailCount(0);
        clearFailState();
      } else {
        setLockCountdown(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil > Date.now();

  const handleFailedAttempt = () => {
    const { count } = getFailState();
    const newCount = count + 1;
    if (newCount >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      setFailState(newCount, until);
      setFailCount(newCount);
      setLockedUntil(until);
    } else {
      setFailState(newCount, 0);
      setFailCount(newCount);
    }
  };

  const handleSuccessfulLogin = () => {
    clearFailState();
    setFailCount(0);
    setLockedUntil(0);
  };

  // Email form state
  const [loginMethod, setLoginMethod] = React.useState<"phone" | "email">("phone");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated()) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return "Произошла неизвестная ошибка";
  };

  // Если сервер вернул 429 — применяем серверную блокировку с таймером
  const handle429FromServer = (err: unknown) => {
    const e = err as any;
    if (e?.status === 429) {
      const retryAfter = e?.retryAfterSeconds ?? 60;
      const until = Date.now() + retryAfter * 1000;
      setFailState(MAX_ATTEMPTS, until);
      setFailCount(MAX_ATTEMPTS);
      setLockedUntil(until);
      return true;
    }
    return false;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneLocal.replace(/[^0-9]/g, "");
    const maxLen = getPhoneLocalMaxLength(phoneCountryCode);

    if (digits.length < maxLen) {
      setErrorMsg("Введите полный номер телефона");
      return;
    }

    const fullPhone = composePhone(phoneCountryCode, phoneLocal);
    if (!fullPhone) {
      setErrorMsg("Введите номер телефона");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await requestSmsCode(fullPhone);
      setLastSentPhone(fullPhone);
      setIsOtpSent(true);
      setInfoMsg("Код отправлен на " + fullPhone);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = lastSentPhone ?? composePhone(phoneCountryCode, phoneLocal);

    if (!fullPhone) {
      setErrorMsg("Телефон не определён");
      return;
    }

    if (!otpCode.trim()) {
      setErrorMsg("Введите код из SMS");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      logout(); // Clean start
      await verifySmsCode(fullPhone, otpCode.trim());
      handleSuccessfulLogin();
      await refetchPermissions();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      handleFailedAttempt();
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Введите email и пароль");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      logout(); // Clean start
      await loginWithEmail(email.trim(), password.trim());
      handleSuccessfulLogin();
      await refetchPermissions();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (!handle429FromServer(err)) {
        handleFailedAttempt();
      }
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Варианты анимации для Framer Motion
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          {/* Логотип со скруглением и без белого фона */}
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
                mixBlendMode: "darken", // Убираем белый фон
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
            Academy KG
          </Typography>
          <Typography variant="body1" color="text.secondary" fontWeight={500}>
            Вход в систему
          </Typography>
        </Box>

        <Tabs
          value={loginMethod}
          onChange={(_, val) => {
            setLoginMethod(val);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          variant="fullWidth"
          sx={{
            mb: 4,
            "& .MuiTabs-indicator": {
              height: 3,
              borderRadius: "3px 3px 0 0",
              background: "linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)",
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "text.secondary",
              "&.Mui-selected": {
                color: "primary.main",
              }
            }
          }}
        >
          <Tab
            icon={<PhoneOutlined sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Телефон"
            value="phone"
          />
          <Tab
            icon={<EmailOutlined sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Email"
            value="email"
          />
        </Tabs>

        <AnimatePresence mode="wait">
          {isLocked && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                Слишком много неудачных попыток. Вход заблокирован на {Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, "0")}
              </Alert>
            </motion.div>
          )}
          {!isLocked && failCount > 0 && failCount < MAX_ATTEMPTS && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                Неверные данные. Осталось попыток: {MAX_ATTEMPTS - failCount}
              </Alert>
            </motion.div>
          )}
          {!isLocked && errorMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>
            </motion.div>
          )}
          {infoMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>{infoMsg}</Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {loginMethod === "phone" ? (
            !isOtpSent ? (
              <motion.div
                key="step-phone"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Stack component="form" onSubmit={handleSendCode} spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} mb={1} color="text.primary">
                      Номер телефона
                    </Typography>
                    <TextField
                      value={phoneLocal}
                      onChange={(e) => {
                        const maxLen = getPhoneLocalMaxLength(phoneCountryCode);
                        setPhoneLocal(e.target.value.replace(/[^0-9]/g, "").slice(0, maxLen));
                      }}
                      fullWidth
                      autoFocus
                      placeholder={getPhoneLocalMaxLength(phoneCountryCode) === 10 ? "XXX XXX XXXX" : "XXX XXX XXX"}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 1, ml: "-14px" }}>
                            <PhoneCountryCodeSelect
                              value={phoneCountryCode}
                              onChange={(code) => setPhoneCountryCode(code)}
                            />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "16px",
                          bgcolor: "rgba(255, 255, 255, 0.6)",
                          transition: "all 0.2s ease-in-out",
                          "&:hover": {
                            bgcolor: "rgba(255, 255, 255, 0.9)",
                          },
                          "&.Mui-focused": {
                            bgcolor: "#fff",
                            boxShadow: "0 0 0 4px rgba(42, 82, 152, 0.1)",
                          }
                        },
                        "& input": {
                          paddingLeft: "15px",
                          fontSize: "1.05rem",
                          letterSpacing: "1px"
                        }
                      }}
                    />
                  </Box>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading || isLocked}
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
                    {loading ? "Отправка..." : "Получить код"}
                  </Button>
                </Stack>
              </motion.div>
            ) : (
              <motion.div
                key="step-otp"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Stack component="form" onSubmit={handleVerifyCode} spacing={3}>
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary" mb={0.5}>
                      Код отправлен на номер
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      {lastSentPhone}
                    </Typography>
                  </Box>

                  <Box>
                    <TextField
                      placeholder="Введите 4 цифры"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      fullWidth
                      autoFocus
                      inputProps={{
                        inputMode: "numeric",
                        maxLength: 4,
                        style: { textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 600 }
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

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading || otpCode.length < 4}
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
                      },
                      "&:disabled": {
                        background: "rgba(0, 0, 0, 0.12)",
                        boxShadow: "none",
                        transform: "none",
                      }
                    }}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
                  >
                    {loading ? "Проверка..." : isLocked ? `Заблокировано (${Math.floor(lockCountdown / 60)}:${String(lockCountdown % 60).padStart(2, "0")})` : "Войти"}
                  </Button>

                  <Button
                    variant="text"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtpCode("");
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    disabled={loading}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      color: "text.secondary",
                      "&:hover": { color: "primary.main", background: "transparent" }
                    }}
                  >
                    Ввести другой номер
                  </Button>
                </Stack>
              </motion.div>
            )
          ) : (
            <motion.div
              key="step-email"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Stack component="form" onSubmit={handleEmailLogin} spacing={3}>
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
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1} color="text.primary">
                    Пароль
                  </Typography>
                  <TextField
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <Box sx={{ textAlign: "right", mt: -1 }}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => navigate("/forgot-password")}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      color: "text.secondary",
                      "&:hover": { color: "primary.main", background: "transparent" }
                    }}
                  >
                    Забыли пароль?
                  </Button>
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || isLocked}
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
                  {loading ? "Вход..." : isLocked ? `Заблокировано (${Math.floor(lockCountdown / 60)}:${String(lockCountdown % 60).padStart(2, "0")})` : "Войти"}
                </Button>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthCard>
    </AuthLayout>
  );
};

export default LoginPage;
