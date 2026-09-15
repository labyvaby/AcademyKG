import { nowInBranch } from "../../utility/branchTime";

export type CashboxPreset = "today" | "yesterday" | "week" | "month" | "custom";

export type CashboxPeriod = {
    preset: CashboxPreset;
    /** YYYY-MM-DD */
    dateFrom: string;
    /** YYYY-MM-DD */
    dateTo: string;
};

const FMT = "YYYY-MM-DD";

// «Сегодня» считаем по часам филиала: у Ферганы (UTC+5) сутки начинаются
// на час позже, чем у Бишкека.
export const periodForPreset = (preset: Exclude<CashboxPreset, "custom">): CashboxPeriod => {
    const today = nowInBranch().startOf("day");
    switch (preset) {
        case "yesterday": {
            const d = today.subtract(1, "day").format(FMT);
            return { preset, dateFrom: d, dateTo: d };
        }
        case "week":
            return { preset, dateFrom: today.subtract(6, "day").format(FMT), dateTo: today.format(FMT) };
        case "month":
            return { preset, dateFrom: today.startOf("month").format(FMT), dateTo: today.format(FMT) };
        case "today":
        default:
            return { preset: "today", dateFrom: today.format(FMT), dateTo: today.format(FMT) };
    }
};

export const CASHBOX_DATE_FORMAT = FMT;
