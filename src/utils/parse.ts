export const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Trimmed string from a query parameter, or "" if missing / not a string. */
export const queryString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Normalizes an optional string field.
 * - undefined / null -> `fallback`
 * - non-string, or longer than `maxLength` -> null (invalid)
 */
export function optionalString(
  value: unknown,
  maxLength: number,
  fallback = "",
): string | null {
  if (value === undefined || value === null) return fallback;

  if (typeof value !== "string") return null;

  const normalized = value.trim();

  return normalized.length <= maxLength ? normalized : null;
}
