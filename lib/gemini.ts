import { GoogleGenAI, type Part } from '@google/genai'
import { z } from 'zod'
import {
  restaurantScoringResultSchema,
  restaurantScoringGeminiSchema,
  photoModerationResultSchema,
  photoModerationGeminiSchema,
  type RestaurantScoringResult,
  type PhotoModerationResult,
} from './aiSchemas'

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

export class AiDisabledError extends Error {}

// Read lazily, inside the calling function, never at module load — same
// precedent as secret() in lib/auth.ts and apiKey() in lib/places.ts. A
// missing key must fail the request that needs it, not the build.
function apiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new AiDisabledError('AI enrichment is disabled: GEMINI_API_KEY is not set')
  }
  return key
}

function modelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

/** Throws AiDisabledError up front, before a route does any per-item work. */
export function assertAiEnabled(): void {
  apiKey()
}

let cachedClient: { client: GoogleGenAI; key: string } | null = null

function client(): GoogleGenAI {
  const key = apiKey()
  if (cachedClient && cachedClient.key === key) return cachedClient.client
  const c = new GoogleGenAI({ apiKey: key })
  cachedClient = { client: c, key }
  return c
}

/**
 * Result of one structured Gemini call, after the retry-once-then-fail flow.
 * `ok: false` covers both a request-level failure (network, HTTP error) and
 * a validation failure (bad JSON, zod rejection) — either way `raw` holds
 * whatever text the model last produced, for the operator to see, and the
 * caller must never write anything to the database on this branch except a
 * `failed`/`pending` record. Values are never clamped into range.
 */
type StructuredResult<T> =
  | { ok: true; data: T; raw: string; model: string }
  | { ok: false; raw: string | null; error: string; model: string }

async function callStructured<T>(
  parts: Part[],
  geminiSchema: object,
  zodSchema: z.ZodType<T>,
  temperature?: number
): Promise<{ raw: string | null; parsed: T | null; error: string | null }> {
  let response
  try {
    response = await client().models.generateContent({
      model: modelName(),
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema as never,
        ...(temperature !== undefined ? { temperature } : {}),
      },
    })
  } catch (error: any) {
    return { raw: null, parsed: null, error: error?.message ?? 'Gemini request failed' }
  }

  const raw = response.text ?? ''
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { raw, parsed: null, error: 'Response was not valid JSON' }
  }

  const result = zodSchema.safeParse(json)
  if (!result.success) {
    return { raw, parsed: null, error: result.error.issues.map((i) => i.message).join('; ') }
  }
  return { raw, parsed: result.data, error: null }
}

/**
 * Runs one structured call, and on any parse failure (bad JSON, zod
 * rejection, unreachable model) retries exactly once at temperature 0 with
 * an explicit "return only the JSON object" instruction. Still bad after the
 * retry -> `ok: false`, never thrown, never clamped.
 */
async function generateStructured<T>(
  basePrompt: string,
  mediaParts: Part[],
  geminiSchema: object,
  zodSchema: z.ZodType<T>
): Promise<StructuredResult<T>> {
  // Outside callStructured's try/catch on purpose: a missing key must throw
  // AiDisabledError up to the caller (-> 503), not be swallowed into an
  // ordinary ok:false result.
  assertAiEnabled()

  const model = modelName()
  const firstParts: Part[] = [{ text: basePrompt }, ...mediaParts]
  const first = await callStructured(firstParts, geminiSchema, zodSchema)
  if (first.parsed) return { ok: true, data: first.parsed, raw: first.raw ?? '', model }

  const retryParts: Part[] = [
    { text: `${basePrompt}\n\nReturn only the JSON object.` },
    ...mediaParts,
  ]
  const retry = await callStructured(retryParts, geminiSchema, zodSchema, 0)
  if (retry.parsed) return { ok: true, data: retry.parsed, raw: retry.raw ?? '', model }

  return {
    ok: false,
    raw: retry.raw ?? first.raw,
    error: retry.error ?? first.error ?? 'Unknown error',
    model,
  }
}

// ---------------------------------------------------------------------------
// (a) Restaurant scoring
// ---------------------------------------------------------------------------

export interface ScoreRestaurantReview {
  text: string
  rating: number | null
}

export interface ScoreRestaurantPhoto {
  data: Buffer
  mimeType: string
}

export interface ScoreRestaurantInput {
  name: string
  description: string
  address: string
  primaryType: string | null
  types: string[]
  reviews: ScoreRestaurantReview[]
  /** Up to 8 photos; only the first 8 are sent. */
  photos: ScoreRestaurantPhoto[]
}

export type ScoreResult = StructuredResult<RestaurantScoringResult>

