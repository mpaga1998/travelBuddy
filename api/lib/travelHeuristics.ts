/**
 * Travel Heuristics Layer
 * Provides destination-aware constraints and recommendations for realistic planning
 * Includes transfer times, border info, transport preferences, and scheduling rules
 */

import { NormalizedTripInput } from './validation';
import { TripContext } from './tripContext';

/**
 * Categories of travel heuristics
 */
export enum HeuristicCategory {
  TRANSFER_TIME = 'transfer_time',
  BORDER_CROSSING = 'border_crossing',
  TRANSPORT_PREFERENCE = 'transport_preference',
  SCHEDULING_RULE = 'scheduling_rule',
  REGION_INFO = 'region_info',
}

/**
 * A single travel heuristic/constraint
 */
export interface TravelHeuristic {
  /** Category of this heuristic */
  category: HeuristicCategory;

  /** Where this applies (e.g., "Bangkok-Chiang Mai", "Southeast Asia", "Europe") */
  location: string;

  /** The actual rule or fact */
  rule: string;

  /** Severity: 'critical' (must follow) or 'advisory' (consider) */
  severity: 'critical' | 'advisory';

  /** Optional: region code for matching */
  regions?: string[];

  /** Optional: relevant for certain pace levels */
  applicablePaces?: string[];
}

/**
 * Collection of heuristics for a specific trip
 */
export interface TripHeuristics {
  region: string;
  transferTimes: TravelHeuristic[];
  borderCrossings: TravelHeuristic[];
  transportPreferences: TravelHeuristic[];
  schedulingRules: TravelHeuristic[];
  regionInfo: TravelHeuristic[];
}

/**
 * Collection of all known heuristics by region
 */
