/**
 * PaymentReceipt — термочек 58mm для печати после оплаты.
 * Данные передаются в popup-окно, вызывается window.print().
 */
import React from "react";
import { dayjsBishkek } from "../../utility/dayjsBishkek";
import type { Appointment, AppointmentServiceJson } from "../../pages/home/types";

export type ReceiptData = {
  appointment: Appointment;
  /** Фактически оплачено наличными (из формы, может отличаться от appointment.paid_cash) */
  cashPaid: number;
  /** Фактически оплачено безналично */
  cardPaid: number;
  /** Оплачено с баланса */
  balancePaid: number;
  /** Оплачено бонусами */
  bonusesPaid: number;
  /** Процент скидки */
  discountPercent: number;
  /** Сумма скидки */
  discountAmount: number;
  /** Базовая цена (до скидки) */
  basePrice: number;
  /** Итого к оплате (после скидки) */
  finalPrice: number;
  /** Кол-во приёмов (для bulk-режима) */
  bulkCount?: number;
  /** Имя кассира/менеджера */
  cashierName?: string | null;
  /** Название организации */
  orgName?: string;
};

// Чек печатается как узкая полоса 58mm. @page margin:0 убирает поля браузера.
// print-color-adjust: exact — гарантирует чёрный текст без осветления браузером.
const RECEIPT_CSS = `
  @page {
    margin: 0;
    size: 58mm auto;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    width: 58mm !important;
    min-width: 0 !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-font-smoothing: none;
    font-smoothing: none;
  }
  .receipt-print-root {
    width: 58mm !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 2mm 2.5mm !important;
    box-sizing: border-box !important;
    font-family: "Courier New", Courier, monospace !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
    color: #000 !important;
    background: #fff !important;
    text-rendering: optimizeLegibility;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: 700; }
  .xl      { font-size: 18px; font-weight: 700; line-height: 1.2; }
  .lg      { font-size: 14px; font-weight: 700; }
  .md      { font-size: 12px; }
  .sm      { font-size: 11px; }
  /* пунктирная линия-разделитель */
  .sep     { border-top: 1px dashed #000; margin: 4px 0; }
  /* сплошная линия */
  .sep2    { border-top: 1px solid #000; margin: 4px 0; }
  /* строка символов — для термопринтеров надёжнее border */
  .dash    { letter-spacing: 1px; font-size: 11px; color: #000; margin: 3px 0; }
  /* отрывная линия вверху/внизу */
  .tear    { border-top: 2px dashed #000; margin: 4px 0 6px; letter-spacing: 3px;
             font-size: 10px; text-align: center; padding-top: 3px; }
  .row     { display: flex; justify-content: space-between; align-items: baseline; margin: 2px 0; }
  .row-l   { flex: 1; padding-right: 4px; word-break: break-word; }
  .row-r   { flex-shrink: 0; white-space: nowrap; font-weight: 700; }
  /* таблица услуг */
  table    { width: 100%; border-collapse: collapse; margin: 3px 0; }
  th, td   { padding: 2px 2px; font-size: 11px; vertical-align: top; color: #000; }
  th       { text-align: left; font-weight: 700; border-bottom: 1px solid #000; font-size: 11px; }
  td.num   { text-align: center; white-space: nowrap; }
  td.amt   { text-align: right; white-space: nowrap; font-weight: 700; }
  col.c1   { width: auto; }
  col.c2   { width: 20mm; }
  col.c3   { width: 18mm; }
`;

