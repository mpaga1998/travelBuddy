/**
 * Structured itinerary planning types
 * Defines the intermediate plan object between input and final markdown rendering
 */

/**
 * A single stop/destination in the itinerary
 */
export interface PlanStop {
  /** City or location name */
  location: string;

  /** Day number when traveler arrives (1-indexed) */
  startDay: number;

  /** Day number when traveler leaves (inclusive) */
  endDay: number;

  /** Number of nights sleeping in this location */
  nights: number;

  /** Why this stop: rationale from the plan */
  reason: string;

  /** Key activities/highlights for this stop */
  highlights: string[];

  /** Route feasibility notes for this leg */
  notes?: string;
}

/**
 * A transport segment between two stops
 */
export interface TransportSegment {
  /** Originating location */
  from: string;

  /** Destination location */
  to: string;

  /** Day the traveler departs this leg */
  departDay: number;

  /** Estimated travel duration (e.g., "3-4 hours") */
  duration: string;

  /** Transport mode (van, minibus, flight, hiking, etc.) */
  mode: string;

  /** Cost estimate (e.g., "~800 som" or "$25-30") */
  costEstimate: string;

  /** Whether an early start is required */
  earlyStart: boolean;

  /** Specific time recommendation if critical */
  departTime?: string; // e.g., "7:00 AM"

  /** Feasibility concerns for this leg */
  notes?: string;
}

/**
 * Complete feasibility and planning analysis
 */
export interface ItineraryPlan {
  /** Is this itinerary feasible to execute? */
  isFeasible: boolean;

  /** Summary headline of the proposed route */
  summary: string;

  /** Total nights that will be spent (should match input) */
  totalNights: number;

  /** Total calendar days */
  totalCalendarDays: number;

  /** Ordered list of stops in the itinerary */
  route: PlanStop[];

  /** Transport segments between stops */
  transportSegments: TransportSegment[];

  /** If isFeasible is false, what's the problem? */
  issues: string[];

  /** Warnings about the itinerary (feasible but with risks) */
  warnings: string[];

  /** If not fully feasible, suggested alternatives or cuts */
  suggestedAlternatives: string[];

  /** Metadata: model's confidence in this plan (0-10) */
  confidence: number;

  /** Metadata: any additional notes from the planner */
  notes?: string;
}
