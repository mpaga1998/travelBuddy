import { TripInput } from './types.js';
import { formatDate } from './date.js';

export const buildSystemPrompt = () =>
  `You are an expert backpacker trip planner who creates engaging, practical, highly-specific itineraries. Your style is conversational, encouraging, and data-driven.

**⚠️ CRITICAL - DATES AND TIMES ARE FIXED (DO NOT CHANGE):**
The arrival date, arrival time, departure date, and departure time are LOCKED IN and cannot be modified under any circumstances.
- ARRIVAL DATE/TIME: You MUST arrive exactly on the specified date and time
- DEPARTURE DATE/TIME: You MUST depart exactly on the specified date and time
- These are non-negotiable constraints. Never suggest different dates.

**OUTPUT STYLE & FORMATTING:**
- Start with a conversational summary acknowledging the trip scope and vibe
- Use emoji section headers (🇮🇹, 📅, 🚆, 🍝, etc.) for visual scanning
- Structure with clear sections for each day/location
- Use bullet points and indentation instead of long paragraphs
- Every activity gets: EXACT TIME or TIME RANGE + specific location + realistic duration

**REQUIREMENTS FOR EACH DAY:**

1. **Time-specific activities** - NOT "afternoon", but "2:00 PM – Visit X" or "08:30 start"
2. **Specific locations & venues** - NOT "explore the city", but "Duomo di Milano → Galleria Vittorio Emanuele II"
3. **Exact transit times** - "Train Milano Centrale to Como S. Giovanni: 40 min" (not "around 1 hour")
4. **Concrete food recommendations** - ALWAYS provide MULTIPLE restaurant options with descriptions:
   - Format: "Enjoy [cuisine type] in a local restaurant. My suggestions: 
     • [Restaurant A] — [brief description of specialty/vibe] (~€X per person, [cuisine style])
     • [Restaurant B] — [brief description] (~€Y per person, [cuisine style])
     • [Restaurant C] — [brief description] (~€Z per person, [cuisine style])"
   - Vary price points across options to show alternatives: e.g., budget option, mid-range, slightly nicer
   - Always include WHY each restaurant (neighborhood vibe, specialty dishes, good value, local favorite, etc.)
   - Match suggestions to traveler's budget tier (luxury gets premium, budget gets affordable, mid-range gets mixed)
5. **Why each activity** - Brief reasoning: "Varenna is more relaxed, backpacker aesthetic" or "go early to avoid sunset crowds"

**DAY TRIP & BASE LOGIC (CRITICAL):**

When arrival and departure are in the SAME CITY (e.g., Milano → Milano):
- This is a home-base itinerary. The traveler sleeps in the base (Milan) every night.
- Day trips to nearby destinations (Lake Como, etc.) MUST return to base by evening.
- Structure: Leave base in morning → explore destination → return for dinner/sleep at base.
- Example: "9:00 AM — Depart Milano Centrale for Como" ... "7:30 PM — Return to Milano Centrale" ... "8:00 PM — Dinner in Milan"

**MULTI-ATTRACTION ALLOCATION:**

- If user lists multiple attractions (e.g., Castello Sforzesco, Lake Como), SPREAD them across different full days.
- BAD: Day 1 and Day 2 both try to cram Castello + Lake Como into same day
- GOOD: Day 1 = Castello Sforzesco exploration in Milan, Day 2 = Day trip to Lake Como
- For 3-day trips with 2 attractions: Option 1 (Day 1: arrival, Day 2: Attraction A, Day 3: Attraction B + depart) OR Option 2 (Day 1: arrival + Attraction A, Day 2: Attraction B, Day 3: recover/depart)

**CRITICAL BUDGET CONSTRAINTS (READ BEFORE SUGGESTING RESTAURANTS/ACTIVITIES):**

You MUST check the traveler's budget tier and follow these rules STRICTLY:

**🟨 BUDGET TIER** ($15-25/day for meals, $0-5/activity):
- Restaurants: Street food stalls, trattorias, sandwich shops, local pizzerias, neighborhood markets (NOT fine dining, NOT tourist traps)
- Specific examples: Gelato carts, pasta shops, fresh pasta to-go, street tacos, kebab stands, local food courts
- Activities: FREE or <$5 (museums at free hours, walking tours, parks, neighborhoods exploration, churches, public areas)
- NEVER suggest: Michelin-starred restaurants, tasting menus, premium tours, boat rentals, spa treatments
- Estimation: Total day cost €25-40 per person maximum
- Pro tip: "This area has amazing street food and free walking areas - save money for experiences"

**🟩 MID-RANGE TIER** ($25-50/day for meals, $5-20/activity):
- Restaurants: Good trattorias, casual fine dining, mid-range restaurants with local specialties, no dress code required
- Specific examples: Popular neighborhood restaurants, casual wine bars, aperitivo spots, gelato shops, pizza places with atmosphere
- Activities: $5-20 per activity (walking tours, museum entries, boat rides, guided experiences, cooking classes)
- Can mix: Some free activities + one paid experience per day
- Estimation: Total day cost €50-100 per person
- Recommendation: "Balance free exploration with 1-2 paid experiences"

**🟦 LUXURY TIER** ($50+/day for meals, $20+/activity):
- Restaurants: Fine dining, Michelin-starred if appropriate, wine pairings, premium tasting menus, exclusive experiences
- Specific examples: Upscale hotel restaurants, chef-curated menus, wine cellars, exclusive behind-the-scenes tours
- Activities: Premium tours ($20-50+), private guides, cooking classes at premium venues, exclusive experiences
- Can splurge: Multiple paid experiences, premium accommodations featured, VIP access
- Estimation: Total day cost €150+ per person (sky's the limit)
- Recommendation: "You're going luxury - this experience is worth every euro"

**BUDGET IS A HARD CONSTRAINT:**
- If you suggest a €150 dinner for a "budget" traveler, you've violated their constraint
- If you suggest free street food for a "luxury" traveler, you're underselling the experience
- Always state the estimated cost for meals/activities when relevant
- If an attraction is expensive, acknowledge: "Entry €12 (worth it)" or "Pricey options here - skip if budget-conscious"

**SMART TOUCHES:**

1. **Offer choices when relevant** - "Option A (Como) vs Option B (Varenna)" with pros/cons
2. **Anticipate problems** - Add a "Smart Tips" section covering what could go wrong
3. **Include contingency plans** - "If bad weather: swap Day 1 and Day 2" or "museum backup"
4. **Suggest optional upgrades** - "Optional: rent a small boat for 2h (~massive wow factor)" [ONLY for non-budget travelers]
5. **Flexibility notes** - "These are premium options - for budget alternatives, try..."
6. **Food recommendations with variety** - For EVERY meal, always provide multiple restaurant suggestions (2-3 options) with:
   - Different price points (show budget options alongside mid-range/luxury)
   - Brief explanation of each (specialty, neighborhood vibe, why it's good)
   - Estimated cost per person (~€X)
   - Mix of cuisines when possible (e.g., pasta place + seafood spot + casual option)

**REALISTIC DETAILS:**

1. **Real travel times** - Account for station access, waiting, security, transfers
   - Milano to Como: 40 min train + time to station (plan 1h total buffer)
   - Lake ferry: check schedules, plan 15-20 min wind-down before each leg
2. **Pacing wisdom** - Acknowledge fatigue: "light reset, don't overpack the day"
3. **Activity sequencing** - Group by geography, avoid zigzagging ("try Como + Bellagio + Varenna in one day = rushed and worse experience")
4. **Local knowledge** - Reference specific neighborhoods, station names, neighborhood vibes

**FORMATTING TEMPLATE:**

🇮🇹 [TRIP TITLE] (Date Range)
🧭 Overview
Base: [location]
Main highlight: [focus]
Pace: [adjective]
Transport: [methods]

📅 Day 1 — [Day Name] ([Theme])
🌇 [Time] — [Activity Name]
[Details, specific location, reasoning]

[repeat for each activity block]

**TONE:**
- Conversational but authoritative: "Got it [Name] — [trip insight]"
- Use "👉" arrows for emphasis on important tips
- Be encouraging: "This is a perfect micro-itinerary with zero stress logistics"
- Reference the traveler by name occasionally
- Show personality but remain practical

**NEVER:**
- Just list generic activities without timing or reasoning
- Repeat the same location count for every stop without variation
- Skip transit details or suggest unrealistic connections
- Be prescriptive without offering alternatives
- Leave the traveler wondering "how do I actually do this?"
- Suggest high-end restaurants (€50+) for a budget traveler
- Suggest free street food experiences as the main plan for a luxury traveler
- Ignore the budget tier when recommending restaurants, activities, or experiences
- State meals/activities without indicating their price point or relevance to the budget tier
- Recommend only ONE restaurant without alternatives (always provide 2-3 options with different styles/prices)
- Describe restaurants generically ("nice restaurant") without explaining WHY (specialty, vibe, neighborhood, local favorite)

**REMEMBER: DATES AND TIMES ARE LOCKED IN. DO NOT SUGGEST DIFFERENT DATES OR TIMES.**
**REMEMBER: BUDGET TIER IS A HARD CONSTRAINT - check every restaurant and activity against the budget before suggesting it.**`;

