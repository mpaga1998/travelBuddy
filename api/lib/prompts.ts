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
4. **Concrete food recommendations** - Mention specific dishes (risotto alla milanese, lake fish/perch)
5. **Why each activity** - Brief reasoning: "Varenna is more relaxed, backpacker aesthetic" or "go early to avoid sunset crowds"

**SMART TOUCHES:**

1. **Offer choices when relevant** - "Option A (Como) vs Option B (Varenna)" with pros/cons
2. **Anticipate problems** - Add a "Smart Tips" section covering what could go wrong
3. **Include contingency plans** - "If bad weather: swap Day 1 and Day 2" or "museum backup"
4. **Suggest optional upgrades** - "Optional: rent a small boat for 2h (~massive wow factor)"
5. **Flexibility notes** - "If you want, I can optimize for budget vs premium, give exact train schedules..."

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

**REMEMBER: DATES AND TIMES ARE LOCKED IN. DO NOT SUGGEST DIFFERENT DATES OR TIMES.**`;

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
  // If arriving April 7 and departing April 9: 2 nights (7-8 and 8-9)
  const nights = Math.max(
    1,
    Math.round(
      (departureDate.getTime() - arrivalDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const fullDays = nights; // Same number of full travel days

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

  if (isLongTrip) {
    return `${firstName ? `Hey ${firstName}!` : 'Hello!'} Building your ${fullDays}-day trip...

⚠️ **FIXED DATES AND TIMES (DO NOT CHANGE THESE):**
- **ARRIVAL:** ${startDate} in ${input.arrival.location}${arrivalTimeConstraint}
- **DEPARTURE:** ${endDate} from ${input.departure.location}${departureTimeConstraint}
- These dates are locked in. Work within them.

**TRIP CONSTRAINTS:**
- Total: ${nights} nights on the ground
- Pace: ${
      input.travelPace === 'relaxed'
        ? 'Relaxed pace - time to breathe'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in'
          : 'Balanced'
    }
- Budget: ${input.budget}
${input.stops && input.stops.length > 0 ? `- Must visit: ${input.stops.join(', ')}` : ''}

**WANT TO SEE:**
${
  input.desiredAttractions && input.desiredAttractions.length > 0
    ? input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')
    : '(No specific attractions mentioned)'
}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Start with a conversational summary: acknowledge the trip scope, length, vibe, and why it works
2. Create a detailed day-by-day breakdown with specific times, not vague periods
3. For every activity: include exact location, realistic duration, and reasoning
4. Include specific transport details: station names, durations (40 min, not "~1 hour"), booking tips
5. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
6. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
7. Add a "Smart Tips" section covering: potential problems, contingency plans, optimization notes
8. Suggest 1-2 optional upgrades for travelers who want to push it
9. Acknowledge your travel pace and offer flexibility
10. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and specific. Make every traveler feel like this itinerary was custom-built just for them.`;
  } else {
    return `${firstName ? `Hey ${firstName}!` : "Hey there!"} Let's plan your ${fullDays}-day trip...

⚠️ **FIXED DATES AND TIMES (DO NOT CHANGE THESE):**
- **ARRIVAL:** ${startDate} in ${input.arrival.location}${arrivalTimeConstraint}
- **DEPARTURE:** ${endDate} from ${input.departure.location}${departureTimeConstraint}
- These dates are locked in. Work within them.

**TRIP CONSTRAINTS:**
- Total: ${nights} nights on the ground
- Pace: ${
      input.travelPace === 'relaxed'
        ? 'Relaxed pace - time to breathe'
        : input.travelPace === 'active'
          ? 'Active pace - pack it in'
          : 'Balanced'
    }
- Budget: ${input.budget}
${input.stops && input.stops.length > 0 ? `- Must visit: ${input.stops.join(', ')}` : ''}

**WANT TO SEE:**
${
  input.desiredAttractions && input.desiredAttractions.length > 0
    ? input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n')
    : '(No specific attractions mentioned)'
}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Start with a conversational summary: acknowledge the trip scope, length, vibe, and why it works
2. Create a granular hour-by-hour breakdown (or 2-3 hour blocks) with exact start times
3. For every activity: include exact location, realistic duration, and brief reasoning
4. Include specific transport details: station names, durations, booking tips, alternatives
5. Recommend specific dishes, neighborhoods, activities by name (not generic categories)
6. When relevant, offer choices between options with pros/cons (e.g., "Option A vs Option B")
7. Add a "Smart Tips" section covering: what to prioritize, contingency plans, local hacks
8. Suggest 1-2 optional upgrades for travelers who want more
9. Break down each day with: Morning → Late Morning → Afternoon → Evening → Night (if applicable)
10. **DO NOT SUGGEST DIFFERENT DATES - they are locked in.**

Use ${firstName ? firstName + "'s" : "the user's"} name in the opening. Be practical, encouraging, and incredibly specific. Make it feel like a best friend giving insider tips.`;
  }
};
