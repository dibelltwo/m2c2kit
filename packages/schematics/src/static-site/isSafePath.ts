import * as path from "path";

/**
 * Checks if a path is safe to use.
 *
 * @remarks Checks for path traversal, absolute paths, control characters,
 *  suspicious Unicode slashes, and long paths.
 *
 * @param filepath - filepath to check
 * @returns true if the path is safe
 */
export function isSafePath(filepath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(filepath).normalize("NFC");
  } catch {
    // If decoding fails, treat as unsafe
    return false;
  }
  if (
    // Reject ASCII control chars, DEL, and suspicious Unicode slashes
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F\u2215\u29F5\u2044\uFF0F\uFF3C\u29F8\u2AFB\u2AFD]/.test(
      decoded,
    )
  ) {
    return false;
  }
  const normalized = path.posix.normalize(decoded);
  if (
    // Prevent path traversal and absolute paths
    normalized.startsWith("..") ||
    path.isAbsolute(normalized) ||
    normalized.includes("../")
  ) {
    return false;
  }
  if (decoded.length > 255) return false;
  return true;
}
