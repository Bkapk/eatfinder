// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'


// jsdom has no matchMedia. Report a desktop pointer, the layout the map tests
// were written against; a test that needs the phone layout can override it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
