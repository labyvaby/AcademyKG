import React from "react";
import { Divider, Stack, Typography, Avatar, Chip, Card, CardHeader, CardContent, Box, Link } from "@mui/material";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import LocalPhoneOutlined from "@mui/icons-material/LocalPhoneOutlined";
import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import TelegramIcon from "@mui/icons-material/Telegram";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import type { EmployesRow } from "../types";
import type { ServiceRow as ServiceDto } from "../../../services/services";
import { formatDateRu } from "../../../utility/format";

export type EmployeeCardProps = { emp: EmployesRow | null; allServices: ServiceDto[] };

const calculateAge = (birthDate: string) => {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  let monthDiff = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) monthDiff--;
  const y = Math.floor(monthDiff / 12);
  const m = monthDiff % 12;
  const decl = (n: number, t: [string, string, string]) =>
    t[n % 100 > 4 && n % 100 < 20 ? 2 : [2,0,1,1,1,2][n % 10 < 5 ? n % 10 : 5]];
  return `(${y} ${decl(y, ["год","года","лет"])}${m > 0 ? ` и ${m} ${decl(m, ["месяц","месяца","месяцев"])}` : ""})`;
};

const EmployeeCard: React.FC<EmployeeCardProps> = ({ emp, allServices }) => {
  if (!emp) return null;

  const fio = emp.full_name || emp.id || "";
  const phone = emp.phone || "";
  const birth = emp.birth_date || "";
  const photo = emp.photo_url || undefined;

  // Роль — берём из roleName (новый API) или role_id fallback
  const empAny = emp as any;
  const roleDisplayName: string = empAny.roleName ?? empAny.role_display_name ?? "";

  // Специализации — из поля specializations (массив объектов {id, name})
  const specializationNames: string[] = Array.isArray(empAny.specializations)
    ? empAny.specializations.map((s: any) => s.name ?? '').filter(Boolean)
    : [];

  // Услуги — из specializationIds или serviceIds если есть
  const serviceIds: string[] = Array.isArray(empAny.serviceIds)
    ? empAny.serviceIds
    : [];

  const servicesForEmployee = React.useMemo(() => {
    if (serviceIds.length === 0 || allServices.length === 0) return [] as { id: string; name: string }[];
    return serviceIds.map(id => {
      const svc = allServices.find(s => s.id === id);
      return { id, name: svc?.name ?? id };
    });
  }, [serviceIds, allServices]);

  const roleText = roleDisplayName || (emp.status === 'active' ? "Сотрудник" : "");

  return (
    <Card elevation={0} sx={{ bgcolor: "transparent" }}>
      <CardHeader
        avatar={
          <Avatar
            src={photo}
            sx={{ width: 56, height: 56, bgcolor: "primary.main", fontSize: 22 }}
          >
            {!photo && fio ? fio[0].toUpperCase() : <PersonOutlineOutlined />}
          </Avatar>
        }
        title={<Typography variant="h6" fontWeight={600}>{fio}</Typography>}
        subheader={
          <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
            {roleText && <Chip label={roleText} size="small" color="primary" variant="outlined" />}
            {specializationNames.map(name => (
              <Chip key={name} label={name} size="small" variant="outlined" />
            ))}
          </Stack>
        }
      />
      <CardContent>
        <Stack spacing={1.5}>
          {phone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <LocalPhoneOutlined fontSize="small" color="action" />
              <Link href={`tel:${phone}`} underline="hover" variant="body2">{phone}</Link>
            </Stack>
          )}
          {emp.email && (
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailOutlined fontSize="small" color="action" />
              <Typography variant="body2">{emp.email}</Typography>
            </Stack>
          )}
          {(empAny.telegram_id || empAny.telegramId) && (
            <Stack direction="row" spacing={1} alignItems="center">
              <TelegramIcon fontSize="small" color="action" />
              <Typography variant="body2">{empAny.telegram_id ?? empAny.telegramId}</Typography>
            </Stack>
          )}
          {birth && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PersonOutlineOutlined fontSize="small" color="action" />
              <Typography variant="body2">{formatDateRu(birth)} {calculateAge(birth)}</Typography>
            </Stack>
          )}
          {(empAny.bank_account_number || empAny.bankAccountNumber) && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CreditCardOutlined fontSize="small" color="action" />
              <Typography variant="body2">{empAny.bank_account_number ?? empAny.bankAccountNumber}</Typography>
            </Stack>
          )}
          {servicesForEmployee.length > 0 && (
            <>
              <Divider />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <LocalOfferOutlined fontSize="small" color="action" sx={{ mt: 0.5 }} />
                {servicesForEmployee.map(s => (
                  <Chip key={s.id} label={s.name} size="small" />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default EmployeeCard;
