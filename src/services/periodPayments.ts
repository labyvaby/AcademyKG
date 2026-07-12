import { fetchAllPages } from "../utility/pagination";

// GET /api/v1/period-payments/?paidDate=YYYY-MM-DD&branch=<uuid>
// Контракт бэка (реализован по тикету backend-requests-2026-07-02-daily-summary-period-payments.md,
// «Требование 2»): список оплат за период, проведённых в указанный день (paidAt, Asia/Bishkek).
export interface PeriodPaymentListItem {
    id: string;
    paidAt: string;
    patient: { id: string; fullName: string };
    paidCash: string;
    paidCard: string;
    paidBalance: string;
    paidBonuses: string;
    discount: string;
    totalAmount: string;
    comment: string;
    appointments: { id: string; appointmentAt: string }[];
    appointmentsCount: number;
    periodFrom: string;
    periodTo: string;
}

// branch для суперадмина доставляется автоматически (apiClient добавляет
// branch= из глобального фильтра ко всем GET-запросам).
export const fetchPeriodPaymentsForDay = async (
    date: string,
): Promise<PeriodPaymentListItem[]> =>
    fetchAllPages<PeriodPaymentListItem>(
        `/api/v1/period-payments/?paidDate=${date}`,
    );
