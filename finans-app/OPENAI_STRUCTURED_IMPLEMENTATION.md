# OpenAI Structured Responses Implementation

## ✅ Implementation Complete

A reusable OpenAI client wrapper for structured JSON responses has been implemented with full schema validation, retry logic, observability, and safety features.

## Files Created

### Core Module

1. **`src/lib/ai/openai-structured.ts`**
   - Main wrapper module for structured OpenAI responses
   - Zod schema validation with automatic retry
   - Observability (request ID, latency, token usage)
   - Safety system messages
   - Tool calling support (placeholder)

### Documentation

2. **`docs/OPENAI_STRUCTURED.md`**
   - Complete usage guide
   - API reference
   - Examples and best practices

### Configuration

3. **`.env.example`** (Updated)
   - Added `OPENAI_MODEL_FAST` and `OPENAI_MODEL_SMART` configuration
   - Added `LOG_OPENAI` for request logging

### Exports

4. **`src/lib/ai/index.ts`** (Updated)
   - Exports the new structured client

## Features

### ✅ Structured JSON Output

- Uses OpenAI's `json_schema` response format
- Converts Zod schemas to JSON Schema using `zod-to-json-schema`
- Enforces strict schema compliance
- Validates with Zod after receiving response

### ✅ Automatic Retry

- Retries once on schema validation failure
- Includes explicit fix instructions in retry
- Logs retry attempts for observability

### ✅ Observability

- Unique request ID for each request
- Latency tracking (milliseconds)
- Token usage (prompt, completion, total)
- Success/failure status logging
- Retry attempt tracking

### ✅ Safety

- Built-in system message preventing financial advice
- No buy/sell recommendations
- Uncertainty and limitations acknowledgment
- Neutral, factual language enforcement

### ✅ Configuration

- `OPENAI_MODEL_FAST`: Fast model (default: `gpt-4o-mini`)
- `OPENAI_MODEL_SMART`: Smart model (default: `gpt-4o`)
- `LOG_OPENAI`: Enable request logging

## API

### Main Function

```typescript
responsesJsonSchema<T>(
  model: string,
  systemPrompt: string,
  userInput: string,
  jsonSchema: z.ZodSchema<T>
): Promise<StructuredResponse<T>>
```

### Advanced Function

```typescript
responsesJsonSchemaWithOptions<T>(
  options: JsonSchemaRequest
): Promise<StructuredResponse<T>>
```

### Tool Calling (Future)

```typescript
toolCallingFlow(
  model: string,
  systemPrompt: string,
  userInput: string,
  tools: ChatCompletionTool[]
): Promise<ChatCompletion>
```

## Response Structure

```typescript
interface StructuredResponse<T> {
  json: T;                    // Validated, typed JSON
  raw: ChatCompletion;        // Full OpenAI response
  requestId?: string;         // Unique identifier
  latency: number;           // Milliseconds
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## Usage Example

```typescript
import { responsesJsonSchema, OPENAI_MODEL_FAST } from '@/lib/ai/openai-structured';
import { z } from 'zod';

const schema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  score: z.number().min(-1).max(1),
});

const result = await responsesJsonSchema(
  OPENAI_MODEL_FAST,
  'Analyze this news article.',
  'Article content...',
  schema
);

console.log(result.json.summary);  // Type-safe access
console.log(result.latency);       // Request latency
console.log(result.usage);         // Token usage
```

## Dependencies

- `openai`: Official OpenAI SDK
- `zod`: Schema validation
- `zod-to-json-schema`: Zod to JSON Schema conversion

## Safety Message

All requests automatically include:

```
You are a financial analysis assistant. Important guidelines:
- Provide analysis and insights only, NOT financial advice
- Do NOT recommend buy/sell decisions
- Always cite uncertainty and limitations in your analysis
- Base conclusions on provided data and acknowledge when data is incomplete
- Use neutral, factual language
```

## Observability Logging

Example log output:

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

Logging enabled when:
- `NODE_ENV === 'development'`, OR
- `LOG_OPENAI === 'true'`

## Error Handling

- **Invalid JSON**: Caught and logged with parse error
- **Schema Validation Failure**: Automatic retry with fix instructions
- **API Errors**: Propagated with full context
- **Network Errors**: Standard error handling

## Next Steps

1. **Migrate existing services**: Update `news-analysis.service.ts` and other AI services to use the new wrapper
2. **Add tool calling**: Implement full tool calling flow when needed
3. **Monitor usage**: Track token usage and costs
4. **Optimize prompts**: Reduce token usage where possible

## Integration Points

The wrapper can be used to replace direct OpenAI calls in:

- `src/lib/ai/news-analysis.service.ts`
- `src/lib/ai/investor-profile.service.ts`
- `src/lib/ai/portfolio-insights.service.ts`

This will provide:
- Consistent schema validation
- Better error handling
- Observability across all AI operations
- Safety compliance

## Testing

To test the wrapper:

```typescript
import { responsesJsonSchema, OPENAI_MODEL_FAST } from '@/lib/ai/openai-structured';
import { z } from 'zod';

const testSchema = z.object({
  message: z.string(),
  count: z.number(),
});

const result = await responsesJsonSchema(
  OPENAI_MODEL_FAST,
  'Return a test response.',
  'Generate test data.',
  testSchema
);

console.log('Result:', result.json);
console.log('Latency:', result.latency);
```

## Documentation

See `docs/OPENAI_STRUCTURED.md` for:
- Complete API reference
- Usage examples
- Best practices
- Troubleshooting guide

The OpenAI structured responses client is ready for production use! 🚀
