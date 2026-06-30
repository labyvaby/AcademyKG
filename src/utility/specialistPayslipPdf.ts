import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { SpecialistPayslipResponse, SpecialistPayslipDay } from "../types/reports";
import type {
  PayslipAdjustmentsResult,
  DayAdjustments,
  PayslipAdjustment,
} from "../services/payslipAdjustments";

const PAGE_CELLS = 6;         // сетка 2×3 = 6 ячеек на страницу

const escapeHtml = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const toNum = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

const fmtNum = (value: string | number | null | undefined): string => {
  const num = toNum(value);
  if (num === 0) return "0";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(num);
};

const capitalize = (s: string | null | undefined): string => {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Строки авансов/удержаний под таблицей дня. Аванс — синим, удержание —
// красным (уменьшает выплату). Примечание = comment транзакции.
const renderAdjustmentLines = (adj: DayAdjustments | undefined): string => {
  if (!adj) return "";
  const line = (a: PayslipAdjustment, label: string, cls: string): string => {
    const note = a.note ? ` — ${escapeHtml(a.note)}` : "";
    return `<div class="adj ${cls}"><span class="adj-label">${label}: ${fmtNum(a.amount)}</span><span class="adj-note">${note}</span></div>`;
  };
  const advs = adj.advances.map((a) => line(a, "Аванс", "adv")).join("");
  const deds = adj.deductions.map((a) => line(a, "Удержание", "ded")).join("");
  if (!advs && !deds) return "";
  return `<div class="adj-block">${advs}${deds}</div>`;
};

const renderDayCard = (
  day: SpecialistPayslipDay,
  specialistName: string,
  adj?: DayAdjustments,
): string => {
  // Нерабочий день / день без приёмов: количество за день = 0 → таблицу
  // обводим красным (заказчик: и нерабочий день, и нулевой итог = красная рамка).
  const isDayOff = toNum(day.totals.count) === 0;
  const rowsHtml = day.slots
    .map((slot) => {
      const isEmpty = !slot.patientName;
      const individCell = slot.lessonType === "individual" ? escapeHtml(slot.patientName ?? "") : "";
      const pairCell    = slot.lessonType === "pair"       ? escapeHtml(slot.patientName ?? "") : "";
      return `
        <tr>
          <td class="c time">${escapeHtml(slot.time)}</td>
          <td class="l">${individCell}</td>
          <td class="l">${pairCell}</td>
          <td class="r">${isEmpty ? "0" : fmtNum(slot.sum)}</td>
          <td class="r">${isEmpty ? "0" : fmtNum(slot.earned)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="day-card${isDayOff ? " day-off" : ""}">
      <div class="day-head">
        <div class="day-spec">Специалист: <b>${escapeHtml(specialistName)}</b></div>
        <div class="day-date">${escapeHtml(day.date.split("-").reverse().join("."))}</div>
        <div class="day-weekday">${escapeHtml(capitalize(day.weekdayLabel))}</div>
      </div>
      <table class="slots">
        <thead>
          <tr>
            <th class="c w-time">Вр.<br/>зан.</th>
            <th class="l">Имя<br/>(индивид.)</th>
            <th class="l">Имя<br/>(парное)</th>
            <th class="r w-paid">Поступи<br/>ла</th>
            <th class="r w-sum">сумма</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="totals">
            <td class="c"><b>Итог:</b></td>
            <td class="c" colspan="2"><b>${fmtNum(day.totals.count)}</b></td>
            <td class="r"><b>${fmtNum(day.totals.sumTotal)}</b></td>
            <td class="r"><b>${fmtNum(day.totals.sumEarned)}</b></td>
          </tr>
        </tbody>
      </table>
      ${renderAdjustmentLines(adj)}
    </div>
  `;
};

// Локальные итоги по таблице за выводимый период (только полумесяц).
// Это НЕ зарплата к выплате — здесь нет оклада/авансов/удержаний/соцфонда.
const renderHalfPeriodTotalsCell = (
  data: SpecialistPayslipResponse,
  adjustments?: PayslipAdjustmentsResult,
): string => {
  const { days, period } = data;
  let count = 0;
  let totalSum = 0;
  let totalEarned = 0;
  days.forEach((d) => {
    count += d.totals.count;
    totalSum += toNum(d.totals.sumTotal);
    totalEarned += toNum(d.totals.sumEarned);
  });

  const advTotal = adjustments?.advancesTotal ?? 0;
  const dedTotal = adjustments?.deductionsTotal ?? 0;
  const hasAdj = advTotal > 0 || dedTotal > 0;
  const adjRows = hasAdj
    ? `<tr><td class="l">Авансы за период</td><td class="r">${fmtNum(advTotal)}</td></tr>
       <tr><td class="l">Удержания за период</td><td class="r">${fmtNum(dedTotal)}</td></tr>`
    : "";
  const scope = hasAdj
    ? "Детализация по занятиям + авансы и удержания за период. Без оклада и соц.фонда."
    : "Только детализация по занятиям. Без оклада, авансов и удержаний.";

  return `
    <div class="day-card summary-card">
      <table class="sum-table">
        <tbody>
          <tr><td class="l">Занятий за период</td><td class="r">${fmtNum(count)}</td></tr>
          <tr><td class="l">Поступило за период</td><td class="r">${fmtNum(totalSum)}</td></tr>
          <tr><td class="l">Начислено по занятиям за период</td><td class="r">${fmtNum(totalEarned)}</td></tr>
          ${adjRows}
        </tbody>
      </table>
      <div class="sum-scope">${scope}</div>
      <div class="sum-period">${escapeHtml(period.label)}</div>
    </div>
  `;
};

// Полный месячный summary — рисуем только если PDF явно за календарный месяц.
const renderMonthSummaryCell = (data: SpecialistPayslipResponse): string => {
  const { summary, period } = data;
  return `
    <div class="day-card summary-card">
      <table class="sum-table">
        <tbody>
          <tr><td class="l">Кол-во занятий</td><td class="r">${fmtNum(summary.paidAppointmentsCount)}</td></tr>
          <tr><td class="l">Начислено</td><td class="r">${fmtNum(summary.grossEarnings)}</td></tr>
          <tr><td class="l">Аванс</td><td class="r">${fmtNum(summary.advancesSum)}</td></tr>
          <tr><td class="l">Удержания</td><td class="r">${fmtNum(summary.deductionsSum)}</td></tr>
          <tr><td class="l">К выплате</td><td class="r">${fmtNum(summary.netSalary)}</td></tr>
        </tbody>
      </table>
      <div class="sum-period">${escapeHtml(period.label)}</div>
    </div>
  `;
};

const renderSummaryCell = (
  data: SpecialistPayslipResponse,
  adjustments?: PayslipAdjustmentsResult,
): string => {
  // Месячная сводка берёт авансы/удержания из backend `summary` (он
  // авторитетен по месяцу); полумесяц — из подмешанных per-day данных.
  return data.period.detailScope === "month"
    ? renderMonthSummaryCell(data)
    : renderHalfPeriodTotalsCell(data, adjustments);
};

const renderEmptyCell = (): string => `<div class="day-card empty-card"></div>`;

const STYLES = `
  .payslip {
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 4mm;
    font-family: Arial, sans-serif;
    font-size: 7pt;
    color: #0a2240;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  .payslip .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: 1fr;
    gap: 1.5mm;
    flex: 1;
    min-height: 0;
  }
  .payslip .day-card {
    border: 1px solid #0a2240;
    padding: 0.8mm 1mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .payslip .empty-card { border: none; }
  /* Нерабочий день / нулевой итог — красная обводка таблицы. */
  .payslip .day-card.day-off { border: 1.5px solid #d32f2f; }
  .payslip .day-card.day-off table.slots,
  .payslip .day-card.day-off table.slots th,
  .payslip .day-card.day-off table.slots td { border-color: #d32f2f; }
  .payslip .day-card.day-off .day-head { border-bottom-color: #d32f2f; }
  .payslip .day-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 6.5pt;
    border-bottom: 1px solid #0a2240;
    padding-bottom: 0.5mm;
    margin-bottom: 0.5mm;
    gap: 1mm;
  }
  .payslip .day-spec { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .payslip .day-date { font-weight: 700; white-space: nowrap; }
  .payslip .day-weekday { font-weight: 700; white-space: nowrap; }
  .payslip table.slots {
    width: 100%;
    border-collapse: collapse;
    font-size: 6.5pt;
    table-layout: fixed;
    flex: 1;
  }
  .payslip table.slots th,
  .payslip table.slots td {
    border: 1px solid #0a2240;
    padding: 0.2mm 0.6mm;
    line-height: 1.05;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .payslip table.slots th {
    font-weight: 700;
    background: #eef2fb;
    font-size: 6pt;
    padding: 0.4mm 0.6mm;
  }
  .payslip table.slots .w-time { width: 8mm; }
  .payslip table.slots .w-paid { width: 12mm; }
  .payslip table.slots .w-sum  { width: 12mm; }
  .payslip table.slots .l { text-align: left; }
  .payslip table.slots .c { text-align: center; }
  .payslip table.slots .r { text-align: right; }
  .payslip table.slots td.time { font-weight: 600; }
  /* Строки занятий равномерно растягиваются на всю высоту карточки:
     table flex:1 распределяет свободное место между tr тела.
     Строка «Итог» — чуть выше и крупнее остальных. */
  .payslip table.slots tr.totals td {
    background: #eef2fb;
    font-weight: 700;
    height: 6mm;
    font-size: 7pt;
    padding: 0.6mm 0.6mm;
  }

  /* Авансы / удержания под таблицей дня */
  .payslip .adj-block { margin-top: 0.6mm; }
  .payslip .adj {
    display: flex;
    gap: 0.5mm;
    font-size: 6pt;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .payslip .adj-label { font-weight: 700; flex: none; }
  .payslip .adj-note { overflow: hidden; text-overflow: ellipsis; }
  .payslip .adj.adv { color: #0a47a9; }
  .payslip .adj.ded { color: #d32f2f; }

  .payslip .summary-card { justify-content: center; padding: 4mm 6mm; }
  .payslip .sum-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 4mm;
  }
  .payslip .sum-table td {
    border: 1px solid #0a2240;
    padding: 1.5mm 2mm;
  }
  .payslip .sum-table td.l { font-weight: 600; }
  .payslip .sum-table td.r { text-align: right; font-weight: 700; }
  .payslip .sum-scope {
    text-align: center;
    font-size: 7pt;
    color: #56627a;
    margin-bottom: 2mm;
  }
  .payslip .sum-period {
    text-align: center;
    font-weight: 700;
    font-size: 10pt;
  }
`;

interface PageBuild {
  html: string;
}

const isWeekend = (iso: string): boolean => {
  const [y, m, day] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0=Вс, 6=Сб
  return dow === 0 || dow === 6;
};

// Дни идут подряд (хронологически), без привязки к колонкам недели —
// чтобы не было «пропусков» вроде страницы с одной пятничной таблицей.
// Показываем только будни (Пн–Пт), даже с 0 приёмов. Сб/Вс не показываем вообще.
// Общий итог (summary) — первой ячейкой первой страницы.
const buildPages = (
  data: SpecialistPayslipResponse,
  adjustments?: PayslipAdjustmentsResult,
): PageBuild[] => {
  const { days, employee } = data;
  const summaryHtml = renderSummaryCell(data, adjustments);

  const visibleDays: SpecialistPayslipDay[] = [...days]
    .filter((d) => !isWeekend(d.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const cells: string[] = [
    summaryHtml,
    ...visibleDays.map((d) =>
      renderDayCard(d, employee.fullName, adjustments?.byDate.get(d.date)),
    ),
  ];

  // добиваем до кратности PAGE_CELLS пустыми ячейками, чтобы сетка не «съезжала»
  while (cells.length % PAGE_CELLS !== 0) cells.push(renderEmptyCell());

  const pages: PageBuild[] = [];
  for (let i = 0; i < cells.length; i += PAGE_CELLS) {
    const pageCells = cells.slice(i, i + PAGE_CELLS);
    pages.push({
      html: `<div class="payslip"><style>${STYLES}</style><div class="grid">${pageCells.join("")}</div></div>`,
    });
  }
  return pages;
};

export const generateSpecialistPayslipPDF = async (
  data: SpecialistPayslipResponse,
  adjustments?: PayslipAdjustmentsResult,
): Promise<Blob> => {
  const { employee, period } = data;
  const pages = buildPages(data, adjustments);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.background = "#fff";
    wrapper.innerHTML = pages[i].html;
    document.body.appendChild(wrapper);

    try {
      const target = wrapper.firstElementChild as HTMLElement;
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: target.offsetWidth,
        windowHeight: target.offsetHeight,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  pdf.setProperties({
    title: `Расчётный лист ${employee.fullName} ${period.dateFrom}—${period.dateTo}`,
  });

  return pdf.output("blob");
};
