/**
 * «Занятия за день» — PDF-генератор (A4 портрет), html2pdf.js.
 * Структура 1:1 с фото-образцами (WhatsApp 2026-06-15):
 *   жёлтая шапка с датой → «Академия KG» → таблица «Занятия | Кол | сумм | Итого»
 *   (синие агрегаты по стандартной цене, белые строки-исключения) → итог →
 *   жёлтая шапка «АФК <дата>» → «Академия KG» → таблица «АФК | Кол д | Сумма | Итого» → итог.
 *
 * Данные собирает services/dailyLessons.ts (assembleDailyLessons).
 */
import html2pdf from "html2pdf.js";
import type { DailyLessonsData } from "../services/dailyLessons";

// Числа с разделителями тысяч, без валюты (как в «Сводке дня»).
const fmt = (v: number | null): string =>
    v === null || v === undefined
        ? ""
        : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v || 0);

const YELLOW = "#ffe100";
const BLUE = "#4f81bd";       // синий агрегат (как на образце)
const RED = "#c0182b";        // дата
const BRAND = "#1340b0";      // «Академия KG»
const BORDER = "1px solid #000";

const escapeHtml = (s: string): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const td = (
    content: string,
    opts: { align?: "left" | "right" | "center"; bg?: string; color?: string; bold?: boolean } = {},
): string => {
    const { align = "left", bg, color, bold = true } = opts;
    return `<td style="border:${BORDER};padding:1.5mm 2.5mm;font-size:9.5pt;${bold ? "font-weight:700;" : ""}text-align:${align};${bg ? `background:${bg};` : ""}${color ? `color:${color};` : ""}white-space:nowrap;">${content}</td>`;
};

// Жёлтая шапка на всю ширину (дата / «АФК <дата>»).
const yellowHead = (text: string): string =>
    `<tr><td colspan="4" style="border:${BORDER};padding:1.5mm;font-size:11pt;font-weight:800;text-align:center;background:${YELLOW};color:${RED};">${escapeHtml(text)}</td></tr>`;

const brandRow = (brand: string): string =>
    `<tr><td colspan="4" style="border:${BORDER};padding:1.2mm;font-size:10pt;font-weight:800;text-align:center;background:${YELLOW};color:${BRAND};">${escapeHtml(brand)}</td></tr>`;

// Шапка колонок (серая).
const colHead = (c1: string, c2: string, c3: string, c4: string): string =>
    `<tr style="background:#e8e8e8;">
      ${td(escapeHtml(c1), { align: "center" })}
      ${td(escapeHtml(c2), { align: "center" })}
      ${td(escapeHtml(c3), { align: "center" })}
      ${td(escapeHtml(c4), { align: "center" })}
    </tr>`;

const buildHtml = (d: DailyLessonsData): string => {
    // Строки «Занятия»: синие агрегаты + белые исключения.
    const lessonBody = d.lessonRows
        .map((row) => {
            const bg = row.blue ? BLUE : undefined;
            const color = row.blue ? "#fff" : undefined;
            return `<tr>
              ${td(escapeHtml(row.label), { bg, color })}
              ${td(fmt(row.count), { align: "right", bg, color })}
              ${td(fmt(row.unitPrice), { align: "right", bg, color })}
              ${td(fmt(row.total), { align: "right", bg, color })}
            </tr>`;
        })
        .join("");

    const lessonTotal = `<tr>
      ${td("", {})}
      ${td(fmt(d.lessonsTotalCount), { align: "right" })}
      ${td("", {})}
      ${td(fmt(d.lessonsTotalSum), { align: "right" })}
    </tr>`;

    // Блок АФК (может быть пустым → только итоговая строка с нулями, как на образце).
    const afkBody = d.afkRows
        .map(
            (row) => `<tr>
              ${td(escapeHtml(row.label), {})}
              ${td(fmt(row.count), { align: "right" })}
              ${td(fmt(row.unitPrice), { align: "right" })}
              ${td(fmt(row.total), { align: "right" })}
            </tr>`,
        )
        .join("");

    const afkTotal = `<tr>
      ${td("", {})}
      ${td(fmt(d.afkTotalCount), { align: "right" })}
      ${td("Итого", { align: "right" })}
      ${td(fmt(d.afkTotalSum), { align: "right" })}
    </tr>`;

    return `
    <div style="width:190mm;margin:0 auto;padding:6mm;font-family:Arial, sans-serif;color:#000;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup>
          <col style="width:55%"/><col style="width:12%"/><col style="width:16%"/><col style="width:17%"/>
        </colgroup>

        <!-- Занятия -->
        ${yellowHead(d.dateLabel)}
        ${brandRow(d.brandName)}
        ${colHead("Занятия", "Кол", "сумм", "Итого")}
        ${lessonBody}
        ${lessonTotal}

        <!-- АФК -->
        ${yellowHead(`АФК ${d.dateLabel}`)}
        ${brandRow(d.brandName)}
        ${colHead("АФК", "Кол д", "Сумма", "Итого")}
        ${afkBody}
        ${afkTotal}
      </table>
    </div>`;
};

export const generateDailyLessonsPDF = async (data: DailyLessonsData): Promise<Blob> => {
    const container = document.createElement("div");
    container.innerHTML = buildHtml(data);
    // ВАЖНО: контейнер в потоке БЕЗ позиционирования. Уводить за экран нельзя:
    // html2canvas снимает только видимую область → пустой PDF (регрессия 5ebf3d2).
    // Цена — короткое мигание таблицы; зато рендер гарантированно непустой.
    container.style.cssText = "width:210mm;background:#fff;";
    document.body.appendChild(container);

    try {
        const blob = await html2pdf()
            .set({
                margin: [0, 0, 0, 0],
                filename: `zanyatiya_${data.date}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .from(container)
            .output("blob");
        return blob as Blob;
    } finally {
        document.body.removeChild(container);
    }
};
