/**
 * On a client navigation a slot with no match for the new URL keeps showing
 * what it had. Without this, going from an open flyout to / or /saved (Explore
 * tab, router.push('/')) left the old listing on top of the new page.
 */
export default function NoFlyout() {
  return null
}
