/**
 * Persistent cache for appointment details (DISABLED).
 * Removed as per requirements to avoid using localStorage for state.
 */

const CACHE_KEY = "appt_details_cache";

// Clear existing cache on module load
try {
  localStorage.removeItem(CACHE_KEY);
} catch { /* ignore */ }

export function getCachedDetail(id: string): any | null {
  return null;
}

export function setCachedDetail(id: string, detail: any) {
  // Disabled
}
