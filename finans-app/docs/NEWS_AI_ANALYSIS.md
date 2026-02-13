# News AI Analysis Pipeline

## Overview

The News AI Analysis pipeline generates structured AI analysis for cleaned news items using OpenAI's structured outputs with strict schema validation.

## Features

✅ **Strict Schema Validation**: Zod schema ensures consistent output format  
✅ **Safety Flag Detection**: Automatically detects forbidden financial advice keywords  
✅ **Model Selection**: Chooses fast or smart model based on content complexity  
✅ **Versioned Storage**: Stores analysis with version tracking  
✅ **Batch Processing**: CLI tool for processing multiple items  

## Schema

The analysis JSON follows this strict schema:

```typescript
{
  news_id: string (UUID),
  summary: string (2-3 sentences, max 60 words),
  markets: ["BIST" | "US" | "CRYPTO"],
  related_symbols: string[],
  sentiment: "positive" | "negative" | "neutral",
  impact_horizon: "intraday" | "days" | "weeks",
  confidence: number (0..1),
  key_reasons: string[] (1..3 items),
  watch_items: string[] (0..5 items),
  disclaimer: string (must include "Informational only, not investment advice.")
}
```

## Rules

### Summary
- Must be 2-3 sentences
- Maximum 60 words
- Must NOT quote long text from article
- Should paraphrase and synthesize

### Safety
- NEVER use words: "buy", "sell", "purchase", "invest in", etc.
- Disclaimer must include: "Informational only, not investment advice."
- Safety flags are automatically detected and stored

### Model Selection
- **Fast Model** (`gpt-4o-mini`): Used for content < 5000 chars or < 1000 words
- **Smart Model** (`gpt-4o`): Used for longer/complex content

## Usage

### Analyze Single Item

```typescript
import { analyzeNews } from '@/lib/ai/news-analysis-v2.service';

const result = await analyzeNews('clean-item-id');

if (result.success) {
  console.log('Analysis ID:', result.analysisId);
  if (result.safetyFlags) {
    console.log('Safety flags:', result.safetyFlags);
  }
}
```

### Batch Analysis (CLI)

```bash
# Analyze all items without analysis
npm run ai:analyze-news

# Analyze with limit
npm run ai:analyze-news -- --limit=20

# Analyze specific item
npm run ai:analyze-news <clean-item-id>
```

### Makefile Commands

```bash
# Analyze all
make analyze-news

# Analyze with limit
make analyze-news-limit LIMIT=20
```

## API Endpoint

### GET /api/ai/news/digest?limit=3

Returns latest cleaned news items with attached AI analysis.

**Query Parameters:**
- `limit` (optional): Max results (1-50, default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "News Title",
        "content": "News content...",
        "url": "https://...",
        "source": "Reuters",
        "publishedAt": "2024-01-15T10:30:00Z",
        "markets": ["US"],
        "tickers": ["AAPL"],
        "analysis": {
          "summary": "Brief summary...",
          "sentiment": "positive",
          "impact_horizon": "days",
          "confidence": 0.85,
          "markets": ["US"],
          "related_symbols": ["AAPL"],
          "key_reasons": ["Reason 1", "Reason 2"],
          "watch_items": ["Item 1"],
          "disclaimer": "Informational only, not investment advice.",
          "has_safety_flags": false,
          "analyzed_at": "2024-01-15T11:00:00Z"
        }
      }
    ],
    "count": 3
  }
}
```

## Safety Flag Detection

The system automatically detects forbidden keywords:

- "buy", "sell", "purchase"
- "invest in", "recommend buying", "recommend selling"
- "should buy", "should sell", "must buy", "must sell"
- "investment advice", "financial advice"
- "trading recommendation", "buy recommendation", "sell recommendation"

When detected:
- Flags are stored in `safety_flags` JSONB column
- `has_safety_flags` is set to `true` in API responses
- UI can restrict display of flagged content

## Storage

Analysis is stored in `news_ai_analysis` table:

- `id`: UUID
- `clean_id`: Foreign key to `news_items_clean`
- `analyzed_at`: Timestamp
- `model`: Model used (e.g., "gpt-4o-mini")
- `version`: Schema version (currently 1)
- `json_result`: Full analysis JSON (JSONB)
- `safety_flags`: Detected safety issues (JSONB, nullable)

## Processing Flow

```
1. Find news_items_clean without analysis
   ↓
2. Select model (fast vs smart)
   ↓
3. Generate structured analysis via OpenAI
   ↓
4. Validate with Zod schema
   ↓
5. Detect safety flags
   ↓
6. Store in news_ai_analysis
```

## Error Handling

- **Schema Validation Failure**: Automatic retry with fix instructions
- **Missing Content**: Skips items without title/content
- **API Errors**: Logged and skipped, continues with next item
- **Safety Flags**: Stored but doesn't block analysis

## Performance

- **Single Item**: ~1-3 seconds (depending on model)
- **Batch (20 items)**: ~30-60 seconds
- **Rate Limiting**: Respects OpenAI API limits

## Integration

The analysis pipeline integrates with:

- **News Cleaning**: Analyzes cleaned items
- **Embeddings**: Can link analysis to embeddings (via `analysisId`)
- **Digest API**: Provides analyzed news for UI consumption

## Example Output

```json
{
  "news_id": "550e8400-e29b-41d4-a716-446655440000",
  "summary": "Federal Reserve signals potential rate cuts as inflation cools. Markets respond positively to dovish tone. Analysts expect gradual easing throughout 2024.",
  "markets": ["US"],
  "related_symbols": ["SPY", "TLT"],
  "sentiment": "positive",
  "impact_horizon": "weeks",
  "confidence": 0.85,
  "key_reasons": [
    "Dovish Fed communication",
    "Inflation trending downward"
  ],
  "watch_items": [
    "Next Fed meeting",
    "Inflation data releases"
  ],
  "disclaimer": "Informational only, not investment advice."
}
```

## Troubleshooting

### Analysis Fails

1. Check OpenAI API key: `echo $OPENAI_API_KEY`
2. Verify news item exists: Check `news_items_clean` table
3. Review logs for specific errors

### Safety Flags Triggered

1. Review detected keywords in `safety_flags`
2. Check if false positive (e.g., "buy" in context of "buyback")
3. Adjust keyword list if needed

### Schema Validation Errors

1. Check OpenAI model supports structured outputs
2. Review schema definition in code
3. Check retry logs for fix attempts

## Next Steps

1. **Monitor Safety Flags**: Track frequency and patterns
2. **Refine Keywords**: Adjust forbidden keyword list based on false positives
3. **Optimize Prompts**: Improve analysis quality through prompt engineering
4. **Batch Scheduling**: Set up cron jobs for regular analysis

## See Also

- `docs/OPENAI_STRUCTURED.md` - Structured OpenAI client documentation
- `src/lib/ai/news-analysis-v2.service.ts` - Implementation
- `scripts/analyze-news.ts` - CLI script
