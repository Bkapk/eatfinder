import { csvRowToRestaurant, exportToCSV, parseCSV, validateCSVRow, type CSVRow } from '../lib/csv'

const valid: CSVRow = {
  name: 'Test Cafe', heaviness: '50', portionSize: '60', fineDining: '30', priceLevel: '2',
}

describe('catalogue CSV', () => {
  it('rejects partially numeric and out of range values', () => {
    expect(validateCSVRow({ ...valid, heaviness: '50oops' }, 0)).toMatch(/heaviness/)
    expect(validateCSVRow({ ...valid, lat: '91' }, 0)).toMatch(/lat/)
    expect(validateCSVRow({ ...valid, isActive: 'yes' }, 0)).toMatch(/isActive/)
    expect(validateCSVRow({ ...valid, cuisines: '{"bad":"shape"}' }, 0)).toMatch(/cuisines/)
    expect(validateCSVRow({ ...valid, websiteUrl: 'javascript:alert(1)' }, 0)).toMatch(/websiteUrl/)
  })

  it('preserves an explicit publication state through export and import', () => {
    const restaurant = { ...csvRowToRestaurant({ ...valid, isActive: 'false', cuisines: '["Mama\'s Kitchen"]' }), isActive: false }
    const csv = exportToCSV([restaurant as Parameters<typeof exportToCSV>[0][number]])
    const [row] = parseCSV(csv)
    expect(row.isActive).toBe('false')
    expect(csvRowToRestaurant(row).isActive).toBe(false)
    expect(JSON.parse(csvRowToRestaurant(row).cuisines as string)).toEqual(["Mama's Kitchen"])
  })
})
