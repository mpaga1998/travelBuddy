# OpenAI Service Configuration

This document describes all environment variables for the OpenAI service layer.

## Required Variables

### `OPENAI_API_KEY`
- **Required**: Yes
- **Type**: string
- **Description**: Your OpenAI API key
- **Example**: `sk-proj-...`
- **How to get**: Visit https://platform.openai.com/api-keys

## Optional: Model Configuration

These allow you to use different models for different purposes.

### `OPENAI_PLANNING_MODEL`
- **Default**: `gpt-3.5-turbo`
- **Type**: string
- **Description**: Model to use for structured trip planning (generates JSON)
- **Options**: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo-preview`, etc.

### `OPENAI_REPAIR_MODEL`
- **Default**: `gpt-3.5-turbo`
- **Type**: string
- **Description**: Model to use for fixing invalid plans based on feedback
- **Options**: Same as above

### `OPENAI_RENDERING_MODEL`
- **Default**: `gpt-3.5-turbo`
- **Type**: string
- **Description**: Model to use for converting plans to markdown itineraries
- **Options**: Same as above

## Optional: Temperature Configuration

Temperature controls randomness/creativity (0 = deterministic, 2 = very random).

### `OPENAI_PLANNING_TEMPERATURE`
- **Default**: `0.7`
- **Type**: float (0-2)
- **Description**: Creativity for trip planning
- **Notes**: Higher = more creative route suggestions

### `OPENAI_REPAIR_TEMPERATURE`
- **Default**: `0.5`
- **Type**: float (0-2)
- **Description**: Determinism for plan repairs
- **Notes**: Lower = more focused on fixing errors precisely

### `OPENAI_RENDERING_TEMPERATURE`
- **Default**: `0.8`
- **Type**: float (0-2)
- **Description**: Creativity for markdown writing
- **Notes**: Higher = more engaging prose

## Optional: Token Limits

These control maximum response lengths per API call.

### `OPENAI_PLANNING_MAX_TOKENS`
- **Default**: `2000`
- **Type**: integer
- **Description**: Max tokens for planning request
- **Notes**: JSON is compact; 2000 is usually sufficient

### `OPENAI_REPAIR_MAX_TOKENS`
- **Default**: `2000`
- **Type**: integer
- **Description**: Max tokens for repair request
- **Notes**: Similar to planning; returning corrected JSON

### `OPENAI_RENDERING_MAX_TOKENS`
- **Default**: `3000`
- **Type**: integer
- **Description**: Max tokens for rendering request
- **Notes**: Markdown is verbose; 3000 allows detailed itineraries

## Optional: Request Timeout

### `OPENAI_TIMEOUT_MS`
- **Default**: `30000` (30 seconds)
- **Type**: integer (milliseconds)
- **Description**: How long to wait for OpenAI API responses
- **Notes**: Increase if experiencing timeout issues on slow networks

## Example `.env` File

```bash
# Required
OPENAI_API_KEY=sk-proj-your-key-here

# Models (optional - uses defaults if not set)
OPENAI_PLANNING_MODEL=gpt-3.5-turbo
OPENAI_REPAIR_MODEL=gpt-3.5-turbo
OPENAI_RENDERING_MODEL=gpt-3.5-turbo

# Temperatures (optional - uses defaults if not set)
OPENAI_PLANNING_TEMPERATURE=0.7
OPENAI_REPAIR_TEMPERATURE=0.5
OPENAI_RENDERING_TEMPERATURE=0.8

# Token limits (optional - uses defaults if not set)
OPENAI_PLANNING_MAX_TOKENS=2000
OPENAI_REPAIR_MAX_TOKENS=2000
OPENAI_RENDERING_MAX_TOKENS=3000

# Timeout (optional - uses default if not set)
OPENAI_TIMEOUT_MS=30000
```

## Advanced: Using Different Models Per Use Case

For cost optimization or quality tuning:

```bash
# Use GPT-4 only for important repair step
OPENAI_PLANNING_MODEL=gpt-3.5-turbo
OPENAI_REPAIR_MODEL=gpt-4
OPENAI_RENDERING_MODEL=gpt-3.5-turbo
```

For better planning quality:

```bash
# Use the best model for planning
OPENAI_PLANNING_MODEL=gpt-4-turbo-preview
OPENAI_REPAIR_MODEL=gpt-3.5-turbo
OPENAI_RENDERING_MODEL=gpt-3.5-turbo
```

## Pricing Considerations

As of March 2026, costs vary by model. Here's a rough calculation for a typical call:

**Planning (2000 tokens out)**
- gpt-3.5-turbo: ~$0.001
- gpt-4: ~$0.01

**Rendering (3000 tokens out)**
- gpt-3.5-turbo: ~0.0015
- gpt-4: ~$0.015

Default (3.5-turbo for all): ~$0.004 per itinerary
Premium (GPT-4 for all): ~$0.04 per itinerary

## Troubleshooting

### "OPENAI_API_KEY not found"
- Ensure `OPENAI_API_KEY` is set in your `.env` file
- Restart the application after adding env vars
- Check that the key is valid (visit https://platform.openai.com/account/api-keys)

### Timeouts
- Increase `OPENAI_TIMEOUT_MS` to 60000 (60 seconds)
- Check your network connection
- Consider using a faster model or reducing max_tokens

### Quality Issues
- Adjust temperature settings (lower = more consistent, higher = more creative)
- Try using a better model (e.g., GPT-4)
- Add more detail to trip input

### Cost Too High
- Switch to gpt-3.5-turbo for all operations
- Reduce max_tokens values
- Batch requests if possible
