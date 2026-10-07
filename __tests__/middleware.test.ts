/** @jest-environment node */
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

it('redirects using the forwarded public host and protocol', () => {
  const request = new NextRequest('http://localhost:3009/admin/queue', {
    headers: { host: 'hajdehajme.bleart.dev', 'x-forwarded-proto': 'https' },
  })
  const response = middleware(request)
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://hajdehajme.bleart.dev/account/login?next=%2Fadmin%2Fqueue')
})

describe('CSRF origin check on /api', () => {
  const post = (headers: Record<string, string>) =>
    middleware(new NextRequest('http://localhost:3000/api/community/favorites', {
      method: 'POST',
      headers: { host: 'hajdehajme.bleart.dev', ...headers },
    }))

  it('allows same-origin POSTs', () => {
    expect(post({ origin: 'https://hajdehajme.bleart.dev' }).status).toBe(200)
  })

  it.each([
    [{ origin: 'https://evil.bleart.dev' }],
    [{ origin: 'null' }],
    [{ 'sec-fetch-site': 'same-site' }],
  ])('rejects %o', (headers) => {
    expect(post(headers).status).toBe(403)
  })

  it('leaves GETs alone', () => {
    const res = middleware(new NextRequest('http://localhost:3000/api/recommend', {
      headers: { host: 'a.example', origin: 'https://evil.example' },
    }))
    expect(res.status).toBe(200)
  })
})