function scoringPrompt(input: ScoreRestaurantInput): string {
  const reviews = input.reviews
    .slice(0, 10)
    .map((r, i) => `${i + 1}. (${r.rating ?? '?'}/5) ${r.text}`)
    .join('\n')

  return [
    'You are scoring a restaurant in Prishtina, Kosovo for a food-discovery app.',
    'Use only the evidence given below: the name, address, category, existing description, up to 10 review excerpts and any attached photos.',
    'If there is not enough evidence to judge a field with any confidence, still return your best estimate but set overallConfidence low and insufficientEvidence to true.',
    'The "description" field MUST be written in Albanian (sq), 1-3 sentences, no more than 280 characters — it is shown to end users, not translated later.',
    'cuisines and tags MUST each be chosen only from the enum lists provided by the schema; never invent a new value.',
    '',
    `Name: ${input.name}`,
    `Address: ${input.address}`,
    `Category: ${input.primaryType ?? 'unknown'} (${input.types.join(', ') || 'none'})`,
    `Existing description: ${input.description || '(none)'}`,
    reviews ? `Reviews:\n${reviews}` : 'Reviews: (none available)',
  ].join('\n')
}

function photoToPart(photo: ScoreRestaurantPhoto): Part {
  return { inlineData: { data: photo.data.toString('base64'), mimeType: photo.mimeType } }
}

export async function scoreRestaurant(input: ScoreRestaurantInput): Promise<ScoreResult> {
  const mediaParts = input.photos.slice(0, 8).map(photoToPart)
  return generateStructured(
    scoringPrompt(input),
    mediaParts,
    restaurantScoringGeminiSchema,
    restaurantScoringResultSchema
  )
}

// ---------------------------------------------------------------------------
// (b) Photo moderation
// ---------------------------------------------------------------------------

export interface ModeratePhotoInput {
  restaurantName: string
  cuisines: string[]
  /** The uploaded photo being judged. */
  photo: ScoreRestaurantPhoto
  /** Up to 3 existing approved photos, as context for "does it match this venue". */
  existingPhotos: ScoreRestaurantPhoto[]
}

/**
 * moderatePhoto() fails closed by construction: `ok: false` and `ok: true`
 * are both safe for a caller to treat as "not a confirmed approval" — the
 * auto-publish rule below is the only path that can turn a result into an
 * approval, and it never runs on `ok: false`.
 */
export type ModerationResult = StructuredResult<PhotoModerationResult>

function moderationPrompt(input: ModeratePhotoInput): string {
  return [
    'You are moderating a photo submitted by a community member for a restaurant listing.',
    'The FIRST image is the one being judged. Any additional images are existing approved photos of the same venue, for context only.',
    'Judge whether the first image is food or venue photography appropriate for a restaurant discovery app: not NSFW, not spam/promotional (no watermarks, phone numbers, overlaid text, memes), not a screenshot or stock photo, and plausibly matches this venue.',
    '',
    `Restaurant: ${input.restaurantName}`,
    `Cuisines: ${input.cuisines.join(', ') || 'unknown'}`,
  ].join('\n')
}

export async function moderatePhoto(input: ModeratePhotoInput): Promise<ModerationResult> {
  const mediaParts = [photoToPart(input.photo), ...input.existingPhotos.slice(0, 3).map(photoToPart)]
  return generateStructured(
    moderationPrompt(input),
    mediaParts,
    photoModerationGeminiSchema,
    photoModerationResultSchema
  )
}

// ---------------------------------------------------------------------------
// Auto-publish rule (Decisions log #6, "The AI contract" in docs/PLAN.md)
// ---------------------------------------------------------------------------

export interface PhotoDecision {
  status: 'approved' | 'rejected' | 'pending'
  wasAutoDecision: boolean
  reason: string
}

/** PHOTO_AUTOPUBLISH_CONFIDENCE, read at request time. Set to 1 to hold everything. */
export function photoAutoPublishThreshold(): number {
  const raw = Number(process.env.PHOTO_AUTOPUBLISH_CONFIDENCE)
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.85
}

/**
 * Applies the auto-publish rule in code, never delegating to the model's
 * `verdict` alone (docs/PLAN.md, "Trust and safety boundaries"). Every
 * conjunct must hold for an auto-approval; a failed/absent moderation result
 * always lands here as `pending`, `wasAutoDecision: false` — fail closed.
 */
export function decidePhotoModeration(
  result: ModerationResult,
  threshold: number = photoAutoPublishThreshold()
): PhotoDecision {
  if (!result.ok) {
    return { status: 'pending', wasAutoDecision: false, reason: 'moderation unavailable' }
  }

  const v = result.data
  const autoApprove =
    v.verdict === 'approve' &&
    v.confidence >= threshold &&
    v.isFood &&
    v.depictsFoodOrVenue &&
    (v.matchesVenue === 'yes' || v.matchesVenue === 'likely') &&
    !v.isNsfw &&
    !v.isSpamOrPromotional &&
    !v.looksLikeStockOrScreenshot &&
    v.qualityScore >= 40

  if (autoApprove) {
    return { status: 'approved', wasAutoDecision: true, reason: v.reason }
  }

  if (v.verdict === 'reject' && v.confidence >= threshold) {
    return { status: 'rejected', wasAutoDecision: true, reason: v.reason }
  }

  return { status: 'pending', wasAutoDecision: false, reason: v.reason }
}
