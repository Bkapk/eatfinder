// `/` itself: the [...rest] catch-all can't match the root (an optional
// [[...rest]] would, but next dev rejects it next to (browse)/page.tsx).
export { default } from './[...rest]/page'
