import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
  Avatar,
  LinearProgress,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CardGiftcardOutlined from "@mui/icons-material/CardGiftcardOutlined";
import Tooltip from "@mui/material/Tooltip";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";

import { formatKGS } from "../../../utility/format";
import { getStatusConfig, getStatusChipSx } from "../../../config/appointmentStatuses";
import dayjs from "dayjs";
import { dayjsBishkek } from "../../../utility/dayjsBishkek";

import type { Appointment } from "../types";
import type { Shift } from "../../../services/shifts";

import type { EmployeesRow } from "../../expenses/types";

type AppointmentsListProps = {
  titleDate: string; // formatted dd.MM.yyyy
  loading: boolean;
  errorMsg: string | null;
  items: Appointment[];
  onOpenFilters: () => void;
  onItemClick?: (id: string) => void;
  hideDoctorFilter?: boolean;
  doctors?: EmployeesRow[];
  shifts?: Shift[];
  restrictToDoctorId?: string; // If provided, only show appointments for this doctor
  selectedDoctorName?: string | null; // For hierarchical filtering passing
};

// --- Doctor Story Item (Instagram Style) ---
type DoctorStoryItemProps = {
  name: string;
  nickname?: string;
  photoUrl?: string;
  isActive: boolean;
  onClick: () => void;
};

const DoctorStoryItem: React.FC<DoctorStoryItemProps> = ({ name, nickname, photoUrl, isActive, onClick }) => {
  const displayName = nickname || name.split(' ')[0]; // Use nickname or just first name if FIO
  const theme = useTheme();

  return (
    <Stack
      spacing={0.25}
      alignItems="center"
      onClick={onClick}
      sx={{
        cursor: "pointer",
        minWidth: 56,
        transition: "all 0.2s ease",
        "&:active": { transform: "scale(0.92)" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: "50%",
          padding: "3px", // Space for gradient border
          background: isActive
            ? theme.palette.primary.main
            : "transparent",
          border: isActive ? "none" : `1.5px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Avatar
          src={photoUrl}
          sx={{
            width: "100%",
            height: "100%",
            border: isActive ? `2px solid ${theme.palette.background.paper}` : "none",
            bgcolor: "primary.main",
            fontSize: "1.25rem",
            fontWeight: 700,
          }}
        >
          {name.charAt(0)}
        </Avatar>
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "text.primary" : "text.secondary",
          fontSize: "0.75rem",
          textAlign: "center",
          maxWidth: 72,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {displayName}
      </Typography>
    </Stack>
  );
};

// ОПТИМИЗАЦИЯ: React.memo предотвращает ненужные ре-рендеры при неизменных пропсах
// --- Add Slot Button Component ---
import AddCircleOutline from "@mui/icons-material/AddCircleOutline";

type AddSlotButtonProps = {
  timeStr: string;
  onClick: () => void;
};

const AddSlotButton: React.FC<AddSlotButtonProps> = ({ timeStr, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      mx: 2,
      my: 1,
      height: 44,
      border: "1px dashed",
      borderColor: "primary.main", // Always primary
      borderRadius: 1.5,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "primary.main", // Always primary
      cursor: "pointer",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05), // Light primary background
      "&:hover": {
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        transform: "translateY(-1px)",
        boxShadow: (theme) => `0 4px 12px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)'}`,
      },
      "&:active": {
        transform: "scale(0.98)",
      },
    }}
  >
    <AddCircleOutline sx={{ fontSize: 18, mr: 1, opacity: 0.8 }} />
    <Typography variant="body2" fontWeight={600}>
      Есть окно на {timeStr}
    </Typography>
  </Box>
);

// --- Gap Calculation Logic ---

const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 mins
const DEFAULT_DURATION_MINS = 30; // 30 mins default duration

type GapSlot = {
  isGap: true;
  id: string; // unique key
  startTime: Date;
  timeStr: string; // HH:mm
  doctorId: string; // to associate new record with doctor
};

type RenderItem = Appointment | GapSlot;

function isGap(item: RenderItem): item is GapSlot {
  return (item as GapSlot).isGap === true;
}

