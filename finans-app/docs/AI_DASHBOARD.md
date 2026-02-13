# AI Dashboard Endpoint

## Overview

Single aggregated endpoint for frontend dashboard that combines all AI-generated data with caching and graceful error handling.

## Endpoint

### GET /api/ai/dashboard/:userId

Returns aggregated AI data for dashboard display.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "last_updated": "2024-01-15T10:30:00Z",
      "notes": [
        "3 analyzed news item(s) available",
        "Investor profile analysis complete"
      ]
    },
    "news_digest": [
      {
        "id": "uuid",
        "title": "News Title",
        "content": "...",
        "url": "https://...",
        "source": "Reuters",
        "publishedAt": "2024-01-15T10:00:00Z",
        "markets": ["US"],
        "tickers": ["AAPL"],
        "analysis": {
          "summary": "...",
          "sentiment": "positive",
          "impact_horizon": "days",
          "confidence": 0.85,
          "markets": ["US"],
          "related_symbols": ["AAPL"],
          "key_reasons": ["..."],
          "watch_items": ["..."],
          "disclaimer": "Informational only, not investment advice.",
          "has_safety_flags": false,
          "analyzed_at": "2024-01-15T10:05:00Z"
        }
      }
    ],
    "investor_profile": {
      "user_id": "uuid",
      "risk_level": "medium",
      "horizon": "long",
      "style_tags": ["diversified", "growth-focused"],
      "explanation": ["...", "...", "..."],
      "disclaimer": "Informational only, not investment advice.",
      "computed_at": "2024-01-15T09:00:00Z",
      "version": "1"
    },
    "portfolio_insights": {
      "user_id": "uuid",
      "computed_at": "2024-01-15T09:30:00Z",
      "cards": [
        {
          "id": "concentration",
          "title": "Concentration Risk",
          "severity": "warning",
          "metric": "28.5% (med)",
          "details": ["..."],
          "disclaimer": "Informational only, not investment advice."
        }
      ],
      "version": "1"
    },
    "errors": ["News digest: OpenAI API timeout"]
  }
}
```

## Features

### ✅ In-Memory Caching

- **TTL**: 30 seconds
- **Key**: `dashboard:${userId}`
- **Benefits**: Reduces database and API calls
- **Auto-cleanup**: Expired entries cleaned every 5 minutes

### ✅ Graceful Fallback

- Returns partial data if some sources fail
- Errors are included in response (not thrown)
- Dashboard can display available data
- No OpenAI dependency for portfolio insights (deterministic)

### ✅ Request Logging

Logs include:
- User ID
- Timestamp
- Duration (ms)
- Cache hit/miss
- Errors encountered

**Log Format:**
```json
{
  "userId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "duration": 245,
  "cached": false,
  "errors": []
}
```

## Data Sources

### 1. News Digest

- Fetches 3 latest analyzed news items
- Includes full AI analysis
- Falls back to empty array if unavailable

### 2. Investor Profile

- Fetches existing profile from database
- Returns null if not found
- No generation on-demand (use recompute endpoint)

### 3. Portfolio Insights

- Fetches existing insights
- Auto-generates if missing (deterministic, no OpenAI)
- Returns null if generation fails

### 4. Summary

- **last_updated**: Current timestamp
- **notes**: 0-2 contextual notes based on data availability

## Summary Notes

Notes are generated based on:

- News digest availability
- Investor profile status
- Portfolio insights severity (critical/warning counts)
- Error conditions

Examples:
- "3 analyzed news item(s) available"
- "Investor profile analysis complete"
- "1 critical portfolio insight(s) require attention"
- "2 data source(s) unavailable"

## Error Handling

### Partial Failures

If one data source fails:
- Other sources still return data
- Error message included in `errors` array
- Response still returns 200 OK

### Example with Errors

```json
{
  "success": true,
  "data": {
    "summary": {
      "last_updated": "2024-01-15T10:30:00Z",
      "notes": ["2 data source(s) unavailable"]
    },
    "news_digest": [],
    "investor_profile": null,
    "portfolio_insights": {
      "cards": [...]
    },
    "errors": [
      "News digest: OpenAI API timeout",
      "Investor profile: Profile not found"
    ]
  }
}
```

## Caching Strategy

### Cache Key

```
dashboard:${userId}
```

### Cache TTL

30 seconds (configurable via `CACHE_TTL` constant)

### Cache Invalidation

- Automatic expiration after TTL
- Manual invalidation: Delete cache entry
- Background cleanup every 5 minutes

## Performance

- **Cached Request**: ~5-10ms
- **Uncached Request**: ~200-500ms (depends on data availability)
- **Parallel Fetching**: All data sources fetched concurrently

## Usage

### Frontend Integration

```typescript
const response = await fetch(`/api/ai/dashboard/${userId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const data = await response.json();

if (data.success) {
  // Display dashboard with data
  const { summary, news_digest, investor_profile, portfolio_insights, errors } = data.data;
  
  if (errors && errors.length > 0) {
    // Show partial data with error notifications
    console.warn('Some data unavailable:', errors);
  }
}
```

## Configuration

### Environment Variables

```bash
# Enable request logging (default: development only)
LOG_DASHBOARD=true
```

### Cache TTL

Modify `CACHE_TTL` constant in route file (default: 30 seconds)

## Monitoring

### Request Logs

Enable logging:
```bash
LOG_DASHBOARD=true npm run dev
```

### Cache Performance

Monitor cache hit rate via logs:
- `cached: true` = Cache hit
- `cached: false` = Cache miss

## Troubleshooting

### Slow Responses

1. Check cache hit rate (should be high after first request)
2. Verify database indexes
3. Check OpenAI API latency (if generating profiles)

### Missing Data

1. Check `errors` array in response
2. Verify data exists in database
3. Check logs for specific error messages

### Cache Not Working

1. Verify cache TTL is set correctly
2. Check if cache is being cleared
3. Verify cache key format

## See Also

- `src/app/api/ai/dashboard/[userId]/route.ts` - Implementation
- `src/lib/cache/simple-cache.ts` - Cache utility
- `docs/NEWS_AI_ANALYSIS.md` - News analysis docs
- `docs/INVESTOR_PROFILE.md` - Investor profile docs
- `docs/PORTFOLIO_INSIGHTS.md` - Portfolio insights docs
