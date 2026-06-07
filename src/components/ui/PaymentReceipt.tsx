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
  /** Название филиала */
  branchName?: string | null;
};

// Термочек 58mm. Точно по референсу с фото.
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
  }
  .receipt-print-root {
    width: 58mm !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 3mm 3mm 4mm !important;
    box-sizing: border-box !important;
    font-family: "Courier New", Courier, monospace !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    color: #000 !important;
    background: #fff !important;
  }
  .center { text-align: center; }
  .bold   { font-weight: 700; }
  /* Название организации — центр, средний */
  .org    { text-align: center; font-size: 15px; font-weight: 700; margin-bottom: 1mm; }
  /* Строка "1 Чек #XXXXX" */
  .chek   { font-size: 13px; font-weight: 400; margin: 1mm 0; }
  /* Дата+время — одна строка, влезает в 58mm */
  .datetime { font-size: 15px; font-weight: 700; margin: 1.5mm 0 1mm; line-height: 1.2; white-space: nowrap; }
  /* Менеджер */
  .manager  { font-size: 13px; margin-bottom: 1mm; }
  /* Имя клиента — крупно, слева */
  .client   { font-size: 20px; font-weight: 700; margin: 1.5mm 0 1mm; line-height: 1.1; }
  /* Тип операции */
  .optype   { font-size: 13px; margin-bottom: 1mm; }
  /* Разделитель — пунктир */
  .sep  { border-top: 1px dashed #000; margin: 2mm 0; }
  /* Разделитель — сплошной */
  .sep2 { border-top: 1px solid #000; margin: 2mm 0; }
  /* Строка ключ-значение */
  .row    { display: flex; justify-content: space-between; align-items: baseline; margin: 0.5mm 0; }
  .row-l  { flex: 1; padding-right: 2mm; word-break: break-word; font-size: 13px; }
  .row-r  { flex-shrink: 0; white-space: nowrap; font-size: 13px; }
  /* Итого */
  .total-row { display: flex; justify-content: space-between; align-items: baseline; margin: 1mm 0; }
  .total-l   { font-size: 16px; font-weight: 700; }
  .total-r   { font-size: 16px; font-weight: 700; white-space: nowrap; }
  /* Таблица услуг */
  table  { width: 100%; border-collapse: collapse; margin: 1mm 0; }
  th, td { padding: 1px 1px; font-size: 13px; vertical-align: top; color: #000; }
  th     { font-weight: 700; border-bottom: 1px solid #000; }
  th:first-child, td:first-child { text-align: left; }
  /* Название услуги — жирным */
  tbody td:first-child { font-weight: 700; }
  th.num, td.num { text-align: center; width: 14mm; }
  th.amt, td.amt { text-align: right; width: 16mm; white-space: nowrap; }
  /* Нижняя отрывная — только одна линия */
  .tear { border-top: 2px dashed #000; margin: 3mm 0 2mm; }
  /* Второй чек — разрыв страницы перед ним */
  .receipt-copy { page-break-before: always; width: 58mm !important; max-width: 58mm !important; margin: 0 !important; padding: 3mm 3mm 4mm !important; box-sizing: border-box !important; font-family: "Courier New", Courier, monospace !important; font-size: 14px !important; line-height: 1.4 !important; color: #000 !important; background: #fff !important; }
`;

// Формат как на референсе: "800.00" без знака валюты в таблице/строках
function formatMoney(v: number): string {
  return v.toFixed(2);
}
// Для строки "Сом" снизу — без суффикса
function formatTotal(v: number): string {
  return v.toFixed(2);
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
    orgName = "Аутизм победим KG",
    branchName = null,
  } = data;

  // Фактическое время оплаты/печати чека, а не плановое время приёма
  const now       = dayjsBishkek(new Date().toISOString());
  const datetimeStr = now.format("DD.MM.YYYY HH:mm:ss");
  const receiptNo = shortId(appointment.id);
  const services  = parseServices(appointment);
  const totalPaid = cashPaid + cardPaid + balancePaid + bonusesPaid;
  const isBulk    = Boolean(bulkCount && bulkCount > 1);

  // ── Строки таблицы услуг ─────────────────────────────────────────────
  function metaRow(performerName: string | null | undefined, cols: number): string {
    const parts: string[] = [];
    if (branchName)    parts.push(branchName);
    if (performerName) parts.push(performerName);
    if (!parts.length) return "";
    return `<tr><td colspan="${cols}" style="font-size:13px;font-weight:700;padding-bottom:0;word-break:break-word">${parts.join(" / ")}</td></tr>`;
  }

  let servicesRows = "";
  let servicesRowsNoAmt = "";
  if (services.length > 0) {
    services.forEach((s) => {
      const name     = s.name || s.service_name || "Услуга";
      const qty      = s.quantity ?? 1;
      const price    = Number(s.price ?? s.cost ?? 0);
      const total    = price * qty;
      const perfName = s.performer_name || s.doctor_name || null;
      servicesRows += `${metaRow(perfName, 3)}<tr>
        <td>${name}</td>
        <td class="num">${qty.toFixed(2)}</td>
        <td class="amt">${formatMoney(total)}</td>
      </tr>`;
      servicesRowsNoAmt += `${metaRow(perfName, 2)}<tr>
        <td>${name}</td>
        <td class="num">${qty.toFixed(2)}</td>
      </tr>`;
    });
  } else {
    const serviceName = appointment.service_names || "Услуга";
    const qty         = isBulk ? (bulkCount ?? 1) : 1;
    const perItem     = isBulk && qty > 0 ? (basePrice / qty) : basePrice;
    const label       = isBulk ? `${serviceName} (период)` : serviceName;
    const perfName    = appointment.doctor_name || null;
    servicesRows = `${metaRow(perfName, 3)}<tr>
      <td>${label}</td>
      <td class="num">${qty.toFixed(2)}</td>
      <td class="amt">${formatMoney(perItem * qty)}</td>
    </tr>`;
    servicesRowsNoAmt = `${metaRow(perfName, 2)}<tr>
      <td>${label}</td>
      <td class="num">${qty.toFixed(2)}</td>
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

  // ── HTML — точно по референсу ─────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=220"/>
<title>Чек #${receiptNo}</title>
<style>${RECEIPT_CSS}</style>
</head>
<body>
<div class="receipt-print-root">

  <!-- Название организации по центру -->
  <div class="org">${orgName}</div>

  <!-- "1 Чек #XXXXX" — слева, обычный размер -->
  <div class="chek">1 Чек #${receiptNo}</div>

  <!-- Дата и время — крупно, НА ОДНОЙ СТРОКЕ -->
  <div class="datetime">${datetimeStr}</div>

  <!-- Менеджер — если есть -->
  ${cashierName ? `<div class="manager">Менеджер: ${cashierName}</div>` : ""}

  <!-- Имя клиента — крупно, слева -->
  ${appointment.patient_name ? `<div class="client">${appointment.patient_name}</div>` : ""}

  <!-- Тип операции -->
  <div class="optype">Разовая оплата</div>

  <div class="sep"></div>

  <!-- Таблица услуг -->
  <table>
    <thead>
      <tr>
        <th>Услуги</th>
        <th class="num">Кол-во</th>
        <th class="amt">Сумма</th>
      </tr>
    </thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <div class="sep"></div>

  <!-- Скидка, если есть -->
  ${discountPercent > 0 ? `
  <div class="row">
    <span class="row-l">Скидка ${discountPercent}%</span>
    <span class="row-r">-${formatMoney(discountAmount)}</span>
  </div>` : ""}

  <!-- Всего -->
  <div class="total-row">
    <span class="total-l">Всего:</span>
    <span class="total-r">${formatTotal(finalPrice)}</span>
  </div>

  <div class="sep"></div>

  <!-- Способы оплаты -->
  ${paymentLines.join("")}

  <!-- Долг, если есть -->
  ${appointment.debt > 0 ? `
  <div class="sep"></div>
  <div class="row">
    <span class="row-l bold">Остаток долга</span>
    <span class="row-r bold">${formatMoney(appointment.debt)}</span>
  </div>` : ""}

  <!-- Нижняя строка "Сом + итог" -->
  <div class="sep"></div>
  <div class="row" style="font-size:13px">
    <span class="row-l bold">Сом</span>
    <span class="row-r bold">${formatTotal(totalPaid)}</span>
  </div>

  <!-- Нижняя отрывная линия / линия отреза между чеками -->
  <div class="tear"></div>

</div>

<!-- ===== КОПИЯ ЧЕКА ===== -->
<div class="receipt-copy">

  ${appointment.patient_name ? `<div class="client">${appointment.patient_name}</div>` : ""}
  ${cashierName ? `<div class="manager">Менеджер: ${cashierName}</div>` : ""}
  <div class="manager">Дата: ${datetimeStr}</div>

  <div class="sep"></div>

  <table>
    <thead>
      <tr>
        <th>Услуги</th>
        <th class="num">Кол-во</th>
      </tr>
    </thead>
    <tbody>${servicesRowsNoAmt}</tbody>
  </table>

  <div class="tear"></div>

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