const HEURISTICS_BY_REGION: Record<string, TravelHeuristic[]> = {
  // Southeast Asia
  'south_east_asia': [
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'Bangkok to Chiang Mai',
      rule: 'Flight: 1-2 hours + 2h airport time = ~3-4h total. Bus: 10-12 hours overnight. Consider flight for schedules < 5 days.',
      severity: 'advisory',
      regions: ['Thailand'],
    },
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'Bangkok to Phuket',
      rule: 'Flight: 1-1.5h + 2h airport time = ~3-4h. Bus: 12-15 hours. Flight usually preferred unless budget-tight.',
      severity: 'advisory',
      regions: ['Thailand'],
    },
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'Chiang Mai to Luang Prabang (Laos)',
      rule: 'Bus or minivan: 10-12 hours. Early 6am start needed. One overnight stay recommended before/after.',
      severity: 'advisory',
      regions: ['Thailand', 'Laos'],
    },
    {
      category: HeuristicCategory.BORDER_CROSSING,
      location: 'Thailand-Laos borders',
      rule: 'Add 1-3 hours buffer for border crossings at Nong Khai, Udon Thani, or Chiang Khong. Have passport ready.',
      severity: 'critical',
      regions: ['Thailand', 'Laos'],
    },
    {
      category: HeuristicCategory.BORDER_CROSSING,
      location: 'Thailand-Cambodia border',
      rule: 'Poipet (overland): Can be chaotic, add 2-4 hours. Aranyaprathet slow. Consider flight instead.',
      severity: 'advisory',
      regions: ['Thailand', 'Cambodia'],
    },
    {
      category: HeuristicCategory.TRANSPORT_PREFERENCE,
      location: 'Southeast Asia regional',
      rule: 'For routes > 12 hours: night buses/trains good for budget travelers. For routes 3-6 hours: daytime preferred for scenery.',
      severity: 'advisory',
      regions: ['Thailand', 'Laos', 'Cambodia', 'Vietnam'],
      applicablePaces: ['budget', 'moderate'],
    },
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'Major cities (Bangkok, Hanoi, Saigon)',
      rule: 'Do not schedule major activity/exploration immediately after 12+ hour transfer. Use arrival day for rest/settling.',
      severity: 'advisory',
    },
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'Southeast Asia regional',
      rule: 'Night buses save accommodation cost but eat a day. Account for fatigue next morning.',
      severity: 'advisory',
      applicablePaces: ['budget'],
    },
    {
      category: HeuristicCategory.REGION_INFO,
      location: 'Thailand',
      rule: 'Visa-on-arrival typically 15-30 days. Domestic travel very smooth. Most travelers 1-3 weeks minimum.',
      severity: 'advisory',
    },
    {
      category: HeuristicCategory.REGION_INFO,
      location: 'Laos',
      rule: 'Slower, smaller towns. Budget ~$15-25/day. Slower travel pace. Sleep schedule flexible.',
      severity: 'advisory',
    },
  ],

  // Europe
  'europe': [
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'London to Paris',
      rule: 'Eurostar: 2h 15m travel + 2h station buffer = ~4-5h. Flight cheaper but similar total time with airport process.',
      severity: 'advisory',
      regions: ['UK', 'France'],
    },
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'Berlin to Prague',
      rule: 'Train: 4-5 hours, scenic, departs city center. Flight overkill.',
      severity: 'advisory',
      regions: ['Germany', 'Czech Republic'],
    },
    {
      category: HeuristicCategory.TRANSPORT_PREFERENCE,
      location: 'Europe intra-city',
      rule: 'Trains preferred for city-to-city (scenic, city center). Flying only for 10+ hour gaps.',
      severity: 'advisory',
      regions: ['UK', 'France', 'Germany', 'Italy', 'Spain'],
    },
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'Europe',
      rule: 'Train departures typically 7am-10pm. Factor in evening arrival or overnight options.',
      severity: 'advisory',
    },
    {
      category: HeuristicCategory.BORDER_CROSSING,
      location: 'Schengen borders',
      rule: 'Most EU borders frictionless (Schengen). No major delays expected. Passport check < 5 minutes.',
      severity: 'advisory',
      regions: ['EU'],
    },
  ],

  // South Asia
  'south_asia': [
    {
      category: HeuristicCategory.TRANSFER_TIME,
      location: 'Delhi to Agra',
      rule: 'Train: 3-4 hours, recommended. Car/bus: 4-6 hours highway.',
      severity: 'advisory',
      regions: ['India'],
    },
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'India long-distance travel',
      rule: 'Overnight trains common and accepted. Day travel can be slow. Plan 1 rest day per 3-4 travel days for comfort.',
      severity: 'advisory',
      regions: ['India'],
    },
    {
      category: HeuristicCategory.REGION_INFO,
      location: 'India',
      rule: 'Visa typically 30-365 days. Domestic travel extensive network. Slow travel culture.',
      severity: 'advisory',
    },
  ],

  // Generic rules (apply everywhere)
  'generic': [
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'Any region',
      rule: 'Allow at least 1 night per 3-4 major destinations. Do not over-pack itinerary.',
      severity: 'advisory',
    },
    {
      category: HeuristicCategory.SCHEDULING_RULE,
      location: 'Any region',
      rule: 'Add buffer day before departure for rest/souvenir shopping/unwinding.',
      severity: 'advisory',
    },
    {
      category: HeuristicCategory.TRANSPORT_PREFERENCE,
      location: 'Any region',
      rule: 'Overnight travel (trains/buses): saves 1 accommodation cost, but use only 1-2 times max per trip.',
      severity: 'advisory',
    },
  ],
};

/**
 * Detect region from arrival/departure locations
 */
function detectRegion(arrivalLoc: string, departureLoc: string): string[] {
  const lowerArrival = arrivalLoc.toLowerCase();
  const lowerDeparture = departureLoc.toLowerCase();

  const combined = `${lowerArrival} ${lowerDeparture}`;

  if (
    combined.includes('bangkok') ||
    combined.includes('chiang mai') ||
    combined.includes('phuket') ||
    combined.includes('hanoi') ||
    combined.includes('saigon') ||
    combined.includes('phnom penh') ||
    combined.includes('vientiane') ||
    combined.includes('laos') ||
    combined.includes('thailand') ||
    combined.includes('vietnam') ||
    combined.includes('cambodia')
  ) {
    return ['south_east_asia', 'generic'];
  }

  if (
    combined.includes('london') ||
    combined.includes('paris') ||
    combined.includes('berlin') ||
    combined.includes('prague') ||
    combined.includes('rome') ||
    combined.includes('barcelona') ||
    combined.includes('europe')
  ) {
    return ['europe', 'generic'];
  }

  if (
    combined.includes('delhi') ||
    combined.includes('agra') ||
    combined.includes('mumbai') ||
    combined.includes('india')
  ) {
    return ['south_asia', 'generic'];
  }

  return ['generic'];
}

