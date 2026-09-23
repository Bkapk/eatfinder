/** Only return an internal path to client-side navigation after authentication. */
export function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}
