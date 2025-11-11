import { calculateScore, scoreAndSort, RecommendationParams } from '../lib/scoring'

describe('Scoring Algorithm', () => {
  const mockRestaurant = {
    id: '1',
    heaviness: 50,
    portionSize: 50,
    fineDining: 50,
    priceLevel: 2,
    cuisines: ['Italian'],
    avgPrepTime: 30,
  }

  describe('calculateScore', () => {
    it('should return perfect score when all values match', () => {
      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
      }

      const score = calculateScore(mockRestaurant, params)
      expect(score).toBe(300) // 100 + 100 + 100
    })

    it('should penalize mismatches proportionally', () => {
      const params: RecommendationParams = {
        wantHeavy: 0, // 50 points off
        wantHungry: 50,
        wantFinedine: 50,
      }

      const score = calculateScore(mockRestaurant, params)
      expect(score).toBe(250) // 50 + 100 + 100
    })

    it('should add cuisine bonus when cuisine matches', () => {
      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
        cuisines: ['Italian'],
      }

      const score = calculateScore(mockRestaurant, params)
      expect(score).toBe(308) // 300 + 8
    })

    it('should add price bonus when within budget', () => {
      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
        maxPrice: 2,
      }

      const score = calculateScore(mockRestaurant, params)
      expect(score).toBe(305) // 300 + 5
    })

    it('should penalize when over budget', () => {
      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
        maxPrice: 1,
      }

      const score = calculateScore(mockRestaurant, params)
      expect(score).toBe(290) // 300 - 10
    })

    it('should penalize slow restaurants when fastOnly is true', () => {
      const slowRestaurant = {
        ...mockRestaurant,
        avgPrepTime: 40,
      }

      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
        fastOnly: true,
      }

      const score = calculateScore(slowRestaurant, params)
      expect(score).toBe(280) // 300 - 20 (40/2)
    })
  })

  describe('scoreAndSort', () => {
    it('should sort restaurants by score descending', () => {
      const restaurants = [
        { ...mockRestaurant, id: '1', heaviness: 50 },
        { ...mockRestaurant, id: '2', heaviness: 0 },
        { ...mockRestaurant, id: '3', heaviness: 100 },
      ]

      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
      }

      const scored = scoreAndSort(restaurants, params)
      expect(scored[0].id).toBe('1') // Perfect match
      expect(scored[0].score).toBeGreaterThan(scored[1].score)
    })

    it('should return top 12 restaurants', () => {
      const restaurants = Array.from({ length: 20 }, (_, i) => ({
        ...mockRestaurant,
        id: String(i),
        heaviness: i * 5,
      }))

      const params: RecommendationParams = {
        wantHeavy: 50,
        wantHungry: 50,
        wantFinedine: 50,
      }

      const scored = scoreAndSort(restaurants, params)
      expect(scored.length).toBe(12)
    })
  })
})

