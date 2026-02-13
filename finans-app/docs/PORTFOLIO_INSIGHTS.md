# Portfolio Insights Cards

## Overview

The Portfolio Insights system generates deterministic insight cards from portfolio snapshots, providing observations about concentration risk, currency exposure, volatility, and diversification.

## Features

✅ **Deterministic Calculations**: Rule-based, no LLM required  
✅ **Multiple Insight Types**: Concentration, currency, volatility, diversification  
✅ **Severity Levels**: info, warning, critical  
✅ **Strict Schema**: Validated JSON output  

## Insight Types

### 1. Concentration Risk

- **Metric**: Top holding percentage with label (low/med/high)
- **Calculation**: Largest holding value / total portfolio value
- **Severity**:
  - `critical`: > 35% (high)
  - `warning`: 20-35% (med)
  - `info`: < 20% (low)

### 2. Currency Exposure

- **Metric**: TL vs USD vs other percentages
- **Calculation**: Groups holdings by currency (infers from type/market)
- **Severity**:
  - `warning`: Single currency > 90%
  - `info`: Otherwise

### 3. Volatility Exposure

- **Metric**: Crypto percentage
- **Calculation**: Crypto holdings value / total portfolio value
- **Severity**:
  - `critical`: > 30% crypto
  - `warning`: 15-30% crypto
  - `info`: < 15% crypto

### 4. Diversification Score

- **Metric**: Simple heuristic score (High/Medium/Low/Very Low)
- **Calculation**:
  - Number of holdings (max 10 points)
  - Category balance (max 5 points)
- **Severity**:
  - `critical`: Score < 4 (Very Low)
  - `warning`: Score 4-6 (Low)
  - `info`: Score 7+ (Medium/High)

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

Returns portfolio insights for a user. Generates insights if they don't exist.

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
        "details": [
          "Top holding (AAPL) represents 28.5% of portfolio value",
          "Top 3 holdings represent 65.2% of portfolio",
          "Moderate concentration may benefit from additional diversification"
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
          "Turkish Lira (TRY): 12.5%",
          "Other currencies: 15.2%"
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
          "Moderate crypto exposure increases portfolio volatility",
          "Consider the impact of crypto price movements on overall portfolio"
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
    ],
    "version": "1"
  }
}
```

## Portfolio Snapshot Structure

The service expects portfolio snapshots with this structure:

```typescript
{
  holdings: [
    {
      symbol: string,
      name: string,
      type: "stock" | "crypto" | "cash",
      quantity: number,
      value: number,
      currency: string
    }
  ],
  totalValue: number,
  cashBalance: number,
  baseCurrency: string
}
```

## Currency Inference

If currency is not specified in holdings, the system infers:

- **Crypto**: USD (crypto typically USD-denominated)
- **BIST stocks**: TRY (4 uppercase letters = BIST ticker)
- **Other stocks**: USD (default for US stocks)

## Rules

### No Advice

- All insights are **observations only**
- No "do X" or "should Y" language
- Only factual statements about portfolio composition
- Standard disclaimer on every card

### Severity Guidelines

- **info**: Normal or acceptable levels
- **warning**: Moderate concern, worth noting
- **critical**: Significant risk or issue

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
        "Moderate concentration may benefit from additional diversification"
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

## Troubleshooting

### No Portfolio Snapshot

1. Ensure portfolio snapshot exists for user
2. Check `portfolio_snapshots` table
3. Run seed script: `npm run db:seed`

### Insights Not Generated

1. Check portfolio snapshot has holdings
2. Verify holdings structure matches expected format
3. Check logs for calculation errors

### Currency Inference Issues

1. Verify holdings have `currency` field when possible
2. Check symbol patterns for BIST detection
3. Review currency grouping logic

## See Also

- `src/lib/ai/portfolio-insights-v2.service.ts` - Implementation
- `src/app/api/ai/portfolio-insights/[userId]/route.ts` - API endpoint
- `docs/INVESTOR_PROFILE.md` - Related investor profile docs
