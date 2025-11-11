/**
 * Scoring algorithm for restaurant recommendations
 */

export interface RecommendationParams {
  wantHeavy: number // 0-100
  wantHungry: number // 0-100
  wantFinedine: number // 0-100
  cuisines?: string[] // optional selected cuisines
  maxPrice?: number // optional max price level (1-4)
  fastOnly?: boolean // optional flag for fast food only
}

export interface RestaurantForScoring {
  id: string
  heaviness: number
  portionSize: number
  fineDining: number
  priceLevel: number
  cuisines: string[]
  avgPrepTime: number
}

export interface ScoredRestaurant extends RestaurantForScoring {
  score: number
}

/**
 * Calculate recommendation score for a restaurant
 */
export function calculateScore(
  restaurant: RestaurantForScoring,
  params: RecommendationParams
): number {
  const { wantHeavy, wantHungry, wantFinedine, cuisines, maxPrice, fastOnly } = params

  // Base score: inverse distance from desired values (max 100 per dimension)
  const heavinessScore = 100 - Math.abs(wantHeavy - restaurant.heaviness)
  const portionScore = 100 - Math.abs(wantHungry - restaurant.portionSize)
  const fineDiningScore = 100 - Math.abs(wantFinedine - restaurant.fineDining)

  let score = heavinessScore + portionScore + fineDiningScore
  let cuisineBonus = 0
  let priceAdjustment = 0
  let prepTimePenalty = 0

  // Cuisine bonus: +50 if at least one selected cuisine matches, -50 if no match
  if (cuisines && cuisines.length > 0) {
    const hasMatchingCuisine = cuisines.some((c) =>
      restaurant.cuisines.some((rc) => rc.toLowerCase() === c.toLowerCase())
    )
    if (hasMatchingCuisine) {
      cuisineBonus = 50 // Strong bonus for matching cuisine
    } else {
      cuisineBonus = -50 // Penalty for not matching
    }
    score += cuisineBonus
  }

  // Price bonus/penalty
  if (maxPrice !== undefined) {
    if (restaurant.priceLevel <= maxPrice) {
      priceAdjustment = 5
    } else {
      priceAdjustment = -10
    }
    score += priceAdjustment
  }

  // Fast food penalty (if fastOnly is true, penalize slow restaurants)
  if (fastOnly && restaurant.avgPrepTime > 20) {
    prepTimePenalty = -restaurant.avgPrepTime / 2
    score += prepTimePenalty
  }

  return Math.round(score * 100) / 100 // Round to 2 decimal places
}

/**
 * Score and sort restaurants
 */
export function scoreAndSort(
  restaurants: RestaurantForScoring[],
  params: RecommendationParams
): ScoredRestaurant[] {
  return restaurants
    .map((restaurant) => ({
      ...restaurant,
      score: calculateScore(restaurant, params),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12) // Top 12
}

