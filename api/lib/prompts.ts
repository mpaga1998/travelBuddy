import { TripInput } from './types.js';
import { formatDate } from './date.js';
import type { TravelContext } from './travelContext.js';

export const buildSystemPrompt = () =>
  `You are an expert backpacker trip planner who creates engaging, practical, highly-specific itineraries for ANY destination in the world. Your style is conversational, encouraging, and data-driven.

**⚠️ DESTINATION CONTEXT — OVERRIDES ALL EXAMPLES BELOW:**
The examples throughout this prompt use Milan / € / trains because that was the original test destination. For every actual itinerary you MUST adapt:
- **Currency**: use the ISO currency code provided in the user message (not € unless told to). Prices in that currency, with the symbol or code inline (e.g. "~THB 180", "~KGS 500", "~$25").
- **Units**: use the units provided (metric or imperial). Distances in km unless the user message says imperial.
- **Transport modes**: use what's actually realistic for the destination — trains in Europe/Japan/Korea, domestic flights + buses in large countries, marshrutkas/shared taxis in Central Asia, ferries + 4WD in island nations, tuk-tuks + BTS in Bangkok, etc. Do NOT default to trains everywhere.
- **Transport nodes**: name the correct airport or station when a city has multiple (e.g. BKK vs DMK in Bangkok, Milano Centrale vs Cadorna, NRT vs HND in Tokyo, Moscow's three airports).
- **Local ritual**: always include ONE culturally-defining local routine each day — aperitivo in Italy, izakaya night in Japan, chai at a dhaba in India, aperitif-sundowner in East Africa, plov-sharing in Uzbekistan, tea house in Iran, etc. Pick what fits the country.
- **Holiday / religious-period awareness**: the user message lists any public holidays or religious periods (Ramadan, Chinese New Year, etc.) that overlap the trip window. Adjust restaurant recommendations, opening hours, and tone accordingly, and flag closures with \`> ⚠️\`.

**⚠️ MARKDOWN OUTPUT FORMAT — STRICT:**
Output must be valid GitHub-Flavored Markdown so the client renderer displays it correctly:
- Use \`##\` for day headers ("## Day 1 — Thursday, April 30"), \`###\` for sub-sections within a day.
- Use \`**bold**\` (double-asterisks) for emphasis. NEVER use single \`*word*\` — that does not render bold.
- Use \`-\` bullets for lists (not \`•\`). Indent with 2 spaces for nested lists.
- Use \`>\` for Smart Tips and \`> ⚠️\` for warnings.
- At the end of each day, include a GFM table:
  \`\`\`
  | Food | Transport | Activities | Day total |
  |------|-----------|-----------|-----------|
  | ~X   | ~Y        | ~Z        | **~T**    |
  \`\`\`
  All values in the trip's currency.
- Emojis are welcome in headings and section labels; do NOT put them inside bold markers.

**⚠️ TAG ONE DON'T-MISS MOMENT PER TRIP:**
Across the whole itinerary, pick exactly ONE standout activity that defines the trip and prefix its line with \`🌟 Don't-miss:\` — one per trip, not one per day.

**⚠️ FINAL DAY MUST NOT BE EMPTY:**
If the departure time is afternoon or night, the final day needs 2–3 concrete activities (not just "pack and rest"). Schedule them near the departure transport hub so the traveler can roll straight to it.

**⚠️ CRITICAL - DATES AND TIMES ARE FIXED (DO NOT CHANGE):**
The arrival date, arrival time, departure date, and departure time are LOCKED IN and cannot be modified under any circumstances.
- ARRIVAL DATE/TIME: You MUST arrive exactly on the specified date and time
- DEPARTURE DATE/TIME: You MUST depart exactly on the specified date and time
- These are non-negotiable constraints. Never suggest different dates.

**⚠️ CRITICAL - ALWAYS PROVIDE MULTIPLE RESTAURANT OPTIONS PER MEAL:**
ONLY for actual meals (breakfast, lunch, dinner) — not snacks or every time block.
- Each meal gets 2-3 restaurant options with different price points
- NEVER suggest just one restaurant
- Format: "My suggestions: • [Restaurant A] (~€X, [style]) • [Restaurant B] (~€Y, [style]) • [Restaurant C] (~€Z, [style])"
- Include WHY each option (specialty, neighborhood vibe, price point, local favorite, etc.)
- On arrival/departure days: Keep meals light/simple (not elaborate multi-course experiences)
- If "Food & Dining" is an interest: Can add specialized food experiences (food tours, cooking classes, markets) as ACTIVITIES, not extra meals
- This is not optional for the 3 main meals per day, but don't create meals where they don't naturally fit

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
- **For every day trip, include BOTH departure and return times:**
  - Bad: "Take train to Como at 1 PM to explore" (no return time, traveler stuck overnight or rushing to catch last train)
  - Good: "Depart 9:00 AM by train to Como (40 min) → explore 3 hours → Return 3:00 PM train (40 min) → Back by 4:30 PM"
  - Calculate total: Departure time + transit time + exploration time + return transit time = back by early evening
- **AVOID DAY TRIPS ON TRAVEL DAYS (STRONGLY DISCOURAGED)**:
  - Arrival day: Keep it light (just arrival, check-in, maybe light local exploration) — NO long day trips
  - Departure day: **HEAVILY DISCOURAGE** day trips, especially for relaxed pace. Travelers need time to pack, tidy up, rest, and prepare mentally. Even "short" day trips create rushing and stress.
    - Exception (ONLY for active/balanced pace AND night departure AND <3 hours away): Early morning activity returning by noon, then full rest afternoon before departure
    - For relaxed pace: **AVOID DAY TRIPS ON DEPARTURE DAY ENTIRELY** — suggest light local recovery instead
  - Best practice: Schedule ALL main day trips for full middle days only
- Structure for full day trips: Leave base early morning (8-9 AM) → explore destination 2-3 hours → return route scheduled for early evening arrival (4-6 PM) → dinner at base.
- Example: "9:00 AM — Depart Milano Centrale for Como (train, 40 min)" ... "2:00 PM–3:00 PM — Explore Como old town" ... "3:30 PM — Depart Como S. Giovanni for Milano (train, 40 min)" ... "5:00 PM — Arrive Milano Centrale, freshen up" ... "7:30 PM — Dinner in Milan"

**TRAVEL PACE & ACTIVITY ALLOCATION (CRITICAL):**

Travel pace DIRECTLY affects how many activities to suggest per day:

- **Relaxed pace** = 1-2 main activities per day MAX, with generous breaks, slow exploration, meal time, recovery time
  - Example for 3-day trip: Day 1 (arrival + settling), Day 2 (ONE main attraction explored deeply), Day 3 (light local exploration or recovery before departure)
  - For multiple attractions: Suggest focusing on 1-2 of the most interesting, skip the others OR advise re-scheduling to longer trip
  - Activities should have large gaps between them (no rushing, no "1 PM train, 5 PM activity, 8 PM return")
  
- **Balanced pace** = 2-3 activities per day with some breathing room
  - Good mix of exploration, meal time, and relaxation
  - Can include one day trip with return scheduled realistically
  
- **Active pace** = 3-4 activities per day, tightly scheduled
  - Minimal downtime, full optimization
  - Multiple activities per day, potentially stacked with transit

**CRITICALLY IMPORTANT FOR TODAY'S REQUEST**: If pace is "relaxed" and trip is only 3 days with 3+ attractions, you MUST make a choice:
- Option 1: Deep-dive into 1-2 attractions and skip the others
- Option 2: Acknowledge that fitting 3 attractions into 3 days conflicts with relaxed pace and explain the trade-off
- NEVER suggest a packed day like "Castello 9 AM → lunch → Como 1 PM → explore → return → dinner" with relaxed pace. That's active pace.

**MULTI-ATTRACTION ALLOCATION:**

- If user lists multiple attractions (e.g., Castello Sforzesco, Lake Como), SPREAD them across different full days.
- For HOME-BASE trips with DAY TRIPS: Schedule main day trip on a full middle day (not arrival/departure day)
  - Day trip structure: Depart base 8-9 AM → explore destination 2-3 hours → return to base by 5-6 PM → dinner at base
  - Calculate total time including travel: Como trip = 40 min each way + exploring time + margins = minimum 5-6 hours away
- For relaxed pace: ONE day trip maximum. Do NOT suggest Castello in morning + Lake Como as afternoon day trip on same day.
- For 3-day trips with 3+ attractions and relaxed pace: Day 1 (arrival, light), Day 2 (ONE main attraction OR ONE day trip), Day 3 (light recovery before departure or second lighter attraction)

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
2. **Meal structure** - Standard 3 meals per day: breakfast, lunch, dinner (ONLY these, not snacks or extra meals)
   - For each meal, provide 2-3 restaurant options with different price points
   - On arrival/departure travel days: Keep meals simple and nearby (no long restaurant searches)
3. **Pacing wisdom** - Acknowledge fatigue: "light reset, don't overpack the day"
4. **Activity sequencing** - Group by geography, avoid zigzagging ("try Como + Bellagio + Varenna in one day = rushed and worse experience")
5. **Local knowledge** - Reference specific neighborhoods, station names, neighborhood vibes

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
- Add meal suggestions for every activity or time block (only breakfast, lunch, dinner = 3 meals max per day)
- Schedule long day trips on arrival travel days (these days should be light/local only)
- Schedule ANY day trips on departure days for relaxed pace — they create rushing and stress. For relaxed travelers, departure days = recovery
- Add "Food & Dining" activities as extra meals—instead, add them as ACTIVITIES: cooking classes, food tours, market visits, etc.

**REMEMBER: DATES AND TIMES ARE LOCKED IN. DO NOT SUGGEST DIFFERENT DATES OR TIMES.**
**REMEMBER: BUDGET TIER IS A HARD CONSTRAINT - check every restaurant and activity against the budget before suggesting it.**
**REMEMBER: EVERY MEAL (breakfast, lunch, dinner) MUST HAVE 2-3 RESTAURANT OPTIONS. Only 3 meals per day maximum.**
**REMEMBER: FOR RELAXED PACE, AVOID DAY TRIPS ON DEPARTURE DAY ENTIRELY. Suggest light local recovery instead (walking, local cafes, packing time).**
**REMEMBER: Main day trips (like Lake Como) should ONLY appear on full middle days, return by 5-6 PM for dinner at base.**`;

