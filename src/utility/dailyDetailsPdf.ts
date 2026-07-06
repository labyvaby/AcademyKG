/**
 * «Авансы и долги» — PDF-генератор (A4 портрет), html2pdf.js.
 * Структура по фото-образцу (WhatsApp 04.06.2026): жёлтая шапка
 * «АВАНСЫ: <дата>», строка «Ф.И.О.», строки «имя (примечание) | сумма»,
 * жёлтые «Итого»; с 2026-07-06 между авансами и долгами — секция
 * «УДЕРЖАНИЯ: <дата>» той же структуры; затем «Долги детей», строки, «Итого».
 *
 * Данные собирает services/dailyDetails.ts (assembleDailyDetails).
 */
import html2pdf from "html2pdf.js";
import dayjs from "dayjs";
import type { DailyDetailsData, DailyDetailRow } from "../services/dailyDetails";

const YELLOW = "#ffe94d";

const fmt = (v: number): string =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v || 0);

const escapeHtml = (s: string): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const CELL = "border:1px solid #000;padding:1.5mm 3mm;font-size:10pt;";

// Жёлтая строка на всю ширину (заголовки секций).
const sectionRow = (title: string): string =>
    `<tr><td colspan="2" style="${CELL}font-weight:800;text-align:center;background:${YELLOW};">${escapeHtml(title)}</td></tr>`;

// Обычная строка «имя (примечание) | сумма».
const dataRow = (r: DailyDetailRow, align: "center" | "left"): string => {
    const label = r.note ? `${r.name} (${r.note})` : r.name;
    return `<tr>
      <td style="${CELL}font-weight:700;text-align:${align};word-break:break-word;">${escapeHtml(label)}</td>
      <td style="${CELL}font-weight:700;text-align:center;white-space:nowrap;">${escapeHtml(fmt(r.amount))}</td>
    </tr>`;
};

const emptyRow = (text: string): string =>
    `<tr><td colspan="2" style="${CELL}text-align:center;color:#555;">${escapeHtml(text)}</td></tr>`;

// Жёлтая строка «Итого | сумма».
const totalRow = (total: number): string =>
    `<tr>
      <td style="${CELL}font-weight:800;text-align:right;background:${YELLOW};">Итого</td>
      <td style="${CELL}font-weight:800;text-align:center;background:${YELLOW};white-space:nowrap;">${escapeHtml(fmt(total))}</td>
    </tr>`;

const buildHtml = (d: DailyDetailsData): string => {
    const dateLabel = dayjs(d.date).format("DD.MM.YYYY");

    return `
    <div style="width:190mm;margin:0 auto;padding:6mm;font-family:Arial, sans-serif;color:#000;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>

        <!-- Авансы -->
        ${sectionRow(`АВАНСЫ: ${dateLabel}`)}
        <tr><td colspan="2" style="${CELL}font-weight:800;text-align:center;">Ф.И.О.</td></tr>
        ${d.advances.length > 0
            ? d.advances.map((r) => dataRow(r, "center")).join("")
            : emptyRow("Авансов за этот день нет")}
        ${totalRow(d.advancesTotal)}

        <!-- Удержания (за детей сотрудников и ручные) -->
        ${sectionRow(`УДЕРЖАНИЯ: ${dateLabel}`)}
        <tr><td colspan="2" style="${CELL}font-weight:800;text-align:center;">Ф.И.О.</td></tr>
        ${d.deductions.length > 0
            ? d.deductions.map((r) => dataRow(r, "center")).join("")
            : emptyRow("Удержаний за этот день нет")}
        ${totalRow(d.deductionsTotal)}

        <!-- Долги детей -->
        ${sectionRow("Долги детей")}
        ${d.debts.length > 0
            ? d.debts.map((r) => dataRow(r, "left")).join("")
            : emptyRow("Долгов за этот день нет")}
        ${totalRow(d.debtsTotal)}
      </table>
    </div>`;
};

export const generateDailyDetailsPDF = async (data: DailyDetailsData): Promise<Blob> => {
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
