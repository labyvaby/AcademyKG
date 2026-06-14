/**
 * «Авансы и долги» — дневная детализация для PDF (фото-образец
 * WhatsApp 04.06.2026): секция «АВАНСЫ» — кому выдан аванс за день,
 * секция «Долги детей» — приёмы дня с непогашенным долгом; в скобках —
 * ответственное лицо (родитель) из карточки клиента (responsiblePersons[0],
 * проверено вживую 2026-06-11: «Ариет (Эрмек)» = клиент Алиев Ариет Эрмекович,
 * responsiblePerson Алиев Эрмек Орозбекович).
 *
 * Ограничения источников (проверены вживую):
 * - у payroll-транзакций нет даты выдачи — фильтруем по createdAt; аванс,
 *   проведённый задним числом, попадёт в день проведения, а не в «свой»;
 * - Appointment.debt живой: долг, погашённый позже, исчезает из отчёта
 *   за прошлый день (та же семантика, что у day.debt.debtSum в сводке дня).
 */
import { apiFetch } from "../utility/apiClient";
import { dayjsBishkek } from "../utility/dayjsBishkek";

const num = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

export interface DailyDetailRow {
    name: string;       // сотрудник (авансы) / ребёнок (долги)
    note: string;       // комментарий аванса / ФИО родителя
    amount: number;
}

export interface DailyDetailsData {
    date: string;               // YYYY-MM-DD
    brandName: string;
    advances: DailyDetailRow[];
    advancesTotal: number;
    debts: DailyDetailRow[];
    debtsTotal: number;
}

type PayrollTxApi = {
    employee?: { fullName?: string | null } | null;
    kind?: string;
    totalAmount?: string | number;
    comment?: string | null;
    createdAt?: string;
};

type AggAppointmentApi = {
    patientId?: string;
    patientName?: string;
    appointmentAt?: string;
    debt?: string | number;
    status?: string;
};

type ClientApi = {
    responsiblePersons?: { fullName?: string | null }[] | null;
};

const unwrapList = <T>(res: any): T[] => {
    const d = res?.data ?? res;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    return [];
};

export interface AssembleDailyDetailsParams {
    date: string;       // YYYY-MM-DD
    branchId: string;   // UUID, обязателен
    brandName: string;
    signal?: AbortSignal;
}

export async function assembleDailyDetails(p: AssembleDailyDetailsParams): Promise<DailyDetailsData> {
    if (!p.branchId) {
        throw new Error("Для отчёта нужно выбрать конкретный филиал.");
    }
    const month = p.date.slice(0, 7); // YYYY-MM

    const [txRes, aggRes] = await Promise.all([
        apiFetch<any>(
            `/api/v1/payroll-transactions/?kind=advance&affectsMonth=${month}&branch=${p.branchId}&pageSize=500`,
            { signal: p.signal },
        ),
        apiFetch<any>(
            `/api/v1/appointments-aggregated/?branch=${p.branchId}&month=${month}`,
            { signal: p.signal },
        ),
    ]);

    // ── Авансы за день (по дате проведения createdAt, время Бишкека) ──────
    const advances: DailyDetailRow[] = unwrapList<PayrollTxApi>(txRes)
        .filter((t) => t.createdAt && dayjsBishkek(t.createdAt).format("YYYY-MM-DD") === p.date)
        .map((t) => ({
            name: t.employee?.fullName || "Без имени",
            note: (t.comment ?? "").trim(),
            amount: num(t.totalAmount),
        }));

    // ── Долги детей за день: приёмы дня с debt > 0, кроме отменённых ──────
    const dayDebts = unwrapList<AggAppointmentApi>(aggRes).filter(
        (a) =>
            a.appointmentAt &&
            dayjsBishkek(a.appointmentAt).format("YYYY-MM-DD") === p.date &&
            num(a.debt) > 0 &&
            a.status !== "cancelled",
    );

    // Один ребёнок может иметь несколько приёмов с долгом за день — суммируем.
    const byPatient = new Map<string, { name: string; amount: number }>();
    for (const a of dayDebts) {
        const key = a.patientId || a.patientName || "";
        const prev = byPatient.get(key);
        if (prev) prev.amount += num(a.debt);
        else byPatient.set(key, { name: a.patientName || "Без имени", amount: num(a.debt) });
    }

    // Родитель (ответственное лицо) — из карточки клиента; ошибки не валят отчёт.
    const parentByPatient = new Map<string, string>();
    await Promise.all(
        Array.from(byPatient.keys())
            .filter((id) => id && byPatient.get(id))
            .map(async (patientId) => {
                try {
                    const res = await apiFetch<any>(`/api/v1/clients/${patientId}/`, { signal: p.signal });
                    const client: ClientApi = res?.data ?? res;
                    const parent = client?.responsiblePersons?.[0]?.fullName ?? "";
                    if (parent) parentByPatient.set(patientId, parent);
                } catch {
                    /* нет доступа/удалён — строка без родителя */
                }
            }),
    );

    const debts: DailyDetailRow[] = Array.from(byPatient.entries()).map(([patientId, row]) => ({
        name: row.name,
        note: parentByPatient.get(patientId) ?? "",
        amount: row.amount,
    }));

    return {
        date: p.date,
        brandName: p.brandName,
        advances,
        advancesTotal: advances.reduce((s, r) => s + r.amount, 0),
        debts,
        debtsTotal: debts.reduce((s, r) => s + r.amount, 0),
    };
}
