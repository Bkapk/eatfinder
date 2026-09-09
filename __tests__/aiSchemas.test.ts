/**
 * @jest-environment node
 */
// jsdom (this repo's default test environment) resolves @google/genai's
// "browser" export condition, an ESM .mjs Jest's CJS transform can't parse —
// same issue as @aws-sdk/client-s3 in lib/storage.ts. node picks the
// "node" condition instead, which is a requirable .cjs.
//
// Locks in the AI contract's most quietly-softenable rule (docs/PLAN.md, "The
// AI contract"): an out-of-range model value is a parse failure, never
// clamped into range. If a future edit adds `.min(0).max(100)` clamping
// behaviour (e.g. swapping `.max()` for a transform that clamps) instead of
// rejecting, this test fails.
import {
  restaurantScoringResultSchema,
  photoModerationResultSchema,
  aiProposalEditSchema,
} from '@/lib/aiSchemas'

function validScoringPayload() {
  return {
    scores: {
      heaviness: { value: 72, confidence: 0.81, rationale: 'Grilled meat plates.' },
      portionSize: { value: 85, confidence: 0.74, rationale: 'Reviews mention huge shares.' },
      fineDining: { value: 30, confidence: 0.9, rationale: 'Counter service, plastic chairs.' },
      spiceLevel: { value: 15, confidence: 0.5, rationale: 'No chili-forward dishes.' },
    },
    priceLevel: { value: 2, confidence: 0.7, rationale: 'Mains around 6-9 EUR.' },
    cuisines: { value: ['Balkan', 'Grill'], confidence: 0.88, rationale: 'Qebapa dominate.' },
    tags: { value: ['late-night'], confidence: 0.6, rationale: 'Reviews mention 2am visits.' },
    description: { value: 'Nje vend i thjeshte per gril.', confidence: 0.75, rationale: 'From reviews.' },
    neighborhood: { value: 'Qendra', confidence: 0.4, rationale: 'Address is near the centre.' },
    overallConfidence: 0.72,
    insufficientEvidence: false,
  }
}

test('a well-formed scoring payload parses', () => {
  expect(restaurantScoringResultSchema.safeParse(validScoringPayload()).success).toBe(true)
})

test('an out-of-range axis value is REJECTED, never clamped', () => {
  const bad = validScoringPayload()
  bad.scores.heaviness.value = 340 // the exact example from docs/PLAN.md

  const result = restaurantScoringResultSchema.safeParse(bad)
  expect(result.success).toBe(false)
  // Specifically: it must not have silently become 100.
  if (!result.success) {
    expect(result.error.issues.some((i) => i.path.join('.') === 'scores.heaviness.value')).toBe(true)
  }
})

test('an out-of-range confidence (>1) is rejected', () => {
  const bad = validScoringPayload()
  bad.overallConfidence = 1.5
  expect(restaurantScoringResultSchema.safeParse(bad).success).toBe(false)
})

test('an unknown cuisine enum member is rejected, not coerced into the vocab', () => {
  const bad = validScoringPayload()
  bad.cuisines.value = ['Made Up Cuisine']
  expect(restaurantScoringResultSchema.safeParse(bad).success).toBe(false)
})

test('an extra, unrequested key is a parse failure (strict schema)', () => {
  const bad: any = validScoringPayload()
  bad.extraField = 'should not be here'
  expect(restaurantScoringResultSchema.safeParse(bad).success).toBe(false)
})

test('a missing required key is a parse failure', () => {
  const bad: any = validScoringPayload()
  delete bad.neighborhood
  expect(restaurantScoringResultSchema.safeParse(bad).success).toBe(false)
})

test('photo moderation rejects an out-of-range qualityScore and an unknown verdict', () => {
  const base = {
    isFood: true,
    depictsFoodOrVenue: true,
    matchesVenue: 'likely',
    isNsfw: false,
    isSpamOrPromotional: false,
    looksLikeStockOrScreenshot: false,
    containsIdentifiablePeople: false,
    qualityScore: 78,
    verdict: 'approve',
    confidence: 0.91,
    reason: 'Plated grilled meat, consistent with venue photos.',
  }
  expect(photoModerationResultSchema.safeParse(base).success).toBe(true)
  expect(photoModerationResultSchema.safeParse({ ...base, qualityScore: 500 }).success).toBe(false)
  expect(photoModerationResultSchema.safeParse({ ...base, verdict: 'maybe' }).success).toBe(false)
})

test('the proposal-approval edit schema also rejects an out-of-range priceLevel', () => {
  const base = {
    heaviness: 50,
    portionSize: 50,
    fineDining: 50,
    spiceLevel: 0,
    priceLevel: 2,
    cuisines: [],
    tags: [],
    description: '',
    neighborhood: '',
  }
  expect(aiProposalEditSchema.safeParse(base).success).toBe(true)
  expect(aiProposalEditSchema.safeParse({ ...base, priceLevel: 9 }).success).toBe(false)
})
