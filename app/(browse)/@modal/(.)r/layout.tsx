import { Flyout } from '@/components/detail/Flyout'

/** One sheet for every place opened in it; see Flyout. */
export default function FlyoutLayout({ children }: { children: React.ReactNode }) {
  return <Flyout>{children}</Flyout>
}
