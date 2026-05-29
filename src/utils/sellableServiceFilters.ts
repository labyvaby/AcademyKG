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
 * validServiceIds — Set ID-ов из /api/v1/services/?isActive=true.
 * Используется как единственный способ отфильтровать soft-deleted сервисы,
 * поскольку API sellable-items не возвращает поля isDeleted и не гарантирует
 * их отсутствие при запросе isActive=true.
 * Если Set пустой (запрос ещё не загружен) — проверка по нему пропускается.
 */
export function isValidSellableService(
  item: any,
  validServiceIds: Set<string>
): boolean {
  if (!isItemActive(item)) return false;
  if (!isServiceActive(item)) return false;
  if (!isNotDeleted(item)) return false;

  const serviceId = item?.service?.id;
  if (!serviceId) return false;

  if (validServiceIds.size > 0) {
    return validServiceIds.has(String(serviceId));
  }

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
    durationMinutes: item.durationMinutes ?? null,
    employee_ids: item.employeeIds ?? [],
  };

  if (process.env.NODE_ENV === "development" && (!row.id || !row.name)) {
    console.warn("[mapSellableToServiceRow] Invalid service row — missing id or name", item);
  }

  return row;
}
