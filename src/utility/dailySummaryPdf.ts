/**
 * «Сводка дня» — PDF-генератор (A4 портрет, одна страница), html2pdf.js.
 * Структура 1:1 с образцом-фото (photo_2026-05-20_17-34-15.jpg):
 * таблица «строка = значение», секции-заголовки, красные/синие смысловые строки,
 * внизу — пустое место под подпись.
 *
 * Данные собирает services/dailySummary.ts (assembleDailySummary).
 * Поля-пробелы (АФК/ЛФК/перерасчёт/спецы) пока приходят нулями — см. backend ТЗ.
 */
import html2pdf from "html2pdf.js";
import type { DailySummaryData } from "../services/dailySummary";

// Числа с разделителями тысяч, без суффикса валюты (D3).
const fmt = (v: number): string =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v || 0);

const RED = "#c0182b";
const BLUE = "#1340b0";

const escapeHtml = (s: string): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

// Строка «лейбл | значение». color — для смысловых (красный/синий).
const row = (label: string, value: string, color?: string): string => {
    const c = color ? `color:${color};` : "";
    return `<tr>
      <td style="border:1px solid #000;padding:2mm 3mm;font-size:10pt;font-weight:700;${c}">${escapeHtml(label)}</td>
      <td style="border:1px solid #000;padding:2mm 3mm;font-size:10pt;font-weight:700;text-align:right;white-space:nowrap;${c}">${escapeHtml(value)}</td>
    </tr>`;
};

// Секция-заголовок на всю ширину.
const section = (title: string): string =>
    `<tr><td colspan="2" style="border:1px solid #000;padding:1.5mm 3mm;font-size:10pt;font-weight:800;text-align:center;background:#f0f0f0;">${escapeHtml(title)}</td></tr>`;

const buildHtml = (d: DailySummaryData): string => {
    const lfkValue = `${fmt(d.lfkPaymentsCount)} (${fmt(d.lfkRecalcCount)} перерасчет)`;

    return `
    <div style="width:190mm;margin:0 auto;padding:6mm;font-family:Arial, sans-serif;color:#000;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:62%"/><col style="width:38%"/></colgroup>

        <!-- Шапка -->
        <tr><td colspan="2" style="border:1px solid #000;padding:2mm;font-size:13pt;font-weight:800;text-align:center;">${escapeHtml(d.brandName)}</td></tr>
        <tr><td colspan="2" style="border:1px solid #000;padding:1.5mm;font-size:11pt;font-weight:700;text-align:center;">${escapeHtml(d.weekdayLabel)} ${d.weekOfMonth}-неделя</td></tr>
        <tr><td colspan="2" style="border:1px solid #000;padding:1.5mm;font-size:11pt;font-weight:700;text-align:center;">${escapeHtml(d.periodTo)}</td></tr>

        <!-- Приход -->
        ${row("Приход АФК", fmt(d.incomeAfk))}
        ${row("Приход", fmt(d.income))}
        ${row("Иглотерапия", fmt(d.acupuncture))}

        <!-- Расходы -->
        ${section("Расходы")}
        ${row("Итого расходы", fmt(d.expensesToday))}
        ${row(`Итоги расходов за период ${d.periodFrom} по ${d.periodTo}`, fmt(d.expensesPeriod), RED)}
        ${row("Наличка за прошлый день", fmt(d.cashPrevDay), RED)}
        ${row("Итого наличка за сегодня", fmt(d.cashToday), RED)}
        ${row(`Итого наличка с ${d.periodFrom} по ${d.periodTo}`, fmt(d.cashPeriod), RED)}

        <!-- Ответственный -->
        ${section(d.responsibleName)}
        ${row("Итого расходы на сегодня", fmt(d.personExpensesToday))}
        ${row(`Итого расходы с ${d.periodFrom} по ${d.periodTo}`, fmt(d.personExpensesPeriod))}

        <!-- Авансы -->
        ${section("Авансы")}
        ${row("за сегодня", fmt(d.advancesToday), BLUE)}
        ${row(`Итого с ${d.periodFrom} по ${d.periodTo}`, fmt(d.advancesPeriod), BLUE)}

        <!-- Долги детей -->
        ${section("Долги детей")}
        ${row("за сегодня", fmt(d.childDebtToday))}
        ${row(`Итого с ${d.periodFrom} по ${d.periodTo}`, fmt(d.childDebtPeriod))}
        ${row("Фактическая наличка", fmt(d.factualCash), BLUE)}

        <!-- Счётчики -->
        ${row("Количество занятий", fmt(d.lessonsCount))}
        ${row(`Общее количество детей с ${d.periodFrom} по ${d.periodTo}`, fmt(d.childrenCount))}
        ${row("Количество специалистов", `${fmt(d.specialistsCount)} (чел)`)}
        ${row("Оплата за АФК на сегодня", fmt(d.afkPaymentsToday))}
        ${row("Оплата за ЛФК общая количество", lfkValue)}
        ${row(`Итого штрафов с ${d.periodFrom} по ${d.periodTo}`, fmt(d.penaltiesPeriod))}
      </table>

      <!-- Место под подпись -->
      <div style="margin-top:14mm;display:flex;justify-content:flex-end;">
        <div style="width:60mm;text-align:center;">
          <div style="border-bottom:1px solid #000;height:12mm;"></div>
          <div style="font-size:9pt;color:#555;margin-top:1mm;">(подпись)</div>
        </div>
      </div>
    </div>`;
};

export const generateDailySummaryPDF = async (data: DailySummaryData): Promise<Blob> => {
    const container = document.createElement("div");
    container.innerHTML = buildHtml(data);
    document.body.appendChild(container);

    try {
        const blob = await html2pdf()
            .set({
                margin: [0, 0, 0, 0],
                filename: `svodka_${data.date}.pdf`,
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
