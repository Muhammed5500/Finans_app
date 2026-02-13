# OpenAI Structured Responses Client

## Overview

A reusable wrapper for OpenAI API that enforces structured JSON output with Zod validation, automatic retries, observability, and built-in safety guidelines.

## Features

✅ **Structured JSON Output**: Enforces JSON schema compliance using OpenAI's structured outputs  
✅ **Zod Validation**: Validates responses with Zod schemas  
✅ **Automatic Retry**: Retries once on invalid schema responses with fix instructions  
✅ **Observability**: Logs request ID, model, latency, and token usage  
✅ **Safety**: Built-in system message preventing financial advice  
✅ **Configurable**: Model selection via environment variables  

## Installation

The module uses the official OpenAI SDK and `zod-to-json-schema`:

```bash
npm install openai zod zod-to-json-schema
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-key-here

# Optional: Model selection
OPENAI_MODEL_FAST=gpt-4o-mini    # Default: gpt-4o-mini
OPENAI_MODEL_SMART=gpt-4o        # Default: gpt-4o

# Optional: Enable request logging
LOG_OPENAI=true                   # Logs all requests in development
```

## Usage

### Basic Usage

```typescript
import { responsesJsonSchema, OPENAI_MODEL_FAST } from '@/lib/ai/openai-structured';
import { z } from 'zod';

// Define your schema
const NewsAnalysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  sentimentScore: z.number().min(-1).max(1),
  impactHorizon: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
  relatedSymbols: z.array(z.string()),
});

type NewsAnalysis = z.infer<typeof NewsAnalysisSchema>;

// Make request
const result = await responsesJsonSchema<NewsAnalysis>(
  OPENAI_MODEL_FAST,
  'You are a financial news analyst. Analyze the following article.',
  'Article content here...',
  NewsAnalysisSchema
);

console.log(result.json);        // Typed result
console.log(result.latency);     // Request latency in ms
console.log(result.usage);       // Token usage
console.log(result.requestId);  // Unique request ID
```

### Advanced Usage with Options

```typescript
import { responsesJsonSchemaWithOptions } from '@/lib/ai/openai-structured';

const result = await responsesJsonSchemaWithOptions({
  model: OPENAI_MODEL_SMART,
  systemPrompt: 'Analyze this financial data...',
  userInput: 'Data here...',
  jsonSchema: MySchema,
  temperature: 0.3,        // Lower temperature for more deterministic output
  maxTokens: 1000,         // Limit response length
  retryOnInvalid: true,    // Enable retry on schema validation failure
});
```

### Tool Calling (Future)

```typescript
import { toolCallingFlow } from '@/lib/ai/openai-structured';

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get current stock price',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
        },
        required: ['symbol'],
      },
    },
  },
];

const response = await toolCallingFlow(
  OPENAI_MODEL_FAST,
  'You are a financial assistant.',
  'What is the price of AAPL?',
  tools
);
```

## Response Structure

```typescript
interface StructuredResponse<T> {
  json: T;                    // Validated, typed JSON response
  raw: ChatCompletion;        // Full OpenAI response
  requestId?: string;         // Unique request identifier
  latency: number;           // Request latency in milliseconds
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## Safety Guidelines

The wrapper automatically prepends a safety system message to all requests:

```
You are a financial analysis assistant. Important guidelines:
- Provide analysis and insights only, NOT financial advice
- Do NOT recommend buy/sell decisions
- Always cite uncertainty and limitations in your analysis
- Base conclusions on provided data and acknowledge when data is incomplete
- Use neutral, factual language
```

This ensures all AI-generated content follows financial compliance best practices.

## Schema Validation & Retry

1. **First Attempt**: Request sent with JSON schema constraint
2. **Zod Validation**: Response validated against Zod schema
3. **On Failure**: Automatic retry with explicit fix instructions
4. **On Success**: Return typed, validated result

The retry includes:
- The original schema in JSON format
- Specific validation errors
- Explicit instructions to fix the response

## Observability

Request logging includes:

```json
{
  "requestId": "req_1234567890_abc123",
  "model": "gpt-4o-mini",
  "latency": "1250ms",
  "tokens": "450 (prompt: 200, completion: 250)",
  "retry": 0,
  "status": "✅",
  "error": null
}
```

Logging is enabled when:
- `NODE_ENV === 'development'`, OR
- `LOG_OPENAI === 'true'`

## Error Handling

The wrapper handles:

- **Invalid JSON**: Parsing errors are caught and logged
- **Schema Validation Failure**: Automatic retry with fix instructions
- **API Errors**: OpenAI API errors are propagated with context
- **Network Errors**: Standard error handling with observability

## Best Practices

### 1. Define Clear Schemas

```typescript
// ✅ Good: Specific, typed schema
const schema = z.object({
  summary: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
});

