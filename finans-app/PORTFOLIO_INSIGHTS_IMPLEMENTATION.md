# Portfolio Insights Cards - Implementation Summary

## ✅ Implementation Complete

The Portfolio Insights Cards system has been fully implemented with deterministic calculations from portfolio snapshots.

## Files Created

### Core Service

1. **`src/lib/ai/portfolio-insights-v2.service.ts`**
   - Deterministic insight calculations
   - Concentration risk analysis
   - Currency exposure analysis
   - Volatility exposure (crypto percentage)
   - Diversification score

### API Endpoint

2. **`src/app/api/ai/portfolio-insights/[userId]/route.ts`**
   - GET endpoint for fetching portfolio insights
   - Auto-generates if not exists

### Documentation

3. **`docs/PORTFOLIO_INSIGHTS.md`**
   - Complete usage guide
   - Schema documentation
   - API reference

## Features

### ✅ Deterministic Calculations

All insights are rule-based (no LLM required):

- **Concentration Risk**: Top holding percentage with label (low/med/high)
- **Currency Exposure**: TL vs USD vs other percentages
- **Volatility Exposure**: Crypto percentage
- **Diversification Score**: Heuristic based on holdings count and category balance

### ✅ Severity Levels

- **info**: Normal or acceptable levels
- **warning**: Moderate concern
- **critical**: Significant risk

### ✅ No Advice Policy

- All insights are observations only
- No "do X" or "should Y" language
- Only factual statements
- Standard disclaimer on every card

## Schema

```typescript
{
  user_id: string (UUID),
  computed_at: string (ISO timestamp),
  cards: [
    {
      id: string,
      title: string,
      severity: "info" | "warning" | "critical",
      metric: string,
      details: string[],
      disclaimer: "Informational only, not investment advice."
    }
  ]
}
```

## Insight Cards

### 1. Concentration Risk

- **ID**: `concentration`
- **Metric**: Top holding percentage with label
- **Severity**:
  - `critical`: > 35% (high)
  - `warning`: 20-35% (med)
  - `info`: < 20% (low)

### 2. Currency Exposure

- **ID**: `currency_exposure`
- **Metric**: Dominant currency percentage
- **Severity**:
  - `warning`: Single currency > 90%
  - `info`: Otherwise

### 3. Volatility Exposure

- **ID**: `volatility`
- **Metric**: Crypto percentage
- **Severity**:
  - `critical`: > 30% crypto
  - `warning`: 15-30% crypto
  - `info`: < 15% crypto

### 4. Diversification Score

- **ID**: `diversification`
- **Metric**: Score label (High/Medium/Low/Very Low)
- **Severity**:
  - `critical`: Very Low
  - `warning`: Low
  - `info`: Medium/High

## Usage

### Generate Insights

```typescript
import { generatePortfolioInsightsV2 } from '@/lib/ai/portfolio-insights-v2.service';

const result = await generatePortfolioInsightsV2(userId);

if (result.success) {
  console.log('Insights:', result.insights);
}
```

### API Endpoint

#### GET /api/ai/portfolio-insights/:userId

Returns portfolio insights. Generates if they don't exist.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "computed_at": "2024-01-15T10:30:00Z",
    "cards": [
      {
        "id": "concentration",
        "title": "Concentration Risk",
        "severity": "warning",
        "metric": "28.5% (med)",
        "details": [...],
        "disclaimer": "Informational only, not investment advice."
      }
    ],
    "version": "1"
  }
}
```

## Processing Flow

```
1. Fetch user and latest portfolio snapshot
   ↓
2. Calculate concentration risk
   - Top holding percentage
   - Top 3 concentration
   ↓
3. Calculate currency exposure
   - Group by currency
   - Infer currency if missing
   ↓
4. Calculate volatility exposure
   - Crypto percentage
   ↓
5. Calculate diversification score
   - Number of holdings
   - Category balance
   ↓
6. Generate insight cards
   ↓
7. Store in portfolio_ai_insights (version=1)
```

## Currency Inference

If currency is not specified, the system infers:

- **Crypto**: USD
- **BIST stocks**: TRY (4 uppercase letters)
- **Other stocks**: USD

## Storage

Insights are stored in `portfolio_ai_insights` table:

- `id`: UUID
- `user_id`: Foreign key to users
- `computed_at`: Timestamp
- `version`: Schema version (currently "1")
- `json_result`: Full insights JSON (JSONB)

## Example Output

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "computed_at": "2024-01-15T10:30:00Z",
  "cards": [
    {
      "id": "concentration",
      "title": "Concentration Risk",
      "severity": "warning",
      "metric": "28.5% (med)",
      "details": [
        "Top holding (AAPL) represents 28.5% of portfolio value",
        "Top 3 holdings represent 65.2% of portfolio",
        "Moderate concentration detected"
      ],
      "disclaimer": "Informational only, not investment advice."
    },
    {
      "id": "currency_exposure",
      "title": "Currency Exposure",
      "severity": "info",
      "metric": "USD: 72.3%",
      "details": [
        "US Dollar (USD): 72.3%",
        "Turkish Lira (TRY): 12.5%"
      ],
      "disclaimer": "Informational only, not investment advice."
    },
    {
      "id": "volatility",
      "title": "Volatility Exposure",
      "severity": "warning",
      "metric": "18.5% crypto",
      "details": [
        "Cryptocurrency allocation: 18.5%",
        "Moderate crypto exposure increases portfolio volatility"
      ],
      "disclaimer": "Informational only, not investment advice."
    },
    {
      "id": "diversification",
      "title": "Diversification Score",
      "severity": "info",
      "metric": "Medium",
      "details": [
        "8 holdings provides moderate diversification",
        "Portfolio spans multiple asset categories"
      ],
      "disclaimer": "Informational only, not investment advice."
    }
  ]
}
```

## Integration

The insights system integrates with:

- **Portfolio Snapshots**: Uses latest snapshot for analysis
- **User Settings**: Respects base_currency
- **API Endpoint**: Provides insights for UI consumption

## Next Steps

1. **UI Integration**: Display insight cards in dashboard
2. **Historical Tracking**: Track insights over time
3. **Refinement**: Adjust thresholds based on feedback
4. **Additional Metrics**: Add more insight types if needed

## Documentation

See `docs/PORTFOLIO_INSIGHTS.md` for:
- Complete API reference
- Usage examples
- Schema details
- Troubleshooting guide

The Portfolio Insights Cards system is ready for production use! 🚀
