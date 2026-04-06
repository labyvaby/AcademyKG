import { apiFetch } from "./apiClient";

export async function fetchAllPages<T = any>(path: string, pageSize = 200): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const res: any = await apiFetch(`${path}${separator}page=${page}&pageSize=${pageSize}`);
    const data = res?.data ?? res;
    const results: T[] = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(res?.results)
        ? res.results
        : Array.isArray(data)
          ? data
          : Array.isArray(res)
            ? res
            : [];

    items.push(...results);

    const next = data?.next ?? res?.next;
    const countRaw = data?.count ?? res?.count;
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);

    if (typeof next === "string") {
      if (!next) break;
      page += 1;
      continue;
    }

    if (Number.isFinite(count)) {
      if (items.length >= count) break;
      page += 1;
      continue;
    }

    if (results.length < pageSize) break;
    page += 1;
  }

  return items;
}
