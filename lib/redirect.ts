/** Only return an internal path to client-side navigation after authentication. */
export function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}

/**
 * Where the single login page sends someone. `next` must already have been
 * through safeReturnPath ('' = none). Admins land on the dashboard unless they
 * were bounced from a specific page; community users never get sent into
 * /admin (they would only be bounced straight back out by the admin layout).
 */
export function postLoginPath(role: string, next: string): string {
  if (role === 'admin') return next || '/admin'
  return next && !/^\/admin(?:[/?#]|$)/.test(next) ? next : '/account'
}