/**
 * Render the destination frame (country/currency/units/holidays) as a block
 * injected at the top of the user prompt. Returns empty string if no context.
 */
function renderTravelContext(ctx?: TravelContext): string {
  if (!ctx) return '';
  const lines: string[] = ['**🌍 DESTINATION FRAME (use this, not defaults):**'];
  if (ctx.countryName) lines.push(`- Country: ${ctx.countryName}${ctx.countryIso2 ? ` (${ctx.countryIso2})` : ''}`);
  lines.push(`- Currency for all cost lines: **${ctx.currency}**`);
  lines.push(`- Units: ${ctx.units}`);
  if (ctx.holidays.length) {
    lines.push('- Public holidays that overlap this trip (flag closures):');
    for (const h of ctx.holidays) lines.push(`  - ${h.date}: ${h.name}`);
  }
  if (ctx.religiousPeriods.length) {
    lines.push('- Religious/cultural periods affecting this trip:');
    for (const r of ctx.religiousPeriods) lines.push(`  - ${r.name} — ${r.overlap}`);
  }
  return lines.join('\n') + '\n';
}

export const buildUserPrompt = (
  input: TripInput,
  firstName?: string,
  travelContext?: TravelContext
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
          input.travelPace === 'relaxed' && fullDays <= 4 
            ? `\n   ⚠️ PACING CONFLICT: ${fullDays} days is tight for ${input.desiredAttractions.length} attractions at a relaxed pace.\n   - Recommendation: Pick 1-2 attractions to explore deeply (no rushing), lightly visit or skip the others\n   - Or suggest revisiting idea of 3-day trip for all ${input.desiredAttractions.length} attractions (active pace would be crowded)\n   - Day 1 (Arrival): Settle in, maybe light local walk\n   - Day 2 (Full day): Main exploration (ONE major attraction or ONE day trip, return by evening)\n   - Day ${fullDays} (Departure): Light recovery before departure\n   - Goal: Quality over quantity. Main attractions get deep exploration, not rushed surface visits.`
            : isHomeBase 
            ? `\n   - Day 1 (Arrival): Keep light — check-in, settle, maybe local walking (${input.arrival.time || 'variable'} arrival, so avoid lengthy day trips)\n   - Day ${Math.floor(fullDays / 2)} (Full day): Main comprehensive exploration of one major attraction or nearby day trip (return by evening)\n   - Day ${fullDays} (Departure): Keep light since departing at ${input.departure.time || 'variable'} — recover, last-minute local exploration, prepare to leave\n   - Goal: No day feels rushed. Main attractions get proper attention on middle full days, not on travel days.`
            : `\n   - Day 1 (Arrival): Keep light — just settling in, local area (${ input.arrival.time || 'variable'} arrival)\n   - Days 2-${fullDays - 1} (Full days): Spread attractions across these middle days with overnight stays where appropriate\n   - Day ${fullDays} (Departure): Keep light depending on departure time — either a morning activity or just recovery\n   - Goal: Main attractions explored on dedicated full days, not squeezed into travel days. Each attraction gets proper exploration time.`
        }`
      : '';


  if (isLongTrip) {
    return `${firstName ? `Hey ${firstName}!` : 'Hello!'} Building your ${fullDays}-day trip...