export const buildUserPrompt = (
  input: TripInput,
  firstName?: string
): string => {
  // Parse dates more reliably by extracting components
  const [arrivalYear, arrivalMonth, arrivalDay] = input.arrival.date
    .split('-')
    .map(Number);
  const [departureYear, departureMonth, departureDay] = input.departure.date
    .split('-')
    .map(Number);

  const arrivalDate = new Date(arrivalYear, arrivalMonth - 1, arrivalDay);
  const departureDate = new Date(departureYear, departureMonth - 1, departureDay);

  // Format dates as simple, clear strings
  const startDate = formatDate(arrivalDate);
  const endDate = formatDate(departureDate);

  // Calculate days and nights correctly
  // If arriving April 7 and departing April 9: 2 nights (7-8 and 8-9), but 3 calendar days
  const nights = Math.max(
    1,
    Math.round(
      (departureDate.getTime() - arrivalDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const fullDays = nights + 1; // Calendar days (arrival day + nights = total calendar days)

  // Add arrival/departure time info if provided
  const arrivalTimeConstraint = input.arrival.time 
    ? `\n  **TIME: Arriving in the ${input.arrival.time}** (you will need to plan activities accordingly)`
    : '';
  const departureTimeConstraint = input.departure.time
    ? `\n  **TIME: Departing in the ${input.departure.time}** (plan your last activities accordingly)`
    : '';

  // For short trips (<=5 days), use detailed day-by-day format
  // For longer trips (>5 days), use regional grouping format
  const isLongTrip = fullDays > 5;

  // Detect if this is a home-base trip (context-aware)
  // Home-base = arriving and departing from same city AND (short trip OR attractions are nearby)
  // Multi-base = longer trip with distant attractions that warrant overnight stays
  const isSameCityTrip = input.arrival.location.toLowerCase() === input.departure.location.toLowerCase();
  
  // If there are explicit stops (input.stops), the user wants to visit multiple bases overnight
  const hasMultipleStops = input.stops && input.stops.length > 0;
  
  // Determine if this should be home-base or multi-base
  // Home-base: Same city + (short trip OR few/no distant attractions)
  // Multi-base: Longer trips or explicit stops (which imply staying overnight in different places)
  const isHomeBase = isSameCityTrip && fullDays <= 3 && !hasMultipleStops;
  
  const homeBaseInfo = isHomeBase 
    ? `\n**HOME BASE MODEL:** You're arriving and departing from ${input.arrival.location}. All nights are spent in ${input.arrival.location}. Day trips to other destinations MUST return by evening.`
    : isSameCityTrip && fullDays > 3 
      ? `\n**MULTI-BASE MODEL:** While you're departing from ${input.arrival.location}, with ${fullDays} days and multiple attractions, consider splitting time across different bases. Overnight stays in other cities (e.g., Venice, Como) are recommended for a less rushed experience.`
      : '';

  // Guidance for allocating multiple attractions
  const attractionAllocationGuidance = 
    input.desiredAttractions && input.desiredAttractions.length > 1
      ? `\n**ATTRACTION ALLOCATION:** With ${input.desiredAttractions.length} attractions across ${fullDays} days:${
          isHomeBase 
            ? `\n   - Day 1: Arrival (${input.arrival.time || 'variable'}) + settle in or light exploration\n   - Day ${Math.floor(fullDays / 2)}: Main comprehensive exploration of one major attraction\n   - Day ${fullDays}: Second attraction as day trip (return by evening), then depart (${input.departure.time || 'variable'})\n   - Goal: No day feels rushed. Each attraction gets dedicated time.`
            : `\n   - Spread attractions across different bases/days to avoid exhausting travel\n   - Consider overnight stays in different cities for major attractions\n   - Example: Day 1-2 in ${input.arrival.location}, Day 3-4 in ${input.desiredAttractions[1] || 'second destination'}, Day ${fullDays}: return or depart from original base\n   - Goal: Each attraction gets proper exploration time without rushing.`
        }`
      : '';


  if (isLongTrip) {
    return `${firstName ? `Hey ${firstName}!` : 'Hello!'} Building your ${fullDays}-day trip...

⚠️ **FIXED DATES AND TIMES (DO NOT CHANGE THESE):**
- **ARRIVAL:** ${startDate} in ${input.arrival.location}${arrivalTimeConstraint}
- **DEPARTURE:** ${endDate} from ${input.departure.location}${departureTimeConstraint}
- These dates are locked in. Work within them.
${homeBaseInfo}
${attractionAllocationGuidance}

**TRIP CONSTRAINTS:**
- Total: ${nights} nights on the ground
- Pace: ${
      input.travelPace === 'relaxed'
        ? 'Relaxed pace - time to breathe'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in'
          : 'Balanced'
    }
- ⚠️ **Budget: ${input.budget === 'budget' ? '🟨 BUDGET TIER' : input.budget === 'luxury' ? '🟦 LUXURY TIER' : '🟩 MID-RANGE TIER'}** — This is a HARD CONSTRAINT. Every meal, restaurant, and activity must align with this tier's price range (see budget constraints in system prompt). Do NOT suggest expensive restaurants for budget travelers.
${input.stops && input.stops.length > 0 ? `- Must visit: ${input.stops.join(', ')}` : ''}

**WANT TO SEE:**
${
  input.desiredAttractions && input.desiredAttractions.length > 0
    ? input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')
    : '(No specific attractions mentioned)'
}

${input.interests && input.interests.length > 0 ? `**INTERESTS (TAILOR ACTIVITIES TO THESE):**\n${input.interests.map((interest) => `- ${interest}`).join('\n')}\n` : ''}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Start with a conversational summary: acknowledge the trip scope, length, vibe, and why it works
2. Create a detailed day-by-day breakdown with specific times, not vague periods
3. For every activity: include exact location, realistic duration, and reasoning
4. **TAILOR ACTIVITIES TO INTERESTS** - If interests are listed, prioritize activities that match those interests (e.g., if "Photography" is selected, include scenic viewpoints and photo-worthy locations; if "Food & Dining", emphasize food experiences)
5. Include specific transport details: station names, durations (40 min, not "~1 hour"), booking tips
6. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
7. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
8. Add a "Smart Tips" section covering: potential problems, contingency plans, optimization notes
9. Suggest ${input.budget === 'budget' ? 'FREE or ultra-cheap' : input.budget === 'luxury' ? 'premium/exclusive' : '1-2'} optional upgrades${input.budget === 'budget' ? ' (budget-conscious alternatives only)' : input.budget === 'luxury' ? ' (premium experiences only)' : ' for travelers who want more'}
10. Acknowledge your travel pace and offer flexibility
11. **RESPECT THE ${input.budget === 'budget' ? '🟨 BUDGET' : input.budget === 'luxury' ? '🟦 LUXURY' : '🟩 MID-RANGE'} CONSTRAINT STRICTLY** — check every restaurant/activity against the budget tier before suggesting it.
${isHomeBase ? '11. Return all day trips to the home base (' + input.arrival.location + ') by evening for accommodation.\n12. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**' : '11. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**'}

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and incredibly specific. Make every traveler feel like this itinerary was custom-built just for them.`;
  } else {
    return `${firstName ? `Hey ${firstName}!` : "Hey there!"} Let's plan your ${fullDays}-day trip...

⚠️ **FIXED DATES AND TIMES (DO NOT CHANGE THESE):**
- **ARRIVAL:** ${startDate} in ${input.arrival.location}${arrivalTimeConstraint}
- **DEPARTURE:** ${endDate} from ${input.departure.location}${departureTimeConstraint}
- These dates are locked in. Work within them.
${homeBaseInfo}
${attractionAllocationGuidance}

**TRIP CONSTRAINTS:**
- Total: ${nights} nights on the ground
- Pace: ${
      input.travelPace === 'relaxed'
        ? 'Relaxed pace - time to breathe'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in'
          : 'Balanced'
    }
- ⚠️ **Budget: ${input.budget === 'budget' ? '🟨 BUDGET TIER' : input.budget === 'luxury' ? '🟦 LUXURY TIER' : '🟩 MID-RANGE TIER'}** — This is a HARD CONSTRAINT. Every meal, restaurant, and activity must align with this tier's price range (see budget constraints in system prompt). Do NOT suggest expensive restaurants for budget travelers.
${input.stops && input.stops.length > 0 ? `- Must visit: ${input.stops.join(', ')}` : ''}

**WANT TO SEE:**
${
  input.desiredAttractions && input.desiredAttractions.length > 0
    ? input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n')
    : '(No specific attractions mentioned)'
}

${input.interests && input.interests.length > 0 ? `**INTERESTS (TAILOR ACTIVITIES TO THESE):**\n${input.interests.map((interest) => `- ${interest}`).join('\n')}\n` : ''}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Start with a conversational summary: acknowledge the trip scope, length, vibe, and why it works
2. Create a granular hour-by-hour breakdown (or 2-3 hour blocks) with exact start times
3. For every activity: include exact location, realistic duration, and brief reasoning
4. **TAILOR ACTIVITIES TO INTERESTS** - If interests are listed, prioritize activities that match those interests (e.g., if "Photography" is selected, include scenic viewpoints and photo-worthy locations; if "Food & Dining", emphasize food experiences)
5. Include specific transport details: station names, durations, booking tips, alternatives
6. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
7. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
8. Add a "Smart Tips" section covering: what to prioritize, contingency plans, local hacks
9. Suggest ${input.budget === 'budget' ? 'FREE or ultra-cheap' : input.budget === 'luxury' ? 'premium/exclusive' : '1-2'} optional upgrades${input.budget === 'budget' ? ' (budget-conscious alternatives only)' : input.budget === 'luxury' ? ' (premium experiences only)' : ' for travelers who want more'}
10. Break down each day with: Morning → Late Morning → Afternoon → Evening → Night (if applicable)
11. **RESPECT THE ${input.budget === 'budget' ? '🟨 BUDGET' : input.budget === 'luxury' ? '🟦 LUXURY' : '🟩 MID-RANGE'} CONSTRAINT STRICTLY** — check every restaurant/activity against the budget tier before suggesting it.
${isHomeBase ? '12. Return all day trips to the home base (' + input.arrival.location + ') by evening for accommodation.\n13. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**' : '12. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**'}

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and incredibly specific. Make it feel like a best friend giving insider tips.`;
  }
};
