import { apiFetch } from "../../utility/apiClient";
import { branchWallTime } from "../../utility/branchTime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppointmentServiceLike = {
  sellableItem?: string | { id?: string; name?: string; displayName?: string } | null;
  performer?: string | { id?: string; fullName?: string; full_name?: string; name?: string } | null;
  quantity?: number | string | null;
};

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? value : [];

const getString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return "";
};

function pickSingleMatch<T>(
  items: T[],
  rawInput: string,
  getCandidates: (item: T) => string[],
): T | null {
  if (items.length === 0) return null;
  const input = normalizeText(rawInput);

  const exact = items.filter((item) =>
    getCandidates(item).some((candidate) => normalizeText(candidate) === input),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const includes = items.filter((item) =>
    getCandidates(item).some((candidate) => normalizeText(candidate).includes(input)),
  );
  if (includes.length === 1) return includes[0];
  return null;
}

async function resolveEmployeeId(input: string): Promise<string | null> {
  const value = input.trim();
  if (!value) return null;
  if (UUID_RE.test(value)) return value;

  const searchRes: any = await apiFetch(
    `/api/v1/employees/?search=${encodeURIComponent(value)}&pageSize=20`,
  );
  const searchResults: any[] = searchRes?.data?.results ?? searchRes?.results ?? [];
  let match = pickSingleMatch(searchResults, value, (item) => [
    getString(item?.fullName, item?.full_name, item?.name, item?.nickname),
  ]);

  if (!match) {
    const fallbackRes: any = await apiFetch("/api/v1/employees/?pageSize=200");
    const fallbackResults: any[] = fallbackRes?.data?.results ?? fallbackRes?.results ?? [];
    match = pickSingleMatch(fallbackResults, value, (item) => [
      getString(item?.fullName, item?.full_name, item?.name, item?.nickname),
    ]);
  }

  if (!match) {
    throw new Error("Не удалось однозначно определить специалиста. Укажите UUID или точное ФИО.");
  }

  return getString(match.id);
}

async function resolveServiceId(input: string): Promise<string> {
  const value = input.trim();
  if (!value) {
    throw new Error("Укажите услугу для приёма.");
  }
  if (UUID_RE.test(value)) return value;

  const searchRes: any = await apiFetch(
    `/api/v1/sellable-items/?type=service&isActive=true&search=${encodeURIComponent(value)}&pageSize=20`,
  );
  const searchResults: any[] = searchRes?.data?.results ?? searchRes?.results ?? [];
  let match = pickSingleMatch(searchResults, value, (item) => [
    getString(item?.displayName, item?.display_name, item?.name, item?.service?.name),
  ]);

  if (!match) {
    const fallbackRes: any = await apiFetch("/api/v1/sellable-items/?type=service&isActive=true&pageSize=200");
    const fallbackResults: any[] = fallbackRes?.data?.results ?? fallbackRes?.results ?? [];
    match = pickSingleMatch(fallbackResults, value, (item) => [
      getString(item?.displayName, item?.display_name, item?.name, item?.service?.name),
    ]);
  }

  if (!match) {
    throw new Error("Не удалось однозначно определить услугу. Укажите UUID или точное название.");
  }

  const serviceId = getString(match.id);
  if (!serviceId) {
    throw new Error("API вернул услугу без идентификатора.");
  }
  return serviceId;
}

function buildServicePayload(serviceId: string, performerId: string | null, quantity = 1) {
  return {
    sellableItem: serviceId,
    performer: performerId ?? null,
    quantity,
  };
}

export async function createPatientVisit(params: {
  patientId: string;
  dateTime: string;
  doctorInput: string;
  serviceInput: string;
}) {
  const appointmentAt = branchWallTime(params.dateTime);
  if (!appointmentAt.isValid()) {
    throw new Error("Укажите корректные дату и время.");
  }

  const [serviceId, performerId] = await Promise.all([
    resolveServiceId(params.serviceInput),
    resolveEmployeeId(params.doctorInput),
  ]);

  return apiFetch("/api/v1/appointments/", {
    method: "POST",
    body: JSON.stringify({
      patient: params.patientId,
      appointmentAt: appointmentAt.toISOString(),
      services: [buildServicePayload(serviceId, performerId)],
    }),
  });
}

function matchesCurrentValue(input: string, currentId: string, currentName: string): boolean {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return false;
  return normalizedInput === normalizeText(currentId) || normalizedInput === normalizeText(currentName);
}

export async function updatePatientVisit(params: {
  appointmentId: string;
  dateTime: string;
  doctorInput: string;
  serviceInput: string;
}) {
  const appointmentAt = branchWallTime(params.dateTime);
  if (!appointmentAt.isValid()) {
    throw new Error("Укажите корректные дату и время.");
  }

  const detailRes: any = await apiFetch(`/api/v1/appointments/${params.appointmentId}/`);
  const detail = detailRes?.data ?? detailRes;
  const currentServices = asArray<AppointmentServiceLike>(detail?.services);

  if (currentServices.length > 1) {
    throw new Error("Этот приём содержит несколько услуг. Измените его из полной карточки приёма.");
  }

  const currentService = currentServices[0] ?? null;
  const currentServiceId = getId(currentService?.sellableItem);
  const currentServiceName = getString(
    (currentService?.sellableItem as any)?.displayName,
    (currentService?.sellableItem as any)?.name,
  );
  const currentDoctorId = getId(currentService?.performer);
  const currentDoctorName = getString(
    (currentService?.performer as any)?.fullName,
    (currentService?.performer as any)?.full_name,
    (currentService?.performer as any)?.name,
  );

  const serviceId = matchesCurrentValue(params.serviceInput, currentServiceId, currentServiceName)
    ? currentServiceId
    : await resolveServiceId(params.serviceInput);

  const performerId = !params.doctorInput.trim()
    ? null
    : matchesCurrentValue(params.doctorInput, currentDoctorId, currentDoctorName)
      ? currentDoctorId || null
      : await resolveEmployeeId(params.doctorInput);

  const quantityRaw = currentService?.quantity;
  const quantity = Number(quantityRaw);

  return apiFetch(`/api/v1/appointments/${params.appointmentId}/`, {
    method: "PATCH",
    body: JSON.stringify({
      appointmentAt: appointmentAt.toISOString(),
      services: [buildServicePayload(serviceId, performerId, Number.isFinite(quantity) && quantity > 0 ? quantity : 1)],
    }),
  });
}
