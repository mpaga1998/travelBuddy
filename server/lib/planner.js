import { buildPlanningPrompt } from './planningPrompt';
import { buildRepairPrompt } from './repairPrompt';
import { validatePlan, validatePlanLogic } from './planValidator';
/**
 * Attempt to extract and parse JSON from a response string.
 * Handles cases where model includes explanation text around JSON.
 * Returns parsed JSON object or null if extraction/parsing fails.
 */
function extractJSON(responseText) {
    try {
        // Look for JSON boundaries: first { to last }
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
            console.error('❌ [Planner] No JSON boundaries found in response');
            return null;
        }
        const jsonContent = responseText.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonContent);
        if (typeof parsed !== 'object' || parsed === null) {
            console.error('❌ [Planner] Parsed content is not an object');
            return null;
        }
        return parsed;
    }
    catch (error) {
        console.error('❌ [Planner] JSON extraction/parse error:', error instanceof Error ? error.message : error);
        return null;
    }
}
/**
 * Format validation errors for logging and error reporting.
 */
function formatValidationErrors(errors) {
    return errors.map((err) => `  ${err.path}: ${err.message}`).join('\n');
}
/**
 * Format business logic issues for logging.
 */
function formatBusinessIssues(issues) {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    let output = '';
    if (errors.length > 0) {
        output += 'ERRORS:\n' + errors.map((i) => `  [${i.rule}] ${i.message}`).join('\n');
    }
    if (warnings.length > 0) {
        if (output)
            output += '\n';
        output += 'WARNINGS:\n' + warnings.map((i) => `  [${i.rule}] ${i.message}`).join('\n');
    }
    return output;
}
/**
 * Attempt to repair an invalid plan by calling the model again with validation context.
 * Includes the invalid JSON and specific errors to guide correction.
 * Returns either a repaired valid plan or null if repair also fails.
 * Will not retry repairs (max 1 attempt).
 */
async function attemptRepair(invalidPlan, validationErrors, context, openai) {
    try {
        console.log(`🔧 [Planner] Repair attempt 1/1: Sending validation context to model...`);
        const repairPrompt = buildRepairPrompt(context, invalidPlan, validationErrors);
        const repairResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: repairPrompt,
                },
            ],
            max_tokens: 2000,
            temperature: 0.5, // Lower temperature for deterministic corrections
        });
        const repairContent = repairResponse.choices[0]?.message?.content;
        if (!repairContent) {
            console.error('❌ [Planner] No content in repair response from model');
            return null;
        }
        console.log('✅ [Planner] Repair response received, extracting and validating JSON...');
        // Extract and parse repaired JSON
        const repairedJSON = extractJSON(repairContent);
        if (!repairedJSON) {
            console.error('❌ [Planner] Could not parse JSON from repair response');
            return null;
        }
        // Validate the repaired plan (one attempt only—no further repairs)
        const repairValidation = validatePlan(repairedJSON, context.totalNights);
        if (!repairValidation.valid) {
            const errorDetails = formatValidationErrors(repairValidation.errors);
            console.error(`❌ [Planner] Repaired plan still invalid:\n${errorDetails}`);
            return null;
        }
        console.log('✅ [Planner] Repaired plan validated successfully! Continuing with corrected plan...');
        return repairValidation.plan;
    }
    catch (error) {
        console.error('❌ [Planner] Repair attempt failed with exception:', error);
        return null;
    }
}
/**
 * Call the planner model to generate a structured itinerary plan.
 * Validates the response strictly before returning.
 * On validation failure, logs detailed errors and returns error result.
 */
export async function planItinerary(context, openai) {
    try {
        console.log(`🎯 [Planner] Starting plan generation for ${context.tripLengthCategory} trip (${context.totalNights} nights)`);
        const planningPrompt = buildPlanningPrompt(context);
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: planningPrompt,
                },
            ],
            max_tokens: 2000,
            temperature: 0.7,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            console.error('❌ [Planner] No content received from OpenAI');
            return {
                success: false,
                error: 'No response from planning model',
            };
        }
        console.log('✅ [Planner] Received planner response, extracting and validating JSON...');
        // Step 1: Extract JSON from response
        const parsedJSON = extractJSON(content);
        if (!parsedJSON) {
            return {
                success: false,
                error: 'Could not parse JSON from planner response (malformed JSON)',
            };
        }
        console.log('✅ [Planner] JSON extracted successfully, validating structure...');
        // Step 2: Validate the plan structure and contents (schema validation)
        let validationResult = validatePlan(parsedJSON, context.totalNights);
        let plan;
        if (!validationResult.valid) {
            // Schema validation failed—attempt one repair with error context
            console.log(`⚠️  [Planner] Schema validation failed (${validationResult.errors.length} error(s)). Attempting automated repair...`);
            const repairedPlan = await attemptRepair(parsedJSON, validationResult.errors, context, openai);
            if (repairedPlan) {
                // Repair succeeded
                console.log('✅ [Planner] Repair successful, using corrected plan');
                plan = repairedPlan;
            }
            else {
                // Repair also failed—give up
                const errorSummary = validationResult.errors
                    .slice(0, 2)
                    .map((e) => `${e.path}: ${e.message}`)
                    .join('; ');
                console.error('❌ [Planner] Plan validation failed and repair attempt also failed');
                return {
                    success: false,
                    error: `Invalid plan from model (repair failed): ${errorSummary}...`,
                };
            }
        }
        else {
            // Schema validation passed on first try
            plan = validationResult.plan;
        }
        console.log(`✅ [Planner] Plan validated successfully. Feasible: ${plan.isFeasible}`);
        if (plan.warnings.length > 0) {
            console.log(`⚠️  [Planner] Trip warnings: ${plan.warnings.join('; ')}`);
        }
        // Step 3: Validate business logic (realistic itinerary, night allocations, departure coherence)
        console.log('🎯 [Planner] Validating business logic rules...');
        const businessValidation = validatePlanLogic(plan, context);
        if (businessValidation.issues.length > 0) {
            const issueDetails = formatBusinessIssues(businessValidation.issues);
            console.log(`⚠️  [Planner] Business logic issues found:\n${issueDetails}`);
        }
        // Separate errors from warnings
        const businessErrors = businessValidation.issues.filter((i) => i.severity === 'error');
        if (businessErrors.length > 0) {
            const errorSummary = businessErrors.map((e) => `${e.rule}: ${e.message}`).join('; ');
            console.error(`❌ [Planner] Business validation failed: ${errorSummary}`);
            return {
                success: false,
                error: `Plan violates business rules: ${errorSummary}`,
                businessIssues: businessValidation.issues,
            };
        }
        // Success: Return plan with any warnings included
        console.log('✅ [Planner] All validations passed. Plan ready for rendering.');
        return {
            success: true,
            plan,
            businessIssues: businessValidation.issues.length > 0 ? businessValidation.issues : undefined,
        };
    }
    catch (error) {
        console.error('❌ [Planner] Unexpected error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during planning',
        };
    }
}