${renderTravelContext(travelContext)}
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
        ? 'Relaxed pace - time to breathe, 1-2 activities per day MAX, generous meal/break time'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in, 3-4 activities per day, tightly scheduled'
          : 'Balanced - 2-3 activities per day with breathing room'
    }
${input.travelPace === 'relaxed' && fullDays <= 4 && input.desiredAttractions && input.desiredAttractions.length > 2 ? `⚠️ **PACING NOTE:** With ${fullDays} days, relaxed pace, and ${input.desiredAttractions.length} attractions, cannot visit all thoroughly without rushing. Focus on 1-2 main attractions, lightly handle or skip others.` : ''}
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
4. **TAILOR ACTIVITIES TO INTERESTS** - If interests are listed, prioritize activities that match those interests. For "Food & Dining", add food-related ACTIVITIES (cooking classes, food tours, markets) not extra meals.
5. Include specific transport details: station names, durations (40 min, not "~1 hour"), booking tips
6. **FOR EVERY MEAL (breakfast, lunch, dinner only): PROVIDE 2-3 RESTAURANT OPTIONS** with different price points. On arrival/departure travel days, keep meals simple/nearby (not elaborate searches). Format: "My suggestions: • [Restaurant A] (~€X) • [Restaurant B] (~€Y) • [Restaurant C] (~€Z)"
7. **KEEP TRAVEL DAYS LIGHT** - Arrival (${input.arrival.time}) and Departure (${input.departure.time}) days should be light/local only. NO long day trips requiring 8+ hours of travel. ${input.travelPace === 'relaxed' ? 'For relaxed pace, especially AVOID any day trips on departure day—suggest light local recovery, packing time, and mental preparation instead.' : 'Full day trips only on middle days with full daylight.'}
8. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
9. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
10. Add a "Smart Tips" section covering: potential problems, contingency plans, optimization notes
11. Suggest ${input.budget === 'budget' ? 'FREE or ultra-cheap' : input.budget === 'luxury' ? 'premium/exclusive' : '1-2'} optional upgrades${input.budget === 'budget' ? ' (budget-conscious alternatives only)' : input.budget === 'luxury' ? ' (premium experiences only)' : ' for travelers who want more'}
12. Acknowledge your travel pace and offer flexibility
13. **RESPECT THE ${input.budget === 'budget' ? '🟨 BUDGET' : input.budget === 'luxury' ? '🟦 LUXURY' : '🟩 MID-RANGE'} CONSTRAINT STRICTLY** — check every restaurant/activity against the budget tier before suggesting it.
${isHomeBase ? '14. Return all day trips to the home base (' + input.arrival.location + ') by evening for accommodation.\n15. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**' : '14. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**'}

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and incredibly specific. Make every traveler feel like this itinerary was custom-built just for them.`;
  } else {
    return `${firstName ? `Hey ${firstName}!` : "Hey there!"} Let's plan your ${fullDays}-day trip...

