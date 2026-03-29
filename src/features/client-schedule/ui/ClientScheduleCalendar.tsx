import React, { useMemo, useState, useEffect } from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { ChevronLeft, ChevronRight, Close, Delete, Edit } from "@mui/icons-material";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isBetween from "dayjs/plugin/isBetween";
import "dayjs/locale/ru";
import { clientScheduleApi } from "../api/client-schedule.api";
import { Client, ClientShift } from "../model/types";
import ClientShiftForm from "./ClientShiftForm";
import PatientQuickViewDrawer from "../../../components/patients/PatientQuickViewDrawer";

dayjs.extend(isoWeek);
dayjs.extend(isBetween);
dayjs.locale("ru");

// ── Утилиты ──────────────────────────────────────────────────────────────────

const stringToColor = (s: string) => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  let color = "#";
  for (let i = 0; i < 3; i++) color += ("00" + ((hash >> (i * 8)) & 0xff).toString(16)).slice(-2);
  return color;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const parseTimeToMinutes = (t?: string): number | null => {
  if (!t) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(t);
  if (!m) return null;
  return clamp(parseInt(m[1]) * 60 + parseInt(m[2]), 0, 1439);
};

const minutesToTime = (min: number) => {
  const m = clamp(Math.round(min), 0, 1439);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const minutesToTopPercent = (min: number) => 100 - (clamp(min, 0, 1439) / 1440) * 100;

const generateWeeksGrid = (monthDate: dayjs.Dayjs): dayjs.Dayjs[][] => {
  const start = monthDate.startOf("month").startOf("isoWeek");
  const weeks: dayjs.Dayjs[][] = [];
  let cur = start;
  while (weeks.length < 6) {
    const week: dayjs.Dayjs[] = [];
    for (let i = 0; i < 7; i++) { week.push(cur); cur = cur.add(1, "day"); }
    weeks.push(week);
  }
  return weeks;
};

// ── Типы сегментов ────────────────────────────────────────────────────────────

interface Segment {
  shiftId: string;
  startMin: number;
  endMin: number;
  clientName: string;
  clientPhoto?: string;
  clientId: string;
  shift: ClientShift;
}

interface PositionedSegment extends Segment {
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
  columnIndex: number;
  columnCount: number;
}

const getSegmentsForDay = (shift: ClientShift, day: dayjs.Dayjs): Segment[] => {
  if (!day.isSame(shift.date, "day")) return [];
  const sMin = parseTimeToMinutes(shift.startTime) ?? 0;
  const eMin = parseTimeToMinutes(shift.endTime) ?? 1439;
  return [{
    shiftId: shift.id,
    startMin: sMin,
    endMin: eMin,
    clientName: shift.client?.fullName ?? "Клиент",
    clientPhoto: shift.client?.photoUrl,
    clientId: shift.clientId,
    shift,
  }];
};

const layoutSegments = (segments: Segment[]): PositionedSegment[] => {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const positioned: PositionedSegment[] = [];
  const overlaps = (a: Segment, b: Segment) => a.startMin < b.endMin && b.startMin < a.endMin;

  for (const seg of sorted) {
    const overlapping = positioned.filter(p => overlaps(seg, p));
    const occupied = new Set(overlapping.map(p => p.columnIndex));
    let columnIndex = 0;
    while (occupied.has(columnIndex)) columnIndex++;
    const columnCount = overlapping.length > 0
      ? Math.max(columnIndex + 1, ...overlapping.map(p => p.columnCount))
      : 1;

    const topPct = minutesToTopPercent(seg.endMin);
    const bottomPct = minutesToTopPercent(seg.startMin);
    const heightPct = Math.max(bottomPct - topPct, 0);
    const widthPct = 100 / columnCount;
    const leftPct = columnIndex * widthPct;

    positioned.push({ ...seg, topPct, heightPct, leftPct, widthPct, columnIndex, columnCount });

    for (const ov of overlapping) {
      const idx = positioned.indexOf(ov);
      if (idx !== -1 && positioned[idx].columnCount < columnCount) {
        const w = 100 / columnCount;
        positioned[idx] = { ...positioned[idx], columnCount, widthPct: w, leftPct: positioned[idx].columnIndex * w };
      }
    }
  }
  return positioned;
};

// ── Блок смены ────────────────────────────────────────────────────────────────

const ShiftBlock: React.FC<{ segment: PositionedSegment; onEdit: (s: ClientShift) => void }> = ({ segment, onEdit }) => {
  const color = stringToColor(segment.clientId);
  const sx: SxProps<Theme> = {
    position: "absolute",
    top: `${segment.topPct}%`,
    height: `${segment.heightPct}%`,
    left: `${segment.leftPct}%`,
    width: `${segment.widthPct}%`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 0.25,
    px: 0.5,
    py: 0.25,
    borderRadius: 1,
    overflow: "hidden",
    minHeight: 32,
    bgcolor: alpha(color, 0.75),
    color: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    border: `1px solid ${alpha(color, 1)}`,
    cursor: "pointer",
    zIndex: 1,
    "&:hover": { zIndex: 100, bgcolor: color, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" },
  };

  return (
    <Tooltip
      arrow
      placement="top"
      title={
        <Box>
          <Typography variant="subtitle2">{segment.clientName}</Typography>
          <Typography variant="body2">{minutesToTime(segment.startMin)} - {minutesToTime(segment.endMin)}</Typography>
        </Box>
      }
    >
      <Box sx={sx} onClick={(e) => { e.stopPropagation(); onEdit(segment.shift); }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Avatar src={segment.clientPhoto} sx={{ width: 16, height: 16, fontSize: "0.6rem", border: "1px solid rgba(255,255,255,0.5)" }}>
            {segment.clientName?.[0] ?? "?"}
          </Avatar>
          <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
            {segment.clientName}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ fontSize: "0.7rem", opacity: 0.9 }}>
          {minutesToTime(segment.startMin)} - {minutesToTime(segment.endMin)}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ── Основной компонент ────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const ClientScheduleCalendar = React.forwardRef((_, ref) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [shifts, setShifts] = useState<ClientShift[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "form">("view");
  const [editingShift, setEditingShift] = useState<ClientShift | null>(null);
  const [patientDrawerId, setPatientDrawerId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const today = dayjs();
  const weeks = useMemo(() => generateWeeksGrid(currentMonth), [currentMonth]);
  const monthTitle = useMemo(() => {
    const s = currentMonth.format("MMMM YYYY");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [currentMonth]);

  const fetchData = async () => {
    const [loadedClients, loadedShifts] = await Promise.all([
      clientScheduleApi.fetchClients(),
      clientScheduleApi.fetchShifts(
        currentMonth.startOf("month").format("YYYY-MM-DD"),
        currentMonth.endOf("month").format("YYYY-MM-DD")
      ),
    ]);
    setClients(loadedClients);
    setShifts(loadedShifts);
  };

  useEffect(() => { fetchData(); }, [currentMonth]);

  React.useImperativeHandle(ref, () => ({
    openAddShift: () => {
      setSelectedDate(dayjs());
      setEditingShift(null);
      setDrawerMode("form");
      setIsDrawerOpen(true);
    },
  }));

  const handleDayClick = (day: dayjs.Dayjs) => {
    setSelectedDate(day);
    setDrawerMode("view");
    setIsDrawerOpen(true);
  };

  const handleEditClick = (shift: ClientShift) => {
    setEditingShift(shift);
    setDrawerMode("form");
    setIsDrawerOpen(true);
  };

  const handleClose = () => {
    setIsDrawerOpen(false);
    setEditingShift(null);
  };

  const handleFormSuccess = async (data: any) => {
    const items: Array<Omit<ClientShift, "id" | "client">> = Array.isArray(data) ? data : [data];

    if (items.length > 1) {
      // Несколько дат — bulk создание
      await clientScheduleApi.createShiftsBulk(items);
    } else {
      await clientScheduleApi.createShift(items[0]);
    }

    fetchData();
    setIsDrawerOpen(false);
  };

  const handleDelete = async (id: string) => {
    await clientScheduleApi.deleteShift(id);
    fetchData();
    setIsDrawerOpen(false);
  };

  const dayShifts = useMemo(
    () => shifts.filter(s => s.date === selectedDate?.format("YYYY-MM-DD")),
    [shifts, selectedDate]
  );

  return (
    <Paper elevation={3} sx={{ p: 2, mt: 2 }}>
      {/* Шапка */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', py: 1, mx: -2, px: 2 }}>
        <IconButton size="small" onClick={() => setCurrentMonth(m => m.subtract(1, "month"))}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 160, textAlign: "center", fontWeight: 600 }}>
          {monthTitle}
        </Typography>
        <IconButton size="small" onClick={() => setCurrentMonth(m => m.add(1, "month"))}>
          <ChevronRight />
        </IconButton>
      </Stack>

      {/* Таблица-календарь */}
      {/* Строка дней недели — sticky, вне таблицы */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        minWidth: 900,
        position: "sticky",
        top: 56,
        zIndex: 9,
        bgcolor: "background.neutral",
        overflowX: "hidden",
      }}>
        {DAYS_OF_WEEK.map(d => (
          <Box key={d} sx={{ textAlign: "center", fontWeight: "bold", fontSize: "0.85rem", py: 1 }}>
            {d}
          </Box>
        ))}
      </Box>

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table sx={{ tableLayout: "fixed", minWidth: 900 }}>
          <TableHead sx={{ display: "none" }}>
            <TableRow>
              {DAYS_OF_WEEK.map(d => (
                <TableCell key={d} />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {weeks.map((week, i) => (
              <TableRow key={i}>
                {week.map(day => {
                  const daySegments = shifts.flatMap(s => getSegmentsForDay(s, day));
                  const positioned = layoutSegments(daySegments);
                  const isToday = day.isSame(today, "day");
                  const isCurrentMonth = day.isSame(currentMonth, "month");
                  const maxConcurrent = positioned.length > 0 ? Math.max(...positioned.map(p => p.columnCount)) : 1;
                  const cellHeight = Math.min(180 + Math.max(0, maxConcurrent - 1) * 60, 600);

                  return (
                    <TableCell
                      key={day.format("YYYY-MM-DD")}
                      onClick={() => handleDayClick(day)}
                      sx={{
                        position: "relative",
                        height: cellHeight,
                        verticalAlign: "top",
                        border: "1px solid",
                        borderColor: isToday ? "primary.main" : "divider",
                        cursor: "pointer",
                        bgcolor: isToday
                          ? (theme) => alpha(theme.palette.primary.main, 0.04)
                          : isCurrentMonth ? "background.paper" : "action.hover",
                        opacity: isCurrentMonth ? 1 : 0.6,
                        "&:hover": { bgcolor: "action.selected" },
                        p: 0,
                      }}
                    >
                      {/* Номер дня */}
                      <Typography
                        variant="caption"
                        fontWeight="bold"
                        sx={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          zIndex: 3,
                          fontSize: "0.9rem",
                          color: isToday ? "primary.main" : "text.secondary",
                          bgcolor: isToday ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
                          px: 0.8,
                          borderRadius: 1,
                        }}
                      >
                        {day.format("D")}
                      </Typography>

                      {/* Блоки смен */}
                      <Box sx={{ position: "absolute", inset: 0, top: 24, bottom: 4, px: 0.5 }}>
                        <Box sx={{ position: "absolute", inset: 0 }}>
                          {positioned.map(seg => (
                            <ShiftBlock
                              key={`${seg.shiftId}_${seg.startMin}`}
                              segment={seg}
                              onEdit={handleEditClick}
                            />
                          ))}
                        </Box>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={handleClose}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 420 }, maxWidth: "100vw" } }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
          {drawerMode === "view" ? (
            <Stack sx={{ p: 3, height: "100%", overflowY: "auto" }} justifyContent="space-between">
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Typography variant="h6">
                    {selectedDate?.format("D MMMM")}
                  </Typography>
                  <IconButton onClick={handleClose}><Close /></IconButton>
                </Stack>

                {dayShifts.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
                    Нет записей на этот день
                  </Typography>
                ) : (
                  dayShifts.map(shift => (
                    <Paper key={shift.id} variant="outlined" sx={{ p: 2, mb: 1, display: "flex", gap: 2, alignItems: "center" }}>
                      <Avatar
                        src={shift.client?.photoUrl}
                        sx={{ cursor: "pointer" }}
                        onClick={() => setPatientDrawerId(shift.clientId)}
                      >
                        {shift.client?.fullName?.[0] ?? "К"}
                      </Avatar>
                      <Box
                        sx={{ flex: 1, cursor: "pointer" }}
                        onClick={() => setPatientDrawerId(shift.clientId)}
                      >
                        <Typography variant="subtitle2">
                          {shift.client?.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {shift.startTime} - {shift.endTime}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => handleEditClick(shift)}><Edit /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(shift.id)}><Delete /></IconButton>
                    </Paper>
                  ))
                )}
              </Box>

              <Button
                size="large"
                variant="contained"
                onClick={() => { setEditingShift(null); setDrawerMode("form"); }}
                sx={{ mt: 2 }}
              >
                Записать клиента
              </Button>
            </Stack>
          ) : (
            <ClientShiftForm
              initialDate={selectedDate}
              shiftToEdit={editingShift}
              allClients={clients}
              onSuccess={handleFormSuccess}
              onCancel={() => setDrawerMode("view")}
              onDelete={editingShift ? handleDelete : undefined}
            />
          )}
        </Box>
      </Drawer>
      <PatientQuickViewDrawer
        open={!!patientDrawerId}
        onClose={() => setPatientDrawerId(null)}
        patientId={patientDrawerId}
      />

      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Удалить клиента из расписания?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Запись клиента будет удалена из расписания. Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteConfirmId) handleDelete(deleteConfirmId);
              setDeleteConfirmId(null);
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
});

export default ClientScheduleCalendar;
