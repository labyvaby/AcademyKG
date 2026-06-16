/**
 * «Занятия за день» — сборка данных для PDF из ендпоинта
 * GET /api/v1/reports/daily-lessons/ (контракт — docs/backend-requests-2026-06-15.md).
 *
 * Отчёт детализации индивидуальных приёмов по услугам («категориям») плюс блок
 * АФК (абонементы групп). В отчёт входят только ОПЛАЧЕННЫЕ занятия (решение
 * заказчика 2026-06-15). Ендпоинт может быть ещё не реализован бэком — тогда
 * запрос вернёт 404, диалог покажет понятную ошибку.
 */
import dayjs from "dayjs";
import { getDailyLessons } from "./reports";

const num = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

// Строка таблицы «Занятия». blue=true — синий агрегат по стандартной цене.
export interface LessonRow {
    label: string;
    count: number;
    unitPrice: number | null;   // null → пустая ячейка «сумм»
    total: number;
    blue: boolean;
}

export interface AfkRow {
    label: string;
    count: number;
    unitPrice: number;
    total: number;
}

export interface DailyLessonsData {
    brandName: string;
    date: string;               // YYYY-MM-DD
    dateLabel: string;          // «12.06.2026»

    lessonRows: LessonRow[];
    lessonsTotalCount: number;
    lessonsTotalSum: number;

    afkRows: AfkRow[];
    afkTotalCount: number;
    afkTotalSum: number;
}

export interface AssembleLessonsParams {
    date: string;               // YYYY-MM-DD
    branchId: string;           // UUID, ОБЯЗАТЕЛЕН
    brandName: string;
    signal?: AbortSignal;
}

// Подпись белой строки-исключения: «Категория Специалист - (Ребёнок)[-note]».
// Повторяет формат образца («СМК Алымбек А - (Эркин)», «…(Чолпон)-тех.персонал»).
const exceptionLabel = (
    category: string,
    specialistName: string,
    patientName: string,
    note: string,
): string => {
    const head = [category, specialistName].filter(Boolean).join(" ");
    const child = patientName ? ` - (${patientName})` : "";
    const suffix = note ? `-${note}` : "";
    return `${head}${child}${suffix}`;
};

export async function assembleDailyLessons(p: AssembleLessonsParams): Promise<DailyLessonsData> {
    if (!p.branchId) {
        throw new Error("Для отчёта «Занятия за день» нужно выбрать конкретный филиал.");
    }

    const res = await getDailyLessons(p.branchId, p.date, p.signal);
    const r = res.data;

    const lessonRows: LessonRow[] = [];
    // Категории идут в порядке, заданном бэком (order), стабильно при равенстве.
    const categories = [...r.lessons.categories].sort((a, b) => a.order - b.order);
    for (const c of categories) {
        // Синий агрегат — только если по стандартной цене были занятия.
        if (c.standard.count > 0) {
            lessonRows.push({
                label: c.name,
                count: c.standard.count,
                unitPrice: num(c.standard.unitPrice),
                total: num(c.standard.total),
                blue: true,
            });
        }
        // Белые строки-исключения.
        for (const ex of c.exceptions) {
            lessonRows.push({
                label: exceptionLabel(c.name, ex.specialistName, ex.patientName, ex.note),
                count: ex.count,
                unitPrice: num(ex.unitPrice),
                total: num(ex.total),
                blue: false,
            });
        }
    }

    const afkRows: AfkRow[] = r.afk.rows.map((row) => ({
        label: row.label,
        count: row.count,
        unitPrice: num(row.unitPrice),
        total: num(row.total),
    }));

    return {
        brandName: r.branch.brandName || r.branch.name || p.brandName || "Academy KG",
        date: p.date,
        dateLabel: dayjs(p.date).format("DD.MM.YYYY"),

        lessonRows,
        lessonsTotalCount: r.lessons.totals.count,
        lessonsTotalSum: num(r.lessons.totals.total),

        afkRows,
        afkTotalCount: r.afk.totals.count,
        afkTotalSum: num(r.afk.totals.total),
    };
}
