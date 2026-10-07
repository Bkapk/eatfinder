/** @jest-environment node */
const findUnique = jest.fn()
let cookieValue: string | undefined

jest.mock('../lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}))

import { createSession, getCurrentUser, parseSessionToken } from '../lib/auth'

process.env.SESSION_SECRET = 'x'.repeat(32)
const row = { id: 'u1', username: 'a', role: 'user', displayName: '', isBanned: false, sessionVersion: 3 }

it('accepts a token whose version matches the user', async () => {
  findUnique.mockResolvedValue(row)
  cookieValue = createSession('u1', 3)
  expect((await getCurrentUser())?.id).toBe('u1')
})

it('rejects a token issued before revokeSessions bumped the version', async () => {
  findUnique.mockResolvedValue({ ...row, sessionVersion: 4 })
  cookieValue = createSession('u1', 3)
  expect(await getCurrentUser()).toBeNull()
})

it('rejects banned users', async () => {
  findUnique.mockResolvedValue({ ...row, isBanned: true })
  cookieValue = createSession('u1', 3)
  expect(await getCurrentUser()).toBeNull()
})

it('rejects tampered, legacy 3-part and expired tokens', () => {
  const t = createSession('u1', 3)
  expect(parseSessionToken(t.replace('u1.3.', 'u2.3.'))).toBeNull()
  expect(parseSessionToken(t.replace('.3.', '.9.'))).toBeNull()
  expect(parseSessionToken('u1.9999999999999.deadbeef')).toBeNull()
  jest.useFakeTimers().setSystemTime(Date.now() + 8 * 86400_000)
  expect(parseSessionToken(t)).toBeNull()
  jest.useRealTimers()
})