export const AppointmentsList: React.FC<AppointmentsListProps & { onAddSlot?: (dateIso: string, doctorId?: string) => void }> = React.memo(({
  titleDate,
  loading,
  errorMsg,
  items,
  onOpenFilters,
  onItemClick,
  onAddSlot,
  hideDoctorFilter,
  doctors,
  shifts,
  restrictToDoctorId,
  selectedDoctorName,
}) => {
  const theme = useTheme();
  const [selectedDoctor, setSelectedDoctor] = React.useState<string | null>(null);

  // Сброс локального фильтра по врачу при смене даты или внешнего фильтра
  React.useEffect(() => {
    setSelectedDoctor(null);
  }, [titleDate, selectedDoctorName]);

  // Use either the internal selectedDoctor or the external selectedDoctorName
  const effectiveSelectedDoctor = selectedDoctorName || selectedDoctor;

  // Derived current day shifts (handles roll-over night shifts)
  const currentDayShifts = React.useMemo(() => {
    if (!shifts || !Array.isArray(shifts)) return [];

    const [dd, mm, yyyy] = titleDate.split(".");
    const currentDayStr = `${yyyy}-${mm}-${dd}`;
    const currentDay = dayjs(currentDayStr);

    return shifts.filter(shift => {
      // Direct match
      if (shift.shiftDate === currentDayStr) return true;

      // Check for night shift from previous day
      const prevDayStr = currentDay.subtract(1, 'day').format('YYYY-MM-DD');
      if (shift.shiftDate === prevDayStr) {
        const sStart = dayjs(`${shift.shiftDate}T${shift.startTime}`);
        let sEnd = dayjs(`${shift.shiftDate}T${shift.endTime}`);
        if (sEnd.isBefore(sStart)) sEnd = sEnd.add(1, 'day');
        // If shift ends after the start of current day, it overlaps
        return sEnd.isAfter(currentDay.startOf('day'));
      }
      return false;
    });
  }, [shifts, titleDate]);

  // Derive unique doctors from items by looking into services_json (performers),
  // MERGED with full list of doctors to get nicknames and accurate IDs
  const availableDoctors = React.useMemo(() => {
    const doctorMap = new Map<string, { id: string; name: string; photoUrl: string | null; nickname?: string }>();

    items.forEach((item) => {
      // Because we use keepPreviousData, items might temporarily contain yesterday's data while loading today's.
      // We must ignore items that don't match the current viewing date.
      if (item.appointment_at && dayjsBishkek(item.appointment_at).format("DD.MM.YYYY") !== titleDate) return;

      const services = item.parsed_services || [];

      const processService = (svc: any) => {
        const docId = svc.performer_id || svc.doctor_id;
        const docName = svc.performer_name || svc.doctor_name;

        if (docId && !doctorMap.has(docId)) {
          const fullInfo = doctors?.find(d => d.id === docId);
          doctorMap.set(docId, {
            id: docId,
            name: docName || fullInfo?.full_name || "Специалист",
            photoUrl: svc.performer_photo || svc.doctor_photo || fullInfo?.avatar_url || null,
            nickname: fullInfo?.nickname
          });
        } else if (!docId && docName && !Array.from(doctorMap.values()).some(d => d.name === docName)) {
          // Fallback for cases where only name exists
          const fullInfo = doctors?.find(d => d.full_name === docName);
          const id = fullInfo?.id || `name-${docName}`;
          doctorMap.set(id, {
            id: id,
            name: docName,
            photoUrl: fullInfo?.avatar_url || null,
            nickname: fullInfo?.nickname
          });
        }
      };

      if (Array.isArray(services) && services.length > 0) {
        services.forEach(processService);
      } else if (item.doctor_id || item.doctor_name) {
        // Fallback ONLY if services are empty
        processService({
          performer_id: item.doctor_id,
          performer_name: item.doctor_name,
          performer_photo: item.doctor_photo_url
        });
      }
    });

    // --- NEW: Add doctors from shifts who might not have appointments yet ---
    currentDayShifts.forEach(shift => {
      if (shift.employee?.id && !doctorMap.has(shift.employee?.id)) {
        const fullInfo = doctors?.find(d => d.id === shift.employee?.id);
        doctorMap.set(shift.employee?.id, {
          id: shift.employee?.id,
          name: fullInfo?.full_name || shift.employee?.fullName || "Специалист",
          photoUrl: fullInfo?.avatar_url || null,
          nickname: fullInfo?.nickname
        });
      }
    });

    const list = Array.from(doctorMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    if (restrictToDoctorId) {
      return list.filter(d => d.id === restrictToDoctorId);
    }
    return list;
  }, [items, doctors, currentDayShifts, restrictToDoctorId]);

  // Filter items based on selection (check if selected doctor is one of the performers)
  const filteredItems = React.useMemo(() => {
    if (!effectiveSelectedDoctor) return items;
    return items.filter((item) => {
      // Check main doctor
      if (item.doctor_name === effectiveSelectedDoctor) return true;

      // Check performers in services_json
      const services = item.parsed_services || [];

      if (Array.isArray(services)) {
        return services.some(svc =>
          (svc.performer_name === effectiveSelectedDoctor) ||
          (svc.doctor_name === effectiveSelectedDoctor)
        );
      }

      return false;
    });
  }, [items, effectiveSelectedDoctor]);

  // Mouse drag scroll functionality
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = () => {
    if (!scrollContainerRef.current) return;
    isDragging.current = false;
    scrollContainerRef.current.style.cursor = 'grab';
  };

  const handleMouseUp = () => {
    if (!scrollContainerRef.current) return;
    isDragging.current = false;
    scrollContainerRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const groupedItemsWithGaps = React.useMemo(() => {
    // 1. Group by doctor
    const rawGroups: Record<string, Appointment[]> = {};
    const doctorIdMap: Record<string, string> = {};

    // Get current display date in YYYY-MM-DD format
    const [dd, mm, yyyy] = titleDate.split(".");
    const currentDayStr = `${yyyy}-${mm}-${dd}`;

    // First, initialize groups for all doctors who HAVE SHIFTS on this day
    currentDayShifts.forEach(shift => {
      const fullInfo = doctors?.find(d => d.id === shift.employee?.id);
      if (fullInfo) {
        const docName = fullInfo.full_name || "Специалист";
        const docId = shift.employee?.id;

        if (restrictToDoctorId && docId !== restrictToDoctorId) return;
        if (effectiveSelectedDoctor && docName !== effectiveSelectedDoctor) return;

        if (!rawGroups[docName]) rawGroups[docName] = [];
        doctorIdMap[docName] = docId ?? "";
      }
    });

    // Then, add appointments to groups
    filteredItems.forEach((item) => {
      // Ignore items from keepPreviousData that don't match the selected titleDate
      // Skip filter if titleDate is not a real date (e.g. "Выбранный период")
      if (titleDate && /^\d{2}\.\d{2}\.\d{4}$/.test(titleDate) && item.appointment_at && dayjsBishkek(item.appointment_at).format("DD.MM.YYYY") !== titleDate) return;

      const services = item.parsed_services || [];

      const resolveDoctorName = (id?: string | null, name?: string | null): string | null => {
        if (name) return name;
        if (id && doctors) {
          const doc = doctors.find(d => String(d.id) === String(id));
          if (doc) return doc.full_name || (doc as any).name || null;
        }
        return null;
      };

      const performersMap = new Map<string, { name: string, id?: string }>();
      if (Array.isArray(services) && services.length > 0) {
        services.forEach(svc => {
          const id = svc.performer_id || svc.doctor_id;
          const name = resolveDoctorName(id, svc.performer_name || svc.doctor_name);
          if (name) {
            const key = id || name;
            if (!performersMap.has(key)) {
              performersMap.set(key, { name, id: id ?? undefined });
            }
            if (id) doctorIdMap[name] = id;
          }
        });
      } else if (item.doctor_name || item.doctor_id) {
        const nameFallback = resolveDoctorName(item.doctor_id, item.doctor_name);
        if (nameFallback) {
          if (nameFallback.includes(",")) {
            nameFallback.split(",").forEach(n => {
              const trimmedName = n.trim();
              if (trimmedName) performersMap.set(trimmedName, { name: trimmedName });
            });
          } else {
            const fallbackId = item.doctor_id;
            performersMap.set(fallbackId || nameFallback || "no-doctor", {
              name: nameFallback,
              id: fallbackId ?? undefined
            });
            if (fallbackId) doctorIdMap[nameFallback] = fallbackId;
          }
        }
      }

      // Если performersMap пустой — пробуем взять из parsed_services (с учетом id)
      if (performersMap.size === 0 && item.parsed_services?.length) {
        item.parsed_services.forEach(svc => {
          const id = svc.performer_id || null;
          const name = resolveDoctorName(id, svc.performer_name || null);
          if (name) {
            const key = id || name;
            if (!performersMap.has(key)) {
              performersMap.set(key, { name, id: id ?? undefined });
            }
            if (id) doctorIdMap[name] = id;
          }
        });
      }

      // Еще один фоллбэк: если есть performer_ids (API списка может возвращать только их)
      if (performersMap.size === 0 && item.performer_ids?.length) {
        item.performer_ids.forEach(id => {
          const name = resolveDoctorName(id, null);
          if (name) {
            const key = id || name;
            if (!performersMap.has(key)) {
              performersMap.set(key, { name, id });
            }
            doctorIdMap[name] = id;
          }
        });
      }

      if (performersMap.size === 0) {
        // Если есть doctor_id/performer_ids — используем их для фильтрации
        const fallbackId = item.doctor_id ?? item.performer_ids?.[0];
        if (restrictToDoctorId && fallbackId && fallbackId !== restrictToDoctorId) return;
        if (restrictToDoctorId && !fallbackId) return;
        const noDocName = "Без специалиста";
        if (effectiveSelectedDoctor && noDocName !== effectiveSelectedDoctor) return;
        if (!rawGroups[noDocName]) rawGroups[noDocName] = [];
        rawGroups[noDocName].push(item);
      } else {
        performersMap.forEach(perf => {
          const docName = perf.name;
          const docId = perf.id;

          if (restrictToDoctorId && docId !== restrictToDoctorId) return;
          if (effectiveSelectedDoctor && docName !== effectiveSelectedDoctor) return;

          if (!rawGroups[docName]) rawGroups[docName] = [];
          rawGroups[docName].push(item);
        });
      }
    });

    // 2. Process each group to inject gaps
    const sortedDocNames = Object.keys(rawGroups).sort((a, b) => a.localeCompare(b));
    const groups: Record<string, RenderItem[]> = {};

    sortedDocNames.forEach(docName => {
      const appts = [...rawGroups[docName]].sort((a, b) => dayjs(a.appointment_at).valueOf() - dayjs(b.appointment_at).valueOf());
      const result: RenderItem[] = [];

      const docId = doctorIdMap[docName] || appts[0]?.doctor_id;
      const docShifts = currentDayShifts.filter(s => s.employee?.id === docId);

      // Helper to check if a time is within ANY of doctor's shifts
      const getActiveShift = (date: dayjs.Dayjs) => {
        return docShifts.find(shift => {
          const d = shift.shiftDate;
          const sStart = dayjs(`${d}T${shift.startTime}`);
          let sEnd = dayjs(`${d}T${shift.endTime}`);
          if (sEnd.isBefore(sStart)) sEnd = sEnd.add(1, 'day');
          return (date.isAfter(sStart) || date.isSame(sStart)) && date.isBefore(sEnd);
        });
      };

      if (onAddSlot) {
        // CASE A: No appointments yet - show the start of the shift
        if (appts.length === 0) {
          const addedTimes = new Set<string>(); // Prevent duplicates
          docShifts.forEach(shift => {
            const d = shift.shiftDate;
            const startTime = dayjs(`${d}T${shift.startTime}`);
            const timeKey = startTime.format('HH:mm');

            if (!addedTimes.has(timeKey)) {
              addedTimes.add(timeKey);
              // Only add gap if it's not in the past
              if (!startTime.isBefore(dayjs())) {
                result.push({
                  isGap: true,
                  id: `empty-shift-${shift.id}`,
                  startTime: startTime.toDate(),
                  timeStr: timeKey,
                  doctorId: docId || ""
                });
              }
            }
          });
        }
        // CASE B: Has appointments - check BEFORE the first one and BETWEEN others
        else {
          const first = appts[0];
          const firstStart = dayjs(first.appointment_at);

          // Check if there is enough space BEFORE the first appointment
          const shiftForFirst = getActiveShift(firstStart.subtract(1, 'minute'));
          if (shiftForFirst) {
            const d = shiftForFirst.shiftDate;
            const sStart = dayjs(`${d}T${shiftForFirst.startTime}`);
            if (firstStart.diff(sStart) >= GAP_THRESHOLD_MS) {
              // Only add gap if it's not in the past
              if (!sStart.isBefore(dayjs())) {
                result.push({
                  isGap: true,
                  id: `gap-before-first-${first.id}`,
                  startTime: sStart.toDate(),
                  timeStr: sStart.format('HH:mm'),
                  doctorId: docId || ""
                });
              }
            }
          }

          const addedCancelledSlots = new Set<string>();
          for (let i = 0; i < appts.length; i++) {
            const current = appts[i];

            // --- NEW: If appointment is CANCELLED, treat it as a free slot ---
            // BUT ONLY IF there are no other active appointments at the exact same time
            if (current.status === "Отменено") {
              const start = dayjs(current.appointment_at);
              const timeKey = start.format('HH:mm');

              // Check if there is any NON-CANCELLED appointment starting at the same time
              const hasActiveAtSameTime = appts.some(a =>
                a.status !== "Отменено" &&
                dayjs(a.appointment_at).format('HH:mm') === timeKey
              );

              if (!hasActiveAtSameTime && !addedCancelledSlots.has(timeKey) && getActiveShift(start)) {
                // Only add gap if it's not in the past
                if (!start.isBefore(dayjs())) {
                  addedCancelledSlots.add(timeKey);
                  result.push({
                    isGap: true,
                    id: `slot-for-cancelled-${current.id}`,
                    startTime: start.toDate(),
                    timeStr: timeKey,
                    doctorId: docId || current.doctor_id || ""
                  });
                }
              }
            }

            result.push(current);

            const next = appts[i + 1];
            const currentStart = dayjs(current.appointment_at);
            const currentDurationMins = current.duration ?? DEFAULT_DURATION_MINS;
            const currentEnd = currentStart.add(currentDurationMins, 'minute');

            if (next) {
              const nextStart = dayjs(next.appointment_at);
              const diffMs = nextStart.diff(currentEnd);
              if (diffMs >= GAP_THRESHOLD_MS && getActiveShift(currentEnd)) {
                // Only add gap if it's not in the past
                if (!currentEnd.isBefore(dayjs())) {
                  result.push({
                    isGap: true,
                    id: `gap-${current.id}-${next.id}`,
                    startTime: currentEnd.toDate(),
                    timeStr: currentEnd.format('HH:mm'),
                    doctorId: docId || current.doctor_id || ""
                  });
                }
              }
            } else {
              // ALWAYS offer slot after the last one if shift continues
              if (getActiveShift(currentEnd)) {
                // Only add gap if it's not in the past
                if (!currentEnd.isBefore(dayjs())) {
                  result.push({
                    isGap: true,
                    id: `gap-after-last-${current.id}`,
                    startTime: currentEnd.toDate(),
                    timeStr: currentEnd.format('HH:mm'),
                    doctorId: docId || ""
                  });
                }
              }
            }
          }
        }
      } else {
        // Just add appointments if no slot adding is allowed
        appts.forEach(a => result.push(a));
      }

      if (result.length > 0) {
        groups[docName] = result;
      }
    });

    return groups;
  }, [filteredItems, onAddSlot, currentDayShifts, restrictToDoctorId, effectiveSelectedDoctor, doctors, titleDate]);

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        sx={{
          pb: 1.5,
          "& .MuiCardHeader-content": { minWidth: 0 },
          "& .MuiCardHeader-action": { alignSelf: "flex-start", mt: 0.5 }
        }}
        title={
          <Stack
            direction="column"
            gap={2}
            sx={{ width: '100%' }}
          >
            {/* Title fixed */}
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              Приемы ({titleDate})
            </Typography>

            {/* Stories Filter лента */}
            {!hideDoctorFilter && !restrictToDoctorId && (
              <Box
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                sx={{
                  display: "flex",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                  gap: "12px",
                  cursor: 'grab',
                  userSelect: 'none',
                  pb: 0.5,
                  px: 2,
                  mx: -2,
                }}
              >
                {availableDoctors.length > 0 && (
                  <Stack spacing={0.25} alignItems="center" onClick={() => setSelectedDoctor(null)} sx={{ cursor: "pointer", minWidth: 56 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: selectedDoctor === null ? `3px solid ${theme.palette.primary.main}` : `1.5px solid ${theme.palette.divider}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: selectedDoctor === null ? "primary.main" : "transparent",
                        color: selectedDoctor === null ? "primary.contrastText" : "text.secondary",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Все</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: selectedDoctor === null ? 700 : 500, fontSize: "0.75rem" }}>
                      Все
                    </Typography>
                  </Stack>
                )}
                {availableDoctors.map((doc) => (
                  <DoctorStoryItem
                    key={doc.id}
                    name={doc.name}
                    nickname={doc.nickname}
                    photoUrl={doc.photoUrl || undefined}
                    isActive={selectedDoctor === doc.name}
                    onClick={() => setSelectedDoctor(selectedDoctor === doc.name ? null : doc.name)}
                  />
                ))}
                {/* Spacer to prevent clipping on the right side when scrolling on mobile */}
                <Box sx={{ minWidth: 16, flexShrink: 0 }} />
              </Box>
            )}
          </Stack>
        }
        action={
          <IconButton onClick={onOpenFilters} aria-label="Фильтры" sx={{ display: "none" }}>
            <FilterListOutlined />
          </IconButton>
        }
      />
      <Divider />
      {loading && (
        <LinearProgress sx={{ height: 2, mt: "-2px" }} />
      )}
      <CardContent
        sx={{
          p: 0,
          "&:last-child": { pb: 0 },
          flex: 1,
          overflowY: "auto",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {errorMsg ? (
          <Typography sx={{ p: 2 }} variant="body2" color="error">Ошибка: {errorMsg}</Typography>
        ) : Object.keys(groupedItemsWithGaps).length === 0 ? (
          <Typography sx={{ p: 2, color: loading ? "text.disabled" : "text.primary" }} variant="body2">
            {loading ? "Загрузка…" : "Нет записей"}
          </Typography>
        ) : (
          <Stack spacing={0} sx={{ pb: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
            {Object.entries(groupedItemsWithGaps).map(([docName, groupItems]) => {
              const apptCount = groupItems.filter(i => !isGap(i)).length;
              return (
                <Box key={docName}>
                  {!restrictToDoctorId && (
                    <Box sx={{ px: 2, py: 1, bgcolor: "action.selected", borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="subtitle2" fontWeight="bold">{docName}</Typography>
                      <Chip label={`${apptCount} приемов`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'background.paper' }} />
                    </Box>
                  )}
                  <Box>
                    {groupItems.map((item) => {
                      if (isGap(item)) {
                        return (
                          <AddSlotButton
                            key={item.id}
                            timeStr={item.timeStr}
                            onClick={() => {
                              const iso = dayjs(item.startTime).format("YYYY-MM-DDTHH:mm");
                              onAddSlot?.(iso, item.doctorId);
                            }}
                          />
                        );
                      }
                      const a = item as Appointment;

                      // ── Групповой приём ──────────────────────────────────
                      if (a.is_group && a.group_data) {
                        const g = a.group_data;
                        const debt = g.participants.reduce((s, p) => s + p.debt, 0);
                        const paidCount = g.participants.filter((p) => p.debt === 0).length;
                        const allPaid = g.participants.length > 0 && debt === 0;
                        return (
                          <Box
                            key={a.id}
                            onClick={() => onItemClick?.(a.id)}
                            sx={{ px: 2, py: 1.25, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" }, "&:hover": { bgcolor: (t) => t.palette.action.hover }, borderLeft: "3px solid", borderLeftColor: "secondary.main" }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                              <Stack spacing={0.25}>
                                <Stack direction="row" alignItems="center" gap={0.75}>
                                  <GroupsOutlined sx={{ fontSize: 14, color: "secondary.main" }} />
                                  <Typography variant="subtitle2">{dayjs(a.appointment_at).format("HH:mm")}</Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" noWrap>{g.sellableItemName}</Typography>
                                <Typography variant="caption" color="text.disabled">
                                  {g.participants.map((p) => p.patientName).join(", ") || "Нет участников"}
                                </Typography>
                              </Stack>
                              <Stack alignItems="flex-end" spacing={0.25}>
                                <Chip
                                  label={`${paidCount}/${g.participants.length} уч.`}
                                  size="small"
                                  color={allPaid ? "success" : "warning"}
                                  sx={{ height: 20, fontSize: 11 }}
                                />
                                {debt > 0 && (
                                  <Typography variant="caption" color="error.main" fontWeight={600}>
                                    Долг: {debt.toLocaleString()} с
                                  </Typography>
                                )}
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      }

                      // ── Обычный приём ─────────────────────────────────────
                      const cash = Number(a.paid_cash || 0);
                      const card = Number(a.paid_card || 0);
                      const balance = Number(a.paid_balance || 0);
                      const bonuses = Number(a.paid_bonuses || 0);
                      const statusConfig = getStatusConfig(a.status);
                      const hasPaymentBreakdown = cash > 0 || card > 0 || balance > 0 || bonuses > 0;
                      // Скидка: process discount and compute percent for badge
                      const baseAmount = Number(a.total_amount || a.total_cost || a.estimated_total || 0);
                      const discountAbs = Number(a.discount || 0);
                      const discountPct = baseAmount > 0 && discountAbs > 0
                          ? Math.round((discountAbs / baseAmount) * 100)
                          : 0;
                      // Цвет чипа «Оплачено»: безнал (карта+баланс+бонусы) >= нал → синий, иначе зелёный
                      const isPaid = a.status?.trim().toLowerCase() === "оплачено" || a.status?.trim().toLowerCase() === "paid";
                      const nonCash = card + balance + bonuses;
                      const paidChipSx: SxProps<Theme> = isPaid && nonCash >= cash && (cash > 0 || nonCash > 0)
                        ? (theme: Theme) => ({
                            backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.2 : 0.12),
                            color: theme.palette.mode === "dark" ? theme.palette.info.light : theme.palette.info.dark,
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            height: "22px",
                            "& .MuiChip-icon": { color: theme.palette.mode === "dark" ? theme.palette.info.light : theme.palette.info.dark },
                            "&:hover": { opacity: 0.9 },
                          })
                        : getStatusChipSx(a.status);
                      return (
                        <Box
                          key={a.id}
                          onClick={() => onItemClick?.(a.id)}
                          sx={{ px: 2, py: 1.25, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" }, "&:hover": { bgcolor: (t) => t.palette.action.hover } }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                            <Stack>
                              <Stack direction="row" alignItems="center" gap={0.5}>
                                <Typography variant="subtitle2">{dayjs(a.appointment_at).format("HH:mm")}</Typography>
                              </Stack>
                              <Typography variant="body2" color="text.secondary">Клиент: {a.patient_name}</Typography>
                            </Stack>
                            <Stack alignItems="flex-end">
                              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" justifyContent="flex-end">
                                <Chip
                                  label={statusConfig.label}
                                  icon={statusConfig.icon}
                                  size="small"
                                  sx={paidChipSx}
                                />
                                {discountPct > 0 && (
                                  <Chip
                                    label={`Со скидкой ${discountPct}%`}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ height: 22, fontSize: "0.7rem", fontWeight: 500 }}
                                  />
                                )}
                                {hasPaymentBreakdown && (
                                  <Stack direction="row" alignItems="center" gap={0.25} color="text.secondary">
                                    {cash > 0 && <PaymentsOutlined sx={{ fontSize: 16 }} />}
                                    {card > 0 && <CreditCardOutlined sx={{ fontSize: 16 }} />}
                                    {balance > 0 && <AccountBalanceWalletOutlined sx={{ fontSize: 16 }} />}
                                    {bonuses > 0 && <CardGiftcardOutlined sx={{ fontSize: 16 }} />}
                                  </Stack>
                                )}
                                {(a.has_conclusion || a.conclusion || (a.diagnosis_data && a.diagnosis_data.length > 0)) && (
                                  <Tooltip title="Есть заключение"><PrintOutlinedIcon sx={{ fontSize: 20, color: "action.active", opacity: 0.8 }} /></Tooltip>
                                )}
                              </Stack>
                              {(a.total_amount != null || a.total_cost != null || a.estimated_total != null) && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  Итого: {formatKGS(Number(a.total_amount || a.total_cost || a.estimated_total || 0) - discountAbs)}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
            <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
              <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap", fontSize: "0.7rem" }}>
                Конец списка
              </Typography>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
});

export default AppointmentsList;
