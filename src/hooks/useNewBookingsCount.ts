import { useQuery } from "@tanstack/react-query";

import { PERMISSIONS } from "../constants/permissions";
import { countNewBookings } from "../services/bookings";
import { usePermissions } from "./usePermissions";

export const NEW_BOOKINGS_COUNT_KEY = ["bookings-new-count"] as const;

/** Сколько онлайн-заявок ждут обработки (бейдж в меню). Опрос раз в минуту, только с правом bookings.read. */
export function useNewBookingsCount(): number {
  const { hasPermission, loading } = usePermissions();
  const enabled = !loading && hasPermission(PERMISSIONS.BOOKINGS_READ);
  const { data } = useQuery({
    queryKey: NEW_BOOKINGS_COUNT_KEY,
    queryFn: countNewBookings,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return enabled ? data ?? 0 : 0;
}
