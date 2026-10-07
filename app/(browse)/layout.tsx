/**
 * Explore and Saved, the two screens a listing opens over as a flyout. The
 * @modal slot lives here and not in the root layout on purpose: a place opened
 * from anywhere else (account, login's ?next=, the full listing page's own
 * similar places) should be a page, and leaving this group for any of those
 * unmounts the slot with it, so a flyout can never be left behind on them.
 */
export default function BrowseLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
