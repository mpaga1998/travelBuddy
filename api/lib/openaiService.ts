/**
 * OpenAI Service Layer
 * Centralizes all OpenAI API calls with configurable models, temperatures, and tokens
 * Provides separate methods for planning, repair, and rendering workflows
 */

import OpenAI from 'openai';

/**
 * Configuration for OpenAI service
 */
export interface OpenAIServiceConfig {
  apiKey: string;

  // Model names (configurable via environment)
  planningModel: string;
  repairModel: string;
  renderingModel: string;

  // Temperature settings (0-2)
  planningTemperature: number;
  repairTemperature: number;
  renderingTemperature: number;

  // Token limits
  planningMaxTokens: number;
  repairMaxTokens: number;
  renderingMaxTokens: number;

  // Timeout in milliseconds
  timeout: number;
}

/**
 * OpenAI call request
 */
export interface OpenAIRequest {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * OpenAI call response
 */
export interface OpenAIResponse {
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
}

/**
 * Use case types for logging/configuration
 */
export type UseCase = 'planning' | 'repair' | 'rendering';

/**
 * Build configuration from environment variables with sensible defaults
 */
export function buildOpenAIConfig(env: Record<string, string | undefined>): OpenAIServiceConfig {
  const apiKey = env.OPENAI_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable must be set. Add to .env or system environment.'
    );
  }

  return {
    apiKey,

    // Models - configurable, with defaults
    planningModel: env.OPENAI_PLANNING_MODEL || 'gpt-3.5-turbo',
    repairModel: env.OPENAI_REPAIR_MODEL || 'gpt-3.5-turbo',
    renderingModel: env.OPENAI_RENDERING_MODEL || 'gpt-3.5-turbo',

    // Temperatures
    planningTemperature: parseFloat(env.OPENAI_PLANNING_TEMPERATURE || '0.7'),
    repairTemperature: parseFloat(env.OPENAI_REPAIR_TEMPERATURE || '0.5'),
    renderingTemperature: parseFloat(env.OPENAI_RENDERING_TEMPERATURE || '0.8'),

    // Token limits
    planningMaxTokens: parseInt(env.OPENAI_PLANNING_MAX_TOKENS || '2000', 10),
    repairMaxTokens: parseInt(env.OPENAI_REPAIR_MAX_TOKENS || '2000', 10),
    renderingMaxTokens: parseInt(env.OPENAI_RENDERING_MAX_TOKENS || '3000', 10),

    // Timeout
    timeout: parseInt(env.OPENAI_TIMEOUT_MS || '30000', 10),
  };
}

/**
 * OpenAI Service - handles all interactions with OpenAI API
 */
export class OpenAIService {
  private client: OpenAI;
  private config: OpenAIServiceConfig;

  constructor(config: OpenAIServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
  }

  /**
   * Make a planning call (structured JSON generation)
   */
  async callPlanning(request: OpenAIRequest): Promise<OpenAIResponse> {
    return this.makeCall('planning', request);
  }

  /**
   * Make a repair call (fix invalid plan based on feedback)
   */
  async callRepair(request: OpenAIRequest): Promise<OpenAIResponse> {
    return this.makeCall('repair', request);
  }

  /**
   * Make a rendering call (markdown generation)
   */
  async callRendering(request: OpenAIRequest): Promise<OpenAIResponse> {
    return this.makeCall('rendering', request);
  }

  /**
   * Internal: Execute OpenAI API call with config per use case
   */
  private async makeCall(useCase: UseCase, request: OpenAIRequest): Promise<OpenAIResponse> {
    const model = this.getModel(useCase);
    const temperature = this.getTemperature(useCase);
    const maxTokens = this.getMaxTokens(useCase);

    console.log(`[OpenAI:${useCase}] Calling ${model} (temp=${temperature}, tokens=${maxTokens})`);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';

      const tokenInfo = {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      };

      console.log(`[OpenAI:${useCase}] ✓ Success (${tokenInfo.total} tokens)`);

      return {
        content,
        tokens: tokenInfo,
        model,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'unknown error';
      console.error(`[OpenAI:${useCase}] ✗ Failed: ${errorMsg}`);
      throw err;
    }
  }

  /**
   * Get model name for use case
   */
  private getModel(useCase: UseCase): string {
    switch (useCase) {
      case 'planning':
        return this.config.planningModel;
      case 'repair':
        return this.config.repairModel;
      case 'rendering':
        return this.config.renderingModel;
      default:
        return this.config.planningModel;
    }
  }

  /**
   * Get temperature for use case
   */
  private getTemperature(useCase: UseCase): number {
    switch (useCase) {
      case 'planning':
        return this.config.planningTemperature;
      case 'repair':
        return this.config.repairTemperature;
      case 'rendering':
        return this.config.renderingTemperature;
      default:
        return 0.7;
    }
  }

  /**
   * Get max tokens for use case
   */
  private getMaxTokens(useCase: UseCase): number {
    switch (useCase) {
      case 'planning':
        return this.config.planningMaxTokens;
      case 'repair':
        return this.config.repairMaxTokens;
      case 'rendering':
        return this.config.renderingMaxTokens;
      default:
        return 2000;
    }
  }

  /**
   * Get current configuration (for debugging, omits API key)
   */
  getConfigSummary(): Record<string, string | number> {
    return {
      planningModel: this.config.planningModel,
      repairModel: this.config.repairModel,
      renderingModel: this.config.renderingModel,
      planningTemperature: this.config.planningTemperature,
      repairTemperature: this.config.repairTemperature,
      renderingTemperature: this.config.renderingTemperature,
      planningMaxTokens: this.config.planningMaxTokens,
      repairMaxTokens: this.config.repairMaxTokens,
      renderingMaxTokens: this.config.renderingMaxTokens,
      timeout: this.config.timeout,
    };
  }
}

/**
 * Global service instance (singleton)
 * Initialize once at startup
 */
let globalService: OpenAIService | null = null;

/**
 * Initialize the global OpenAI service
 * Call this once at application startup
 */
export function initializeOpenAIService(env: Record<string, string | undefined>): OpenAIService {
  const config = buildOpenAIConfig(env);
  globalService = new OpenAIService(config);
  console.log('[OpenAI] Service initialized with config:', globalService.getConfigSummary());
  return globalService;
}

/**
 * Get the global OpenAI service instance
 * Throws if not initialized
 */
export function getOpenAIService(): OpenAIService {
  if (!globalService) {
    throw new Error(
      'OpenAI service not initialized. Call initializeOpenAIService(process.env) at startup.'
    );
  }
  return globalService;
}
