export function normalizeSearch(value: string | null): string | null {
  return value === null
    ? null
    : value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}