// ❌ Bad: Too loose
const schema = z.any();
```

### 2. Use Appropriate Models

```typescript
// Fast, simple tasks
await responsesJsonSchema(OPENAI_MODEL_FAST, ...);

// Complex analysis
await responsesJsonSchema(OPENAI_MODEL_SMART, ...);
```

### 3. Set Temperature Appropriately

```typescript
// Deterministic output (analysis, extraction)
temperature: 0.3

// Creative tasks (summaries, insights)
temperature: 0.7
```

### 4. Monitor Token Usage

```typescript
const result = await responsesJsonSchema(...);
console.log(`Used ${result.usage?.totalTokens} tokens`);
```

## Examples

### News Analysis

```typescript
const analysis = await responsesJsonSchema(
  OPENAI_MODEL_FAST,
  'Analyze financial news articles.',
  articleContent,
  NewsAnalysisSchema
);

// Type-safe access
console.log(analysis.json.sentiment);
console.log(analysis.json.relatedSymbols);
```

### Portfolio Insights

```typescript
const insights = await responsesJsonSchema(
  OPENAI_MODEL_SMART,
  'Generate portfolio risk insights.',
  portfolioData,
  PortfolioInsightsSchema
);
```

## Migration from Direct OpenAI Calls

### Before

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
});

const parsed = JSON.parse(response.choices[0].message.content);
// No validation, no retry, no observability
```

### After

```typescript
const result = await responsesJsonSchema(
  OPENAI_MODEL_FAST,
  systemPrompt,
  userInput,
  MySchema
);

// Validated, typed, observable
console.log(result.json);
```

## Troubleshooting

### Schema Validation Fails

1. Check schema definition matches expected output
2. Review error message for specific field issues
3. Verify model supports structured outputs (gpt-4o, gpt-4o-mini, etc.)

### High Latency

1. Use `OPENAI_MODEL_FAST` for simple tasks
2. Reduce `maxTokens` if response is too long
3. Check network connectivity

### Token Usage High

1. Optimize prompts (shorter system/user messages)
2. Use `maxTokens` to limit response length
3. Consider using faster model for simple tasks

## API Reference

### `responsesJsonSchema<T>(model, systemPrompt, userInput, jsonSchema)`

Main function for structured JSON responses.

**Parameters:**
- `model: string` - OpenAI model name
- `systemPrompt: string` - System message
- `userInput: string` - User input
- `jsonSchema: z.ZodSchema<T>` - Zod schema for validation

**Returns:** `Promise<StructuredResponse<T>>`

### `responsesJsonSchemaWithOptions<T>(options)`

Advanced function with full options.

**Parameters:**
- `options: JsonSchemaRequest` - Request options

**Returns:** `Promise<StructuredResponse<T>>`

### `toolCallingFlow(model, systemPrompt, userInput, tools)`

Function calling support (future).

**Parameters:**
- `model: string` - OpenAI model name
- `systemPrompt: string` - System message
- `userInput: string` - User input
- `tools: ChatCompletionTool[]` - Tool definitions

**Returns:** `Promise<ChatCompletion>`

## See Also

- [OpenAI Structured Outputs Documentation](https://platform.openai.com/docs/guides/structured-outputs)
- [Zod Documentation](https://zod.dev/)
- [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)
