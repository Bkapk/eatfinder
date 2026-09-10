/**
 * The map pane changes width without the window changing size — the grid/map
 * toggle, the filter drawer, the mobile switch. mapbox-gl ships no
 * ResizeObserver of its own, so if this wiring goes the canvas keeps painting
 * at its old size and half the pane is blank until a refresh.
 */
import { render } from '@testing-library/react'

const mockResize = jest.fn()

jest.mock('react-map-gl/mapbox', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef(function MockMap(props: { children?: unknown }, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ resize: mockResize }))
      return React.createElement('div', null, props.children as never)
    }),
    Source: () => null,
    Layer: () => null,
    Popup: () => null,
    NavigationControl: () => null,
    GeolocateControl: () => null,
    useMap: () => ({ current: null }),
  }
})

import MapPane from '../components/map/MapPane'

const noop = () => {}
let observed: Element[] = []
let callbacks: Array<() => void> = []
const fire = () => callbacks.forEach((cb) => cb())

beforeAll(() => {
  // jsdom has no ResizeObserver. This one hands every callback back — the pane
  // is not the only thing inside MapPane that observes its own box.
  ;(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    constructor(cb: () => void) {
      callbacks.push(cb)
    }
    observe(el: Element) {
      observed.push(el)
    }
    disconnect() {}
  }
  jest.useFakeTimers()
})

afterAll(() => jest.useRealTimers())

beforeEach(() => {
  observed = []
  callbacks = []
  mockResize.mockClear()
})

it('resizes the map when its container resizes', () => {
  const { container } = render(
    <MapPane
      token="pk.test"
      locale="sq"
      points={[]}
      items={[]}
      facets={{ cuisines: {}, tags: {}, neighborhoods: {}, priceLevels: {} }}
      selectedCuisines={[]}
      hoveredId={null}
      view="map"
      onHover={noop}
      onView={noop}
      onPatch={noop}
      onSearchArea={noop}
      onLocate={noop}
    />
  )

  // The pane itself is observed, not the window and not the canvas.
  expect(observed).toContain(container.firstChild)

  // Debounced: many observed frames must collapse into one buffer realloc, or
  // the map strobes for the length of every slide and every window drag.
  fire()
  fire()
  fire()
  expect(mockResize).not.toHaveBeenCalled()
  jest.runAllTimers()
  expect(mockResize).toHaveBeenCalledTimes(1)
})
