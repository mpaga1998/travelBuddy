import { validateTripInput, normalizeTripInput } from '../server/lib/validation';
import { buildTripContext } from '../server/lib/tripContext';
import { initializeOpenAI } from '../server/lib/openai';
import { planItinerary } from '../server/lib/planner';
import { renderItinerary } from '../server/lib/renderer';
const openai = initializeOpenAI();
/**
 * Generate an itinerary through two phases:
 * 1. Planning: Call planner to get a structured ItineraryPlan
 * 2. Rendering: Convert plan to markdown with context and personalization
 *
 * If planning fails validation, throws with detailed error info.
 * Returns both itinerary markdown and any business issues found.
 */
async function generateItinerary(context, travelerName) {
    // Phase 1: Planning
    const planningResult = await planItinerary(context, openai);
    if (!planningResult.success || !planningResult.plan) {
        // Planning failed - could be JSON parse error, validation error, or model error
        const error = planningResult.error || 'Unknown planning error';
        console.error(`❌ [Generation] Planning phase failed: ${error}`);
        throw new Error(`Planning failed: ${error}`);
    }
    const plan = planningResult.plan;
    // Phase 2: Rendering
    const markdownItinerary = renderItinerary({
        plan,
        context,
        travelerName,
    });
    return {
        itinerary: markdownItinerary,
        businessIssues: planningResult.businessIssues,
    };
}
/**
 * Main Vercel handler for POST requests to generate itineraries.
 * Request body: TripInput
 * Response: ItineraryResponse
 */
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    // Only POST allowed
    if (req.method !== 'POST') {
        const response = {
            success: false,
            itinerary: '',
            error: 'Method not allowed',
        };
        res.status(405).json(response);
        return;
    }
    try {
        const tripInput = req.body;
        // Validate input
        const validation = validateTripInput(tripInput);
        if (!validation.valid) {
            // Format error messages: "field1: message1; field2: message2"
            const errorMessage = validation.errors
                .map((err) => `${err.field}: ${err.message}`)
                .join('; ');
            const response = {
                success: false,
                itinerary: '',
                error: errorMessage,
            };
            res.status(400).json(response);
            return;
        }
        // Normalize input: trim strings, remove empty arrays, apply defaults
        const normalizedInput = normalizeTripInput(tripInput);
        // Build trip context: pre-compute all dates, durations, and categorization
        const tripContext = buildTripContext(normalizedInput);
        // Generate itinerary using the computed trip context and traveler name
        const generationResult = await generateItinerary(tripContext, tripInput.userFirstName);
        const response = {
            success: true,
            itinerary: generationResult.itinerary,
        };
        // Include business issues if any warnings were found during planning
        if (generationResult.businessIssues && generationResult.businessIssues.length > 0) {
            response.businessIssues = generationResult.businessIssues;
            console.log(`ℹ️  [Itinerary] Generated itinerary with ${generationResult.businessIssues.length} business issue(s)`);
        }
        res.status(200).json(response);
    }
    catch (error) {
        console.error('[Itinerary] Generation error:', error);
        // Distinguish between planning errors and other generation errors
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate itinerary';
        const isPlanningError = errorMessage.includes('Planning failed') || errorMessage.includes('plan');
        const response = {
            success: false,
            itinerary: '',
            error: isPlanningError
                ? `Could not plan itinerary: ${errorMessage}`
                : `Failed to generate itinerary: ${errorMessage}`,
        };
        const statusCode = isPlanningError ? 422 : 500;
        res.status(statusCode).json(response);
    }
}
