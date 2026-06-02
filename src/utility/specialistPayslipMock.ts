import dayjs from "dayjs";
import "dayjs/locale/ru";
import type {
  SpecialistPayslipResponse,
  SpecialistPayslipDay,
  SpecialistPayslipSlot,
  LessonType,
  PeriodHalf,
} from "../types/reports";

const PATIENTS = [
  "Ибрагим", "Сейид", "Алтынай", "Камил", "Алим", "Айбике",
  "Мухаммад", "Ким", "Кенжа", "Ахмад", "Аширхан", "Усмар",
  "Абдурахман", "Аделя", "Тимур", "Дамир", "Назгуль",
];

const LESSON_TYPES: LessonType[] = ["individual", "individual", "individual", "pair"];

const PRICES = [800, 1000, 1200, 1500];
const SHARE = 0.5;

const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];

const seededRand = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const HOURS_FROM = 8;
const HOURS_TO = 18;

const money = (n: number): string => n.toFixed(2);

const buildDay = (date: dayjs.Dayjs, daySeed: number): SpecialistPayslipDay => {
  const slots: SpecialistPayslipSlot[] = [];
  const isWeekend = date.isoWeekday() >= 6;

  for (let h = HOURS_FROM; h <= HOURS_TO; h++) {
    const slotSeed = daySeed * 100 + h;
    const r = seededRand(slotSeed);
    const filled = !isWeekend && r > 0.45 && h !== 13;
    if (!filled) {
      slots.push({
        time: `${String(h).padStart(2, "0")}:00`,
        patientName: null,
        lessonType: null,
        sum: "0.00",
        earned: "0.00",
      });
      continue;
    }
    const price = pick(PRICES, Math.floor(seededRand(slotSeed + 1) * 1000));
    const lessonType = pick(LESSON_TYPES, Math.floor(seededRand(slotSeed + 2) * 1000));
    slots.push({
      time: `${String(h).padStart(2, "0")}:00`,
      patientName: pick(PATIENTS, Math.floor(seededRand(slotSeed + 3) * 1000)),
      lessonType,
      sum: money(price),
      earned: money(Math.round(price * SHARE)),
    });
  }

  const filled = slots.filter((s) => s.patientName);
  const count = filled.length;
  const sumTotal = filled.reduce((a, s) => a + parseFloat(s.sum), 0);
  const sumEarned = filled.reduce((a, s) => a + parseFloat(s.earned), 0);

  return {
    date: date.format("YYYY-MM-DD"),
    weekdayLabel: date.locale("ru").format("dddd"),
    slots,
    totals: { count, sumTotal: money(sumTotal), sumEarned: money(sumEarned) },
  };
};

const halfRange = (monthStart: dayjs.Dayjs, periodHalf: PeriodHalf | undefined) => {
  if (periodHalf === "first") {
    return { from: monthStart.date(1), to: monthStart.date(15) };
  }
  if (periodHalf === "second") {
    return { from: monthStart.date(16), to: monthStart.endOf("month").startOf("day") };
  }
  return { from: monthStart.date(1), to: monthStart.endOf("month").startOf("day") };
};

const formatLabel = (from: dayjs.Dayjs, to: dayjs.Dayjs): string => {
  const sameYear = from.year() === to.year();
  return `с ${sameYear ? from.format("DD.MM") : from.format("DD.MM.YYYY")} - ${to.format("DD.MM.YYYY")}`;
};

export const buildMockPayslip = (
  employee: { id: string; fullName: string; roleName: string },
  month: string,                     // YYYY-MM
  periodHalf?: PeriodHalf,
): SpecialistPayslipResponse => {
  const monthStart = dayjs(`${month}-01`).startOf("month");
  const monthEnd = monthStart.endOf("month").startOf("day");

  // Детализация (days/slots) — за полумесяц или весь месяц
  const detailRange = halfRange(monthStart, periodHalf);
  const days: SpecialistPayslipDay[] = [];
  let cur = detailRange.from;
  while (cur.isBefore(detailRange.to) || cur.isSame(detailRange.to, "day")) {
    days.push(buildDay(cur, cur.date() * 31 + cur.month() * 1000 + cur.year()));
    cur = cur.add(1, "day");
  }

  // Summary ВСЕГДА за полный месяц — пересоберём по всем дням месяца
  let monthGross = 0;
  let monthCount = 0;
  let m = monthStart;
  while (m.isBefore(monthEnd) || m.isSame(monthEnd, "day")) {
    const md = buildDay(m, m.date() * 31 + m.month() * 1000 + m.year());
    monthGross += parseFloat(md.totals.sumEarned);
    monthCount += md.totals.count;
    m = m.add(1, "day");
  }

  const advancesSum = Math.round(monthGross * 0.2);
  const deductionsSum = Math.round(monthGross * 0.05);
  const netSalary = Math.max(0, monthGross - advancesSum - deductionsSum);

  return {
    employee,
    period: {
      month,
      dateFrom: detailRange.from.format("YYYY-MM-DD"),
      dateTo: detailRange.to.format("YYYY-MM-DD"),
      label: formatLabel(detailRange.from, detailRange.to),
      summaryScope: "month",
      detailScope: periodHalf ?? "month",
    },
    summary: {
      grossEarnings: money(monthGross),
      netSalary: money(netSalary),
      percentSum: money(monthGross),
      fixedSum: "0.00",
      advancesSum: money(advancesSum),
      payoutsSum: "0.00",
      deductionsSum: money(deductionsSum),
      expensesSum: "0.00",
      dayHours: "120.00",
      paidAppointmentsCount: monthCount,
    },
    days,
  };
};