/**
 * Get all relevant heuristics for a trip
 */
export function getTravelHeuristics(
  input: NormalizedTripInput,
  context: TripContext
): TripHeuristics {
  const regions = detectRegion(context.arrivalLocation, context.departureLocation);

  const transferTimes: TravelHeuristic[] = [];
  const borderCrossings: TravelHeuristic[] = [];
  const transportPreferences: TravelHeuristic[] = [];
  const schedulingRules: TravelHeuristic[] = [];
  const regionInfo: TravelHeuristic[] = [];

  // Collect heuristics from all relevant regions
  for (const region of regions) {
    const heuristics = HEURISTICS_BY_REGION[region] || [];

    for (const h of heuristics) {
      // Filter by travel pace if applicable
      if (h.applicablePaces && !h.applicablePaces.includes(input.travelPace || 'moderate')) {
        continue;
      }

      switch (h.category) {
        case HeuristicCategory.TRANSFER_TIME:
          transferTimes.push(h);
          break;
        case HeuristicCategory.BORDER_CROSSING:
          borderCrossings.push(h);
          break;
        case HeuristicCategory.TRANSPORT_PREFERENCE:
          transportPreferences.push(h);
          break;
        case HeuristicCategory.SCHEDULING_RULE:
          schedulingRules.push(h);
          break;
        case HeuristicCategory.REGION_INFO:
          regionInfo.push(h);
          break;
      }
    }
  }

  return {
    region: regions.join(', '),
    transferTimes,
    borderCrossings,
    transportPreferences,
    schedulingRules,
    regionInfo,
  };
}

/**
 * Format heuristics for inclusion in prompt
 */
export function formatHeuristicsForPrompt(heuristics: TripHeuristics): string {
  if (!heuristics.transferTimes && !heuristics.borderCrossings && !heuristics.transportPreferences) {
    return ''; // No heuristics available
  }

  const sections: string[] = [];

  if (heuristics.transferTimes.length > 0) {
    sections.push('### Transfer Times & Logistics\n');
    for (const h of heuristics.transferTimes) {
      sections.push(`- ${h.location}: ${h.rule}`);
    }
  }

  if (heuristics.borderCrossings.length > 0) {
    sections.push('\n### Border Crossings & Visas\n');
    for (const h of heuristics.borderCrossings) {
      const severity = h.severity === 'critical' ? '[CRITICAL] ' : '';
      sections.push(`- ${severity}${h.location}: ${h.rule}`);
    }
  }

  if (heuristics.transportPreferences.length > 0) {
    sections.push('\n### Transport Preferences\n');
    for (const h of heuristics.transportPreferences) {
      sections.push(`- ${h.location}: ${h.rule}`);
    }
  }

  if (heuristics.schedulingRules.length > 0) {
    sections.push('\n### Scheduling & Pacing Heuristics\n');
    for (const h of heuristics.schedulingRules) {
      sections.push(`- ${h.location}: ${h.rule}`);
    }
  }

  if (heuristics.regionInfo.length > 0) {
    sections.push('\n### Regional Context\n');
    for (const h of heuristics.regionInfo) {
      sections.push(`- ${h.location}: ${h.rule}`);
    }
  }

  return sections.join('\n');
}

/**
 * Get a summary of heuristics (for logging)
 */
export function summarizeHeuristics(heuristics: TripHeuristics): string {
  const counts = {
    transferTimes: heuristics.transferTimes.length,
    borderCrossings: heuristics.borderCrossings.length,
    transportPreferences: heuristics.transportPreferences.length,
    schedulingRules: heuristics.schedulingRules.length,
    regionInfo: heuristics.regionInfo.length,
  };

  const total =
    counts.transferTimes +
    counts.borderCrossings +
    counts.transportPreferences +
    counts.schedulingRules +
    counts.regionInfo;

  return `${total} heuristics (transfers: ${counts.transferTimes}, borders: ${counts.borderCrossings}, transport: ${counts.transportPreferences}, scheduling: ${counts.schedulingRules}, info: ${counts.regionInfo})`;
}
