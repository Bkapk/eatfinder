import { Type, type Schema } from '@google/genai'
import { z } from 'zod'

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

/**
 * The slugs the model may choose from. Read from VocabTerm (active terms) at
 * call time — the vocabulary is admin-managed now, so the enum is built per
 * request rather than baked in at module load.
 */
export interface ScoringVocab {
  cuisines: string[]
  tags: string[]
  neighborhoods: string[]
}

// z.enum() wants a literal tuple; this list comes from the database.
const oneOf = (allowed: string[]) =>
  z.string().refine((v) => allowed.includes(v), { message: 'not in the vocabulary' })

const enumOf = (allowed: string[]): Schema =>
  allowed.length ? { type: Type.STRING, enum: allowed } : { type: Type.STRING }

// Vocabulary-constrained arrays: the schema enum is what stops tag-space
// explosion, not a free string field. Without a vocab this is the lenient
// reader for payloads already stored (see restaurantScoringResultSchema).
const listFieldSchema = (allowed?: string[]) =>
  z
    .object({
      value: z.array(allowed ? oneOf(allowed) : z.string()).max(4),
      confidence: z.number().min(0).max(1),
      rationale: singleLine(160),
    })
    .strict()

const listFieldGeminiSchema = (allowed: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    value: { type: Type.ARRAY, maxItems: '4', items: enumOf(allowed) },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
})

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

// null = the evidence does not place it in any listed neighbourhood. Proposals
// stored before the vocabulary existed carry free text here instead.
const neighborhoodFieldSchema = (allowed?: string[]) =>
  z
    .object({
      value: (allowed ? oneOf(allowed) : z.string().max(120)).nullable(),
      confidence: z.number().min(0).max(1),
      rationale: singleLine(160),
    })
    .strict()

const neighborhoodFieldGeminiSchema = (allowed: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    value: { ...enumOf(allowed), nullable: true },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    rationale: { type: Type.STRING, maxLength: '160' },
  },
  required: ['value', 'confidence', 'rationale'],
  propertyOrdering: ['value', 'confidence', 'rationale'],
})

const scoresSchema = z.object({
  heaviness: axisFieldSchema,
  portionSize: axisFieldSchema,
  fineDining: axisFieldSchema,
})

/**
 * With a vocab: what the model must return right now — strict, every slug in
 * the vocabulary. Without one: the reader for AiProposal.payload rows already
 * in the database, which may predate the vocabulary (free-text cuisines) or
 * still carry the removed scores.spiceLevel (stripped, not rejected).
 */
export function restaurantScoringResultSchema(vocab?: ScoringVocab) {
  return z
    .object({
      scores: vocab ? scoresSchema.strict() : scoresSchema,
      priceLevel: priceLevelFieldSchema,
      cuisines: listFieldSchema(vocab?.cuisines),
      tags: listFieldSchema(vocab?.tags),
      description: descriptionFieldSchema,
      neighborhood: neighborhoodFieldSchema(vocab?.neighborhoods),
      overallConfidence: z.number().min(0).max(1),
      insufficientEvidence: z.boolean(),
    })
    .strict()
}

export type RestaurantScoringResult = z.infer<ReturnType<typeof restaurantScoringResultSchema>>

export function restaurantScoringGeminiSchema(vocab: ScoringVocab): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      scores: {
        type: Type.OBJECT,
        properties: {
          heaviness: axisFieldGeminiSchema,
          portionSize: axisFieldGeminiSchema,
          fineDining: axisFieldGeminiSchema,
        },
        required: ['heaviness', 'portionSize', 'fineDining'],
        propertyOrdering: ['heaviness', 'portionSize', 'fineDining'],
      },
      priceLevel: priceLevelFieldGeminiSchema,
      cuisines: listFieldGeminiSchema(vocab.cuisines),
      tags: listFieldGeminiSchema(vocab.tags),
      description: descriptionFieldGeminiSchema,
      neighborhood: neighborhoodFieldGeminiSchema(vocab.neighborhoods),
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
    priceLevel: r.priceLevel.value,
    cuisines: r.cuisines.value,
    tags: r.tags.value,
    description: r.description.value,
    neighborhood: r.neighborhood.value ?? '',
  }
}

/**
 * Validates an (optionally owner-edited) proposal payload before it is
 * written to Restaurant on approval — "the same zod schema a manual edit
 * uses" (docs/PLAN.md). The per-field rules mirror restaurantSchema in
 * app/api/restaurants/[id]/route.ts for exactly the fields an AI proposal
 * can touch. Vocabulary membership is checked by the route against VocabTerm
 * (checkTerms in lib/vocab.ts), the same check a manual edit gets.
 */
export const aiProposalEditSchema = z.object({
  heaviness: z.coerce.number().int().min(0).max(100),
  portionSize: z.coerce.number().int().min(0).max(100),
  fineDining: z.coerce.number().int().min(0).max(100),
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
