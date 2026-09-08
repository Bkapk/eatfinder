import { Type, type Schema } from '@google/genai'
import { z } from 'zod'
import { CUISINE_VOCAB, TAG_VOCAB } from './types'

/**
 * The Gemini `responseSchema` objects and their mirror zod schemas for both
 * AI calls, defined side by side so they cannot drift. Structured output
 * constrains decoding; zod is what protects the database — see "The AI
 * contract" in docs/PLAN.md. Values are never clamped: an out-of-range
 * number, an unknown enum member, a missing key or an extra key are all
 * parse failures, handled by the retry-once-then-fail flow in lib/gemini.ts.
 */

// A rationale/reason must be a single line, short enough to render inline in
// the review queue next to a confidence bar.
const singleLine = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => !s.includes('\n'), { message: 'must be a single line' })

// ---------------------------------------------------------------------------
// (a) Restaurant scoring — scoreRestaurant()
// ---------------------------------------------------------------------------

const axisFieldSchema = z
  .object({
    value: z.number().int().min(0).max(100),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const axisFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

const priceLevelFieldSchema = z
  .object({
    value: z.number().int().min(1).max(4),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const priceLevelFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.INTEGER, minimum: 1, maximum: 4 },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

// Vocabulary-constrained arrays: the schema enum is what stops tag-space
// explosion, not a free string field.
const cuisinesFieldSchema = z
  .object({
    value: z.array(z.enum(CUISINE_VOCAB)).max(4),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const cuisinesFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.ARRAY,
      maxItems: '4',
      items: { type: Type.STRING, enum: [...CUISINE_VOCAB] },
    },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

const tagsFieldSchema = z
  .object({
    value: z.array(z.enum(TAG_VOCAB)).max(4),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const tagsFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.ARRAY,
      maxItems: '4',
      items: { type: Type.STRING, enum: [...TAG_VOCAB] },
    },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

// description is restaurant data, not chrome — written in Albanian per the
// Decisions log (item 5), because the public UI ships Albanian-first.
const descriptionFieldSchema = z
  .object({
    value: z.string().min(1).max(280),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const descriptionFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, maxLength: '280' },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

const neighborhoodFieldSchema = z
  .object({
    value: z.string().max(120),
    confidence: z.number().min(0).max(1),
    rationale: singleLine(160),
  })
  .strict()

const neighborhoodFieldGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, maxLength: '120' },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
}

export const restaurantScoringResultSchema = z
  .object({
    scores: z
      .object({
        heaviness: axisFieldSchema,
        portionSize: axisFieldSchema,
        fineDining: axisFieldSchema,
        spiceLevel: axisFieldSchema,
      })
      .strict(),
    priceLevel: priceLevelFieldSchema,
    cuisines: cuisinesFieldSchema,
    tags: tagsFieldSchema,
    description: descriptionFieldSchema,
    neighborhood: neighborhoodFieldSchema,
    overallConfidence: z.number().min(0).max(1),
    insufficientEvidence: z.boolean(),
  })
  .strict()

export type RestaurantScoringResult = z.infer<typeof restaurantScoringResultSchema>

export const restaurantScoringGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.OBJECT,
      properties: {
        heaviness: axisFieldGeminiSchema,
        portionSize: axisFieldGeminiSchema,
        fineDining: axisFieldGeminiSchema,
        spiceLevel: axisFieldGeminiSchema,
      },
      required: ['heaviness', 'portionSize', 'fineDining', 'spiceLevel'],
      propertyOrdering: ['heaviness', 'portionSize', 'fineDining', 'spiceLevel'],
    },
    priceLevel: priceLevelFieldGeminiSchema,
    cuisines: cuisinesFieldGeminiSchema,
    tags: tagsFieldGeminiSchema,
    description: descriptionFieldGeminiSchema,
    neighborhood: neighborhoodFieldGeminiSchema,
    overallConfidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    insufficientEvidence: { type: Type.BOOLEAN },
  },
  required: [
    'scores',
    'priceLevel',
    'cuisines',
    'tags',
    'description',
    'neighborhood',
    'overallConfidence',
    'insufficientEvidence',
  ],
  propertyOrdering: [
    'scores',
    'priceLevel',
    'cuisines',
    'tags',
    'description',
    'neighborhood',
    'overallConfidence',
    'insufficientEvidence',
  ],
}

/**
 * The flat, editable field shape a manual edit and an approved AI proposal
 * both write to Restaurant. Pulls the `.value` out of every scored field —
 * confidence and rationale are for the review queue's display only, never
 * written to the catalogue.
 */
export interface RestaurantProposalFields {
  heaviness: number
  portionSize: number
  fineDining: number
  spiceLevel: number
  priceLevel: number
  cuisines: string[]
  tags: string[]
  description: string
  neighborhood: string
}

export function flattenScoringResult(r: RestaurantScoringResult): RestaurantProposalFields {
  return {
    heaviness: r.scores.heaviness.value,
    portionSize: r.scores.portionSize.value,
    fineDining: r.scores.fineDining.value,
    spiceLevel: r.scores.spiceLevel.value,
    priceLevel: r.priceLevel.value,
    cuisines: r.cuisines.value,
    tags: r.tags.value,
    description: r.description.value,
    neighborhood: r.neighborhood.value,
  }
}

/**
 * Validates an (optionally owner-edited) proposal payload before it is
 * written to Restaurant on approval — "the same zod schema a manual edit
 * uses" (docs/PLAN.md). The per-field rules mirror restaurantSchema in
 * app/api/restaurants/[id]/route.ts for exactly the fields an AI proposal
 * can touch; that schema is not exported and that file is out of scope here,
 * so the constraints are intentionally duplicated rather than imported.
 */
export const aiProposalEditSchema = z.object({
  heaviness: z.coerce.number().int().min(0).max(100),
  portionSize: z.coerce.number().int().min(0).max(100),
  fineDining: z.coerce.number().int().min(0).max(100),
  spiceLevel: z.coerce.number().int().min(0).max(100),
  priceLevel: z.coerce.number().int().min(1).max(4),
  cuisines: z.array(z.string()).max(4),
  tags: z.array(z.string()).max(4),
  description: z.string().max(280),
  neighborhood: z.string().max(120),
})

// ---------------------------------------------------------------------------
// (b) Photo moderation — moderatePhoto()
// ---------------------------------------------------------------------------

export const photoModerationResultSchema = z
  .object({
    isFood: z.boolean(),
    depictsFoodOrVenue: z.boolean(),
    matchesVenue: z.enum(['yes', 'likely', 'unknown', 'no']),
    isNsfw: z.boolean(),
    isSpamOrPromotional: z.boolean(),
    looksLikeStockOrScreenshot: z.boolean(),
    containsIdentifiablePeople: z.boolean(),
    qualityScore: z.number().int().min(0).max(100),
    verdict: z.enum(['approve', 'review', 'reject']),
    confidence: z.number().min(0).max(1),
    reason: singleLine(160),
  })
  .strict()

export type PhotoModerationResult = z.infer<typeof photoModerationResultSchema>

export const photoModerationGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    isFood: { type: Type.BOOLEAN },
    depictsFoodOrVenue: { type: Type.BOOLEAN },
    matchesVenue: { type: Type.STRING, enum: ['yes', 'likely', 'unknown', 'no'] },
    isNsfw: { type: Type.BOOLEAN },
    isSpamOrPromotional: { type: Type.BOOLEAN },
    looksLikeStockOrScreenshot: { type: Type.BOOLEAN },
    containsIdentifiablePeople: { type: Type.BOOLEAN },
    qualityScore: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    verdict: { type: Type.STRING, enum: ['approve', 'review', 'reject'] },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    reason: { type: Type.STRING, maxLength: '160' },
  },
  required: [
    'isFood',
    'depictsFoodOrVenue',
    'matchesVenue',
    'isNsfw',
    'isSpamOrPromotional',
    'looksLikeStockOrScreenshot',
    'containsIdentifiablePeople',
    'qualityScore',
    'verdict',
    'confidence',
    'reason',
  ],
  propertyOrdering: [
    'isFood',
    'depictsFoodOrVenue',
    'matchesVenue',
    'isNsfw',
    'isSpamOrPromotional',
    'looksLikeStockOrScreenshot',
    'containsIdentifiablePeople',
    'qualityScore',
    'verdict',
    'confidence',
    'reason',
  ],
}
