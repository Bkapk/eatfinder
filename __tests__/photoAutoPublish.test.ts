/**
 * @jest-environment node
 *
 * The auto-publish rule (docs/PLAN.md, "The AI contract") is evaluated in our
 * code, never delegated to the model's `verdict` alone: every conjunct must
 * hold. This is a pure-function test against decidePhotoModeration() — no
 * network, no Gemini mock — so the rule stays honest if it is ever "simplified"
 * later.
 */
import { decidePhotoModeration, type ModerationResult, type PhotoDecision } from '@/lib/gemini'
import type { PhotoModerationResult } from '@/lib/aiSchemas'

function okResult(overrides: Partial<PhotoModerationResult> = {}): ModerationResult {
  return {
    ok: true,
    raw: '{}',
    model: 'test',
    data: {
      isFood: true,
      depictsFoodOrVenue: true,
      matchesVenue: 'yes',
      isNsfw: false,
      isSpamOrPromotional: false,
      looksLikeStockOrScreenshot: false,
      containsIdentifiablePeople: false,
      qualityScore: 80,
      verdict: 'approve',
      confidence: 0.95,
      reason: 'Clear plated food photo.',
      ...overrides,
    },
  }
}

function expectPending(decision: PhotoDecision) {
  expect(decision.status).toBe('pending')
  expect(decision.wasAutoDecision).toBe(false)
}

test('every conjunct holding auto-approves', () => {
  const decision = decidePhotoModeration(okResult(), 0.85)
  expect(decision.status).toBe('approved')
  expect(decision.wasAutoDecision).toBe(true)
})

test('PHOTO_AUTOPUBLISH_CONFIDENCE=1 genuinely holds everything for manual review', () => {
  // confidence maxes out at 1 per the schema (z.number().min(0).max(1)), so a
  // threshold of 1 must never be satisfiable by a strictly-greater-than-0.99
  // model answer either.
  const decision = decidePhotoModeration(okResult({ confidence: 0.999999 }), 1)
  expectPending(decision)
})

test.each([
  ['verdict !== approve', { verdict: 'review' as const }],
  ['confidence below threshold', { confidence: 0.5 }],
  ['not food', { isFood: false }],
  ['does not depict food or venue', { depictsFoodOrVenue: false }],
  ['matchesVenue unknown', { matchesVenue: 'unknown' as const }],
  ['matchesVenue no', { matchesVenue: 'no' as const }],
  ['is NSFW', { isNsfw: true }],
  ['is spam/promotional', { isSpamOrPromotional: true }],
  ['looks like stock/screenshot', { looksLikeStockOrScreenshot: true }],
  ['quality below 40', { qualityScore: 39 }],
])('a single failing conjunct (%s) never auto-approves, even with verdict=approve elsewhere', (_label, override) => {
  const decision = decidePhotoModeration(okResult(override), 0.85)
  expect(decision.status).not.toBe('approved')
})

test('verdict=reject at high confidence auto-rejects, but is still a recorded decision', () => {
  const decision = decidePhotoModeration(okResult({ verdict: 'reject', confidence: 0.9 }), 0.85)
  expect(decision.status).toBe('rejected')
  expect(decision.wasAutoDecision).toBe(true)
})

test('a failed/unavailable moderation call fails closed: pending, never approved', () => {
  const failed: ModerationResult = { ok: false, raw: null, error: 'network error', model: 'test' }
  const decision = decidePhotoModeration(failed, 0.85)
  expectPending(decision)
  expect(decision.reason).toBe('moderation unavailable')
})
