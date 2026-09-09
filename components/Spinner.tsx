/**
 * The one spinner. The visible ring is a circle with a single coloured edge —
 * `border-b-2 border-primary` IS the spinner, not a stray border, which is why
 * the design hook flags this markup and why the finding is a false positive.
 *
 * No hooks and no 'use client': usable from server and client components alike.
 * `role="status"` plus the sr-only label is the reason this is a component and
 * not a copy-pasted div — a bare spinning box announces nothing.
 */
export default function Spinner({
  size = 32,
  label = 'Loading',
  className = '',
}: {
  size?: number
  label?: string
  className?: string
}) {
  return (
    <span role="status" className={`inline-flex items-center ${className}`}>
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="animate-spin rounded-full border-b-2 border-primary"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