function formatMoney(v: number): string {
  return v.toLocaleString("ru-KG") + " с";
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

function parseServices(appointment: Appointment): AppointmentServiceJson[] {
  if (Array.isArray(appointment.parsed_services) && appointment.parsed_services.length > 0) {
    return appointment.parsed_services;
  }
  try {
    if (typeof appointment.services_json === "string") {
      return JSON.parse(appointment.services_json) as AppointmentServiceJson[];
    }
    if (Array.isArray(appointment.services_json)) {
      return appointment.services_json as AppointmentServiceJson[];
    }
  } catch (_) { /* ignore */ }
  return [];
}

export function buildReceiptHtml(data: ReceiptData): string {
  const {
    appointment,
    cashPaid,
    cardPaid,
    balancePaid,
    bonusesPaid,
    discountPercent,
    discountAmount,
    basePrice,
    finalPrice,
    bulkCount,
    cashierName,
    orgName = "Академия",
  } = data;

  const now = dayjsBishkek(appointment.appointment_at);
  const dateStr   = now.format("DD.MM.YYYY");
  const timeStr   = now.format("HH:mm:ss");
  const receiptNo = shortId(appointment.id);
  const services  = parseServices(appointment);
  const totalPaid = cashPaid + cardPaid + balancePaid + bonusesPaid;
  const isBulk    = Boolean(bulkCount && bulkCount > 1);

  // ── Строки таблицы услуг ──────────────────────────────────────────────
  let servicesRows = "";
  if (services.length > 0) {
    servicesRows = services.map((s) => {
      const name  = s.name || s.service_name || "Услуга";
      const qty   = s.quantity ?? 1;
      const price = Number(s.price ?? s.cost ?? 0);
      const total = price * qty;
      return `<tr>
        <td>${name}</td>
        <td class="num">${qty}</td>
        <td class="amt">${formatMoney(total)}</td>
      </tr>`;
    }).join("");
  } else {
    const serviceName = appointment.service_names || "Услуга";
    const qty         = isBulk ? (bulkCount ?? 1) : 1;
    const perItem     = isBulk && qty > 0 ? (basePrice / qty) : basePrice;
    const label       = isBulk ? `${serviceName} (период)` : serviceName;
    servicesRows = `<tr>
      <td>${label}</td>
      <td class="num">${qty}</td>
      <td class="amt">${formatMoney(perItem * qty)}</td>
    </tr>`;
  }

  // ── Строки оплаты ────────────────────────────────────────────────────
  const paymentLines: string[] = [];
  if (cashPaid > 0) {
    paymentLines.push(`<div class="row"><span class="row-l">Наличные</span><span class="row-r">${formatMoney(cashPaid)}</span></div>`);
  }
  if (cardPaid > 0) {
    paymentLines.push(`<div class="row"><span class="row-l">Безнал</span><span class="row-r">${formatMoney(cardPaid)}</span></div>`);
  }
  if (balancePaid > 0) {
    paymentLines.push(`<div class="row"><span class="row-l">Со счёта</span><span class="row-r">${formatMoney(balancePaid)}</span></div>`);
  }
  if (bonusesPaid > 0) {
    paymentLines.push(`<div class="row"><span class="row-l">Бонусы</span><span class="row-r">${formatMoney(bonusesPaid)}</span></div>`);
  }
  if (paymentLines.length === 0) {
    paymentLines.push(`<div class="row"><span class="row-l">Оплата</span><span class="row-r">${formatMoney(totalPaid)}</span></div>`);
  }

  // ── HTML ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=58mm"/>
<title>Чек #${receiptNo}</title>
<style>${RECEIPT_CSS}</style>
</head>
<body>
<div class="receipt-print-root">

  <!-- Верхняя отрывная линия -->
  <div class="tear">- - - - - - - - - - - - - - -</div>

  <!-- Название организации -->
  <div class="center bold lg" style="margin-bottom:2px">${orgName}</div>

  <div class="sep"></div>

  <!-- Номер чека + дата крупно -->
  <div class="row md">
    <span class="row-l">1 Чек #${receiptNo}</span>
    <span style="font-size:11px;font-weight:400">Разовая оплата</span>
  </div>

  <!-- Крупная дата и время — как в референсе -->
  <div class="center xl" style="margin:4px 0 2px">${dateStr} ${timeStr}</div>

  <!-- Менеджер/кассир -->
  ${cashierName ? `<div class="sm" style="margin-bottom:2px">Менеджер: <b>${cashierName}</b></div>` : ""}

  <div class="sep"></div>

  <!-- Имя клиента — крупно -->
  ${appointment.patient_name ? `<div class="center xl" style="margin:4px 0">${appointment.patient_name}</div>` : ""}

  <!-- Тип операции -->
  <div class="md" style="margin-bottom:3px">Разовая оплата</div>

  <div class="sep"></div>

  <!-- Таблица услуг -->
  <table>
    <colgroup>
      <col class="c1"/>
      <col class="c2" style="width:14mm"/>
      <col class="c3" style="width:16mm"/>
    </colgroup>
    <thead>
      <tr>
        <th>Услуги</th>
        <th style="text-align:center">Кол-во</th>
        <th style="text-align:right">Сумма</th>
      </tr>
    </thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <div class="sep"></div>

  <!-- Скидка, если есть -->
  ${discountPercent > 0 ? `
  <div class="row md">
    <span class="row-l">Скидка ${discountPercent}%</span>
    <span class="row-r" style="font-weight:400">- ${formatMoney(discountAmount)}</span>
  </div>` : ""}

  <!-- ИТОГО — крупно и жирно -->
  <div class="row" style="margin:3px 0">
    <span class="row-l lg">Всего:</span>
    <span class="row-r lg">${formatMoney(finalPrice)}</span>
  </div>

  <div class="sep2"></div>

  <!-- Способы оплаты -->
  <div class="sm bold" style="margin-bottom:2px">Оплата:</div>
  ${paymentLines.join("")}

  <div class="sep2"></div>

  <!-- Долг, если есть -->
  ${appointment.debt > 0 ? `
  <div class="row md">
    <span class="row-l">Остаток долга</span>
    <span class="row-r" style="font-weight:700">${formatMoney(appointment.debt)}</span>
  </div>
  <div class="sep"></div>` : ""}

  <div class="center md bold" style="margin:4px 0">Сом</div>

  <!-- Нижняя отрывная линия -->
  <div class="tear" style="margin-top:6px">- - - - - - - - - - - - - - -</div>

  <div class="center sm" style="margin:3px 0 2px">Спасибо за визит!</div>

</div>
</body>
</html>`;
}

/**
 * Печатает чек через скрытый iframe с реальными размерами (58mm × 300mm).
 * iframe не display:none и не width:0 — браузер видит его размеры и
 * корректно применяет @page size:58mm из CSS документа.
 * Видимого popup-окна нет — пользователь видит только системный print dialog.
 */
export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);

  const iframe = document.createElement("iframe");
  // Реальные размеры нужны браузеру для @page size; visibility:hidden скрывает от пользователя
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:58mm",
    "height:300mm",
    "border:0",
    "visibility:hidden",
  ].join(";");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  // afterprint срабатывает когда диалог закрыт (поддерживается Chrome/Edge/FF)
  iframe.contentWindow?.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    if (!iframe.contentWindow) { cleanup(); return; }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Fallback: убираем iframe если afterprint не сработал
    setTimeout(cleanup, 60000);
  }, 200);
}

// Компонент-заглушка (не используется напрямую, логика через printReceipt)
const PaymentReceipt: React.FC<{ data: ReceiptData }> = () => null;
export default PaymentReceipt;
