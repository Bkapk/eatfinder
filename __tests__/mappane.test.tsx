/**
 * The MAPBOX_TOKEN-absent path. app/page.tsx passes `null` down when the env
 * var is unset; if this branch ever starts touching mapbox-gl the whole front
 * door goes blank for anyone without a token, which is exactly the failure the
 * "degrade, never crash" rule exists to prevent.
 */
import { render, screen } from '@testing-library/react'
import MapPane from '../components/map/MapPane'
import { t } from '../lib/i18n'

const noop = () => {}

describe('MapPane without a Mapbox token', () => {
  it('renders the disabled panel instead of a map, and does not throw', () => {
    render(
      <MapPane
        token={null}
        locale="sq"
        points={[]}
        items={[]}
        hoveredId={null}
        view="grid"
        onHover={noop}
        onView={noop}
        onSearchArea={noop}
        onLocate={noop}
      />
    )

    expect(screen.getByText(t('sq', 'map.disabled.title'))).toBeTruthy()
    expect(screen.getByText(t('sq', 'map.disabled.body'))).toBeTruthy()
    // The view toggle stays usable with no map (the quick rail lives in the
    // header now, above both panes).
    expect(screen.getByRole('group', { name: t('sq', 'view.label') })).toBeTruthy()
  })
})
