/** @jest-environment node */
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

it('redirects using the forwarded public host and protocol', () => {
  const request = new NextRequest('http://localhost:3009/admin/queue', {
    headers: { host: 'hajdehajme.bleart.dev', 'x-forwarded-proto': 'https' },
  })
  const response = middleware(request)
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://hajdehajme.bleart.dev/admin/login?next=%2Fadmin%2Fqueue')
})
