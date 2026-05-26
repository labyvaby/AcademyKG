/**
 * PaymentReceipt — термочек 80mm для печати после оплаты.
 * Используется через usePrintReceipt: данные передаются в iframe, вызывается window.print().
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

const RECEIPT_CSS = `
  @page {
    margin: 0;
    size: 80mm auto;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    width: 80mm;
    /* auto высота — браузер подгонит страницу под контент */
    height: auto;
    overflow: visible;
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
    padding: 4mm;
    /* display:table заставляет body сжаться по высоте контента,
       что вместе с size:80mm auto даёт «бумагу по размеру чека» */
    display: table;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .lg     { font-size: 13px; }
  .sm     { font-size: 10px; }
  .sep    { border-top: 1px dashed #000; margin: 4px 0; }
  .sep2   { border-top: 1px solid #000; margin: 4px 0; }
  .row    { display: flex; justify-content: space-between; margin: 2px 0; }
  .row-l  { flex: 1; padding-right: 4px; word-break: break-word; }
  .row-r  { flex-shrink: 0; white-space: nowrap; }
  table   { width: 100%; border-collapse: collapse; margin: 3px 0; }
  th, td  { padding: 1px 2px; font-size: 10px; vertical-align: top; }
  th      { text-align: left; font-weight: bold; border-bottom: 1px solid #000; }
  td.num  { text-align: center; }
  td.amt  { text-align: right; white-space: nowrap; }
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
  const dateStr = now.format("DD.MM.YYYY HH:mm");
  const receiptNo = shortId(appointment.id);
  const services = parseServices(appointment);
  const totalPaid = cashPaid + cardPaid + balancePaid + bonusesPaid;
  const isBulk = Boolean(bulkCount && bulkCount > 1);

  // Строки услуг
  let servicesRows = "";
  if (services.length > 0) {
    servicesRows = services
      .map((s) => {
        const name = s.name || s.service_name || "Услуга";
        const qty = s.quantity ?? 1;
        const price = Number(s.price ?? s.cost ?? 0);
        const total = price * qty;
        return `<tr>
          <td>${name}</td>
          <td class="num">${qty}</td>
          <td class="amt">${formatMoney(total)}</td>
        </tr>`;
      })
      .join("");
  } else {
    const serviceName = appointment.service_names || "Услуга";
    const qty = isBulk ? (bulkCount ?? 1) : 1;
    const perItem = isBulk ? (basePrice / qty) : basePrice;
    servicesRows = `<tr>
      <td>${serviceName}</td>
      <td class="num">${qty}</td>
      <td class="amt">${formatMoney(perItem * qty)}</td>
    </tr>`;
  }

  // Способ оплаты
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

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Чек #${receiptNo}</title>
<style>${RECEIPT_CSS}</style>
</head>
<body>
  <div class="center bold lg">${orgName}</div>
  <div class="center sm">Кассовый чек</div>

  <div class="sep"></div>

  <div class="row sm">
    <span class="row-l">Чек №</span>
    <span class="row-r">${receiptNo}</span>
  </div>
  <div class="row sm">
    <span class="row-l">Дата</span>
    <span class="row-r">${dateStr}</span>
  </div>
  ${cashierName ? `<div class="row sm"><span class="row-l">Кассир</span><span class="row-r">${cashierName}</span></div>` : ""}
  ${appointment.patient_name ? `<div class="row sm"><span class="row-l">Клиент</span><span class="row-r">${appointment.patient_name}</span></div>` : ""}
  ${appointment.doctor_name ? `<div class="row sm"><span class="row-l">Специалист</span><span class="row-r">${appointment.doctor_name}</span></div>` : ""}

  <div class="sep"></div>

  <table>
    <thead>
      <tr>
        <th>Услуга</th>
        <th style="text-align:center">Кол</th>
        <th style="text-align:right">Сумма</th>
      </tr>
    </thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <div class="sep2"></div>

  ${discountPercent > 0 ? `
  <div class="row sm">
    <span class="row-l">Скидка ${discountPercent}%</span>
    <span class="row-r">− ${formatMoney(discountAmount)}</span>
  </div>
  ` : ""}

  <div class="row bold">
    <span class="row-l">ИТОГО</span>
    <span class="row-r lg">${formatMoney(finalPrice)}</span>
  </div>

  <div class="sep"></div>

  <div class="sm bold" style="margin-bottom:3px">Оплата:</div>
  ${paymentLines.join("")}

  <div class="sep2"></div>

  <div class="row bold">
    <span class="row-l">Оплачено</span>
    <span class="row-r">${formatMoney(totalPaid)}</span>
  </div>

  ${appointment.debt > 0 ? `
  <div class="row sm" style="color:#c00">
    <span class="row-l">Остаток долга</span>
    <span class="row-r">${formatMoney(appointment.debt)}</span>
  </div>` : ""}

  <div class="sep"></div>

  <div class="center sm" style="margin-top:4px;margin-bottom:4px">Спасибо за визит!</div>
</body>
</html>`;
}

/**
 * Открывает невидимый iframe, вставляет HTML чека и вызывает window.print().
 * Iframe удаляется после печати.
 */
export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  // Ждём загрузки шрифтов/стилей перед печатью
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Убираем iframe после того как диалог закрыт (небольшая задержка)
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 2000);
    }
  };
}

// Компонент-заглушка (не используется напрямую, логика через printReceipt)
const PaymentReceipt: React.FC<{ data: ReceiptData }> = () => null;
export default PaymentReceipt;
