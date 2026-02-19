/**
 * Input Sanitization Utility
 *
 * Strips HTML tags from string values to prevent XSS/injection.
 * Recursively processes nested objects and arrays.
 */

/**
 * Strip HTML tags from a string.
 */
export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/**
 * Recursively sanitize all string values in an object or array.
 * Non-string primitives (numbers, booleans, null, undefined) pass through unchanged.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return stripHtmlTags(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  return obj;
}