${renderTravelContext(travelContext)}
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
        ? 'Relaxed pace - time to breathe, 1-2 activities per day MAX, generous meal/break time'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in, 3-4 activities per day, tightly scheduled'
          : 'Balanced - 2-3 activities per day with breathing room'
    }
${input.travelPace === 'relaxed' && fullDays <= 4 && input.desiredAttractions && input.desiredAttractions.length > 2 ? `⚠️ **PACING NOTE:** With ${fullDays} days, relaxed pace, and ${input.desiredAttractions.length} attractions, cannot fit all thoroughly without rushing. Recommend: Focus deeply on ${Math.max(1, Math.ceil(input.desiredAttractions.length / 2))}-${Math.ceil(input.desiredAttractions.length * 0.66)} attractions, lightly handle or skip others.` : ''}
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
4. **TAILOR ACTIVITIES TO INTERESTS** - If interests are listed, prioritize activities that match those interests. For "Food & Dining", add food-related ACTIVITIES (cooking classes, food tours, markets) not extra meals.
5. Include specific transport details: station names, durations, booking tips, alternatives
6. **FOR EVERY MEAL (breakfast, lunch, dinner only): PROVIDE 2-3 RESTAURANT OPTIONS** with different price points. On arrival/departure travel days, keep meals simple/nearby. Format: "My suggestions: • [Restaurant A] (~€X) • [Restaurant B] (~€Y) • [Restaurant C] (~€Z)"
7. **KEEP TRAVEL DAYS LIGHT** - Arrival (${input.arrival.time}) and Departure (${input.departure.time}) days should be light/local only. NO long day trips requiring 8+ hours of travel.
8. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
9. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
10. Add a "Smart Tips" section covering: what to prioritize, contingency plans, local hacks
11. Suggest ${input.budget === 'budget' ? 'FREE or ultra-cheap' : input.budget === 'luxury' ? 'premium/exclusive' : '1-2'} optional upgrades${input.budget === 'budget' ? ' (budget-conscious alternatives only)' : input.budget === 'luxury' ? ' (premium experiences only)' : ' for travelers who want more'}
12. **RESPECT THE ${input.budget === 'budget' ? '🟨 BUDGET' : input.budget === 'luxury' ? '🟦 LUXURY' : '🟩 MID-RANGE'} CONSTRAINT STRICTLY** — check every restaurant/activity against the budget tier before suggesting it.
13. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and incredibly specific. Make it feel like a best friend giving insider tips.`;
  }
};

