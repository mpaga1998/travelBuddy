/**
 * Vercel API endpoint: POST /api/itinerary
 * Two-stage generation: plan first (structured), then render (markdown)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';

import { ItineraryResponse } from './types/trip.js';
import { validateAndNormalizeTripInput, formatValidationErrors } from './lib/validation.js';
import { computeTripContext } from './lib/tripContext.js';
import { planItinerary, summarizePlan } from './lib/planner.js';
import { renderItinerary, formatRenderingResult } from './lib/renderer.js';
import { generateItinerary } from './lib/openai.js';
import { initializeOpenAIService } from './lib/openaiService.js';
import {
  initializeDebugConfig,
  debugLogNormalizedInput,
  debugLogTripContext,
  debugLogPipelineSummary,
  isDebugEnabled,
} from './lib/debug.js';

// Load environment variables
dotenv.config();

// Initialize services on first load
try {
  initializeDebugConfig(process.env);
  initializeOpenAIService(process.env);
} catch (err) {
  console.error('[Handler] Failed to initialize services:', err);
}



/**
 * HTTP request handler
 * Accepts POST requests with trip planning parameters
 * Returns generated itinerary or error response
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  setCORSHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return sendErrorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Step 1: Validate and normalize input
    const validationResult = validateAndNormalizeTripInput(req.body);
    
    if (!validationResult.valid) {
      const errorMessage = formatValidationErrors(validationResult.errors);
      return sendErrorResponse(res, 400, errorMessage);
    }

    const normalizedInput = validationResult.data;

    // Debug: log normalized input
    debugLogNormalizedInput(normalizedInput);

    // Step 2: Compute trip context (all trip math)
    const context = computeTripContext(normalizedInput);

    // Debug: log trip context
    debugLogTripContext(context);

    // Step 3: Generate structured plan (with retry support)
    const planningResult = await planItinerary(
      normalizedInput,
      context,
      normalizedInput.userFirstName,
      2 // max 2 attempts
    );

    // Step 3b: Check plan validity (business rules) and repair status
    let planIsValid = false;
    if (planningResult.repairAttempted) {
      console.log('[Handler] Plan required repair attempt');
      if (planningResult.repairResult) {
        if (planningResult.repairResult.success) {
          console.log('[Handler] ✓ Repair successful');
        } else {
          console.warn('[Handler] ✗ Repair failed:', planningResult.repairResult.repairMessage);
        }
      }
    }

    if (planningResult.success && planningResult.plan && planningResult.validationResult) {
      planIsValid = planningResult.validationResult.valid;
      console.log('[Handler] Plan validation score:', planningResult.validationResult.score);

      if (planIsValid) {
        const repairNote = planningResult.repairAttempted ? ' (after repair)' : '';
        console.log('[Handler] Plan is valid, ready for rendering' + repairNote);
      } else {
        console.warn('[Handler] Plan failed business-rule validation:');
        const errorCount = planningResult.validationResult.issues.filter(
          (i) => i.severity === 'error'
        ).length;
        console.warn(`  - ${errorCount} critical error(s)`);
        planningResult.validationResult.issues
          .filter((i) => i.severity === 'error')
          .forEach((issue) => {
            console.warn(`    • ${issue.rule}: ${issue.message}`);
          });
      }
    } else if (!planningResult.success) {
      console.error('[Handler] Planning failed:', planningResult.error);
      console.warn('[Handler] Retryable:', planningResult.retryable);
      // Continue to fallback generation
    } else {
      console.log('[Handler] Plan generated but validation skipped');
    }

    if (planningResult.warnings && planningResult.warnings.length > 0) {
      console.warn('[Handler] Planning warnings:', planningResult.warnings);
    }

    // Step 4: Generate final itinerary (markdown)
    // PRIORITY: Use validated plan if available, otherwise fall back to free-form generation
    let itinerary: string;

    if (planIsValid && planningResult.success && planningResult.plan) {
      console.log('[Handler] Step 4: Using validated plan for rendering');
      const renderingResult = await renderItinerary(
        planningResult.plan,
        normalizedInput,
        context,
        normalizedInput.userFirstName
      );

      console.log(formatRenderingResult(renderingResult));

      if (renderingResult.success && renderingResult.markdown) {
        console.log('[Handler] ✓ Rendering from plan succeeded');
        itinerary = renderingResult.markdown;
      } else {
        console.warn('[Handler] ✗ Rendering from plan failed, falling back to free-form generation');
        console.warn('[Handler]   Reason:', renderingResult.error);
        itinerary = await generateItinerary(normalizedInput, normalizedInput.userFirstName);
      }
    } else {
      console.log('[Handler] Step 4: No valid plan available, using fallback generation');
      itinerary = await generateItinerary(normalizedInput, normalizedInput.userFirstName);
    }

    // Debug: pipeline summary
    if (isDebugEnabled()) {
      debugLogPipelineSummary({
        inputValidationSuccess: true,
        planningSuccess: planningResult.success,
        planningRepairAttempted: planningResult.repairAttempted || false,
        planningRepairSuccess: planningResult.repairResult?.success,
        validationPassed: planIsValid,
        renderingSuccess: true, // at this point we have itinerary from somewhere
      });
    }

    // Success response
    const response: ItineraryResponse = {
      success: true,
      itinerary,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Handler] Itinerary generation error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate itinerary';

    return sendErrorResponse(res, 500, errorMessage);
  }
}

/**
 * Set CORS headers for cross-origin requests
 */
function setCORSHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

/**
 * Send error response with consistent format
 */
function sendErrorResponse(
  res: VercelResponse,
  statusCode: number,
  error: string
): void {
  const response: ItineraryResponse = {
    success: false,
    itinerary: '',
    error,
  };
  res.status(statusCode).json(response);
}
