import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import VocabPicker from '@/app/admin/components/VocabPicker'
import { VocabProvider } from '@/components/VocabProvider'
import type { Term } from '@/lib/vocab'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const term = (slug: string, labelSq: string, labelEn: string, active = true): Term => ({
  id: slug,
  kind: 'cuisine',
  slug,
  labelSq,
  labelEn,
  sortOrder: 0,
  active,
})
const terms = [term('pizza', 'Pica', 'Pizza'), term('grill', 'Qebapa & Zgarë', 'Grill & Qebapa'), term('old', 'E vjetër', 'Old', false)]

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState(initial)
  return (
    <VocabProvider terms={terms}>
      <VocabPicker kind="cuisine" label="Cuisines" multiple value={value} onChange={setValue} />
      <output data-testid="value">{value.join(',')}</output>
    </VocabProvider>
  )
}

const input = () => screen.getByRole('combobox', { name: 'Cuisines' })
const value = () => screen.getByTestId('value').textContent

test('typing filters by either label without diacritics; Enter picks, Backspace removes', () => {
  render(<Harness />)
  fireEvent.change(input(), { target: { value: 'zgare' } })
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Qebapa & ZgarëGrill & Qebapa', 'Add “zgare”'])
  fireEvent.keyDown(input(), { key: 'Enter' })
  expect(value()).toBe('grill')

  fireEvent.change(input(), { target: { value: 'pizza' } })
  fireEvent.keyDown(input(), { key: 'Enter' })
  expect(value()).toBe('grill,pizza')

  fireEvent.keyDown(input(), { key: 'Backspace' })
  expect(value()).toBe('grill')
})

test('inactive terms are not offered, but one already chosen still shows as a chip', () => {
  render(<Harness initial={['old']} />)
  expect(screen.getByRole('button', { name: 'Remove E vjetër' })).toBeTruthy()
  fireEvent.focus(input())
  expect(screen.queryByRole('option', { name: /E vjetër/ })).toBeNull()
})

test('an unknown value offers "Add", which opens both language labels', () => {
  render(<Harness />)
  fireEvent.change(input(), { target: { value: 'Gjeorgjiane' } })
  fireEvent.keyDown(input(), { key: 'Enter' }) // the only option is "Add"
  expect((screen.getByLabelText('Albanian label') as HTMLInputElement).value).toBe('Gjeorgjiane')
  expect((screen.getByLabelText('English label') as HTMLInputElement).value).toBe('Gjeorgjiane')
})
