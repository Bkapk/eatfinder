/** @jest-environment node */
import bcrypt from 'bcryptjs'

const findUnique = jest.fn()
const update = jest.fn()
const setCookie = jest.fn()

jest.mock('../lib/prisma', () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}))
jest.mock('next/headers', () => ({ cookies: async () => ({ set: setCookie, get: () => undefined }) }))
jest.mock('../lib/auth', () => ({
  ...jest.requireActual('../lib/auth'),
  getCurrentUser: async () => ({ id: 'u1', username: 'a@b.c', role: 'user', displayName: 'A' }),
}))

import { POST } from '../app/api/auth/password/route'
import { parseSessionToken } from '../lib/auth'

process.env.SESSION_SECRET = 'x'.repeat(32)
const req = (body: unknown) =>
  new Request('http://x/api/auth/password', { method: 'POST', body: JSON.stringify(body) }) as never

beforeAll(async () => {
  findUnique.mockResolvedValue({ password: await bcrypt.hash('old-password', 4) })
})

it('refuses a wrong current password without touching the row', async () => {
  const res = await POST(req({ currentPassword: 'nope', newPassword: 'new-password-1' }))
  expect(res.status).toBe(400)
  expect((await res.json()).code).toBe('wrong')
  expect(update).not.toHaveBeenCalled()
})

it('rehashes, bumps sessionVersion and re-issues this browser a cookie at the new version', async () => {
  update.mockResolvedValue({ sessionVersion: 5 })
  const res = await POST(req({ currentPassword: 'old-password', newPassword: 'new-password-1' }))
  expect(res.status).toBe(200)
  const data = update.mock.calls[0][0].data
  expect(data.sessionVersion).toEqual({ increment: 1 })
  expect(await bcrypt.compare('new-password-1', data.password)).toBe(true)
  expect(parseSessionToken(setCookie.mock.calls[0][1])?.version).toBe(5)
})

it('rejects a too-short new password', async () => {
  const res = await POST(req({ currentPassword: 'old-password', newPassword: 'short' }))
  expect((await res.json()).code).toBe('invalid')
})
