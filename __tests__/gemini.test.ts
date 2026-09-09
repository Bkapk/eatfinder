/**
 * @jest-environment node
 */
// Exercises the retry-once-then-fail flow without a real GEMINI_API_KEY or
// network call — @google/genai is mocked so the "nonsense model" and
// "malformed JSON" cases are reproducible in CI.

const generateContent = jest.fn()
// Keep the real Type/Schema exports (lib/aiSchemas.ts needs them at module
// load) and mock only the network-calling class.
jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent } })),
}))

const ENV = { ...process.env }
beforeEach(() => {
  jest.resetModules()
  generateContent.mockReset()
  process.env = { ...ENV, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite' }
})
afterAll(() => {
  process.env = ENV
})

test('missing GEMINI_API_KEY throws AiDisabledError, not a network call', async () => {
  delete process.env.GEMINI_API_KEY
  const { scoreRestaurant, AiDisabledError } = await import('@/lib/gemini')
  await expect(
    scoreRestaurant({
      name: 'Test',
      description: '',
      address: '',
      primaryType: null,
      types: [],
      reviews: [],
      photos: [],
    })
  ).rejects.toBeInstanceOf(AiDisabledError)
  expect(generateContent).not.toHaveBeenCalled()
})

test('an out-of-range value from the model is a parse failure, retried once, then a clean failure — never a throw, never clamped', async () => {
  const badText = JSON.stringify({ ...validScoring(), scores: { ...validScoring().scores, heaviness: { value: 340, confidence: 0.5, rationale: 'x' } } })
  generateContent.mockResolvedValue({ text: badText })

  const { scoreRestaurant } = await import('@/lib/gemini')
  const result = await scoreRestaurant({
    name: 'Test',
    description: '',
    address: '',
    primaryType: null,
    types: [],
    reviews: [],
    photos: [],
  })

  expect(generateContent).toHaveBeenCalledTimes(2) // one retry, at temperature 0
  expect(generateContent.mock.calls[1][0].config.temperature).toBe(0)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.raw).toBe(badText) // the model's actual text is preserved, not discarded
    expect(result.error).toBeTruthy()
  }
})

test('a request-level failure (e.g. an invalid model id rejected by the API) also fails cleanly, never throws', async () => {
  generateContent.mockRejectedValue(new Error('models/nonsense-id is not found'))

  const { scoreRestaurant } = await import('@/lib/gemini')
  const result = await scoreRestaurant({
    name: 'Test',
    description: '',
    address: '',
    primaryType: null,
    types: [],
    reviews: [],
    photos: [],
  })

  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toMatch(/not found/)
  }
})

test('moderatePhoto fails closed: a failed call decides "pending", never "approved"', async () => {
  generateContent.mockResolvedValue({ text: 'not json' })

  const { moderatePhoto, decidePhotoModeration } = await import('@/lib/gemini')
  const result = await moderatePhoto({
    restaurantName: 'Test',
    cuisines: [],
    photo: { data: Buffer.from('x'), mimeType: 'image/jpeg' },
    existingPhotos: [],
  })
  expect(result.ok).toBe(false)

  const decision = decidePhotoModeration(result, 0.85)
  expect(decision.status).toBe('pending')
  expect(decision.wasAutoDecision).toBe(false)
})

function validScoring() {
  return {
    scores: {
      heaviness: { value: 72, confidence: 0.81, rationale: 'x' },
      portionSize: { value: 85, confidence: 0.74, rationale: 'x' },
      fineDining: { value: 30, confidence: 0.9, rationale: 'x' },
      spiceLevel: { value: 15, confidence: 0.5, rationale: 'x' },
    },
    priceLevel: { value: 2, confidence: 0.7, rationale: 'x' },
    cuisines: { value: ['Balkan'], confidence: 0.88, rationale: 'x' },
    tags: { value: [], confidence: 0.6, rationale: 'x' },
    description: { value: 'Pershkrim.', confidence: 0.75, rationale: 'x' },
    neighborhood: { value: 'Qendra', confidence: 0.4, rationale: 'x' },
    overallConfidence: 0.72,
    insufficientEvidence: false,
  }
}
