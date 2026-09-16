import type { ServiceRow } from "../services/services";

// item.isActive — статус sellable-item (можно ли продавать)
// service.isActive — статус самой услуги в справочнике (может отличаться независимо)
function isItemActive(item: any): boolean {
  return item?.isActive !== false;
}

function isServiceActive(item: any): boolean {
  return item?.service?.isActive !== false;
}

function isNotDeleted(item: any): boolean {
  return item?.isDeleted !== true && item?.is_deleted !== true;
}

/**
 * Проверяет, можно ли показывать sellable-item в списке услуг для продажи.
 *
 * Backend (commit a3f7b95) гарантирует, что GET /api/v1/sellable-items/?type=service&isActive=true
 * не возвращает soft-deleted сервисы — дополнительный запрос к /api/v1/services/ не нужен.
 */
export function isValidSellableService(item: any): boolean {
  if (!isItemActive(item)) return false;
  if (!isServiceActive(item)) return false;
  if (!isNotDeleted(item)) return false;

  const serviceId = item?.service?.id;
  if (!serviceId) return false;

  return true;
}

export function mapSellableToServiceRow(item: any): ServiceRow {
  const row: ServiceRow = {
    id: String(item.id ?? ""),
    name: item.displayName ?? item.service?.name ?? "",
    price: item.displayPrice != null ? Number(item.displayPrice) : undefined,
    is_active: item.isActive ?? true,
    isGroup: item.isGroup ?? item.is_group ?? item.service?.isGroup ?? item.service?.is_group ?? false,
    maxParticipants: item.maxParticipants ?? null,
    durationMinutes: item.durationMinutes ?? item.duration_minutes ?? item.service?.durationMinutes ?? null,
    employee_ids: item.employeeIds ?? [],
  };

  if (process.env.NODE_ENV === "development" && (!row.id || !row.name)) {
    console.warn("[mapSellableToServiceRow] Invalid service row — missing id or name", item);
  }

  return row;
}
