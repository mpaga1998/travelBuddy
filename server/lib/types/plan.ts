/**
 * Structured itinerary plan: the output of the planning phase.
 * This represents the model's decision about feasibility, routing, and timing.
 */

export interface Stop {
  /** City or location name */
  location: string;
  
  /** Day number when traveler arrives (1-indexed) */
  startDay: number;
  
  /** Day number when traveler departs (1-indexed) */
  endDay: number;
  
  /** Number of nights spent at this location */
  nights: number;
  
  /** Why this location was included / reasoning for night allocation */
  reason: string;
}

export interface TransportSegment {
  /** Origin location */
  from: string;
  
  /** Destination location */
  to: string;
  
  /** Day number when transfer happens */
  day: number;
  
  /** Transportation mode (e.g., "minibus", "van", "flight") */
  mode: string;
  
  /** Realistic time estimate (e.g., "4-5 hours") */
  estimatedDuration: string;
  
  /** Cost estimate (e.g., "~800 som", "$50 USD") */
  cost: string;
}

export interface ItineraryPlan {
  /** Is this itinerary feasible? If false, see warnings/alternatives. */
  isFeasible: boolean;
  
  /** One-line summary of the planned route */
  summary: string;
  
  /** Total nights allocated (should match TripContext.totalNights) */
  totalNights: number;
  
  /** Ordered stops with day numbers and allocations */
  route: Stop[];
  
  /** Inter-location transfers */
  transportSegments: TransportSegment[];
  
  /** Issues (feasibility warnings, tight schedules, long transfers) */
  warnings: string[];
  
  /** Suggested cuts or alternatives if trip is over-ambitious */
  cutsOrAlternatives: string[];
}

/**
 * Business logic issue found during plan validation.
 */
export interface BusinessLogicIssue {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Planning result: either a valid plan or an error state.
 * May include businessIssues even on success (for warnings that don't block).
 */
export interface PlanningResult {
  success: boolean;
  plan?: ItineraryPlan;
  error?: string;
  businessIssues?: BusinessLogicIssue[];
}
