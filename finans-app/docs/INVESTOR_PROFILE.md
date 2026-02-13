# Investor Profile Inference

## Overview

The Investor Profile Inference system uses a hybrid approach (rules + LLM) to infer user investment profiles from portfolio snapshots and optional questionnaire answers.

## Features

✅ **Rule-Based Scoring**: Calculates risk and horizon scores from portfolio metrics  
✅ **LLM Refinement**: Uses structured OpenAI outputs for nuanced profile inference  
✅ **Questionnaire Support**: Optional questionnaire answers refine the profile  
✅ **Strict Schema**: Validated JSON output with exact structure  

## Schema

The profile JSON follows this strict schema:

```typescript
{
  user_id: string (UUID),
  risk_level: "low" | "medium" | "high",
  horizon: "short" | "medium" | "long",
  style_tags: string[] (3-6 items),
  explanation: string[] (exactly 3 bullets),
  disclaimer: "Informational only, not investment advice."
}
```

## Rule-Based Scoring

### Risk Score (0-100)

- **Crypto allocation > 25%**: +25 points
- **Crypto allocation > 10%**: +10 points
- **Single holding concentration > 35%**: +20 points
- **Cash > 40%**: -30 points (conservative)
- **Cash > 20%**: -15 points

### Horizon Score (0-100)

- **Cash > 40%**: +20 points (longer horizon)
- **Crypto > 25% or high concentration**: -20 points (shorter horizon)

### Style Hints

Automatically detected:
- `crypto-focused`: Crypto allocation > 25%
- `concentrated`: Single holding > 35%
- `conservative`: Cash > 40%
- `liquidity-preference`: Cash > 40%
- `diversified`: > 10 positions
- `focused`: ≤ 3 positions

## Usage

### Infer Profile

```typescript
import { inferInvestorProfileV2 } from '@/lib/ai/investor-profile-v2.service';

const result = await inferInvestorProfileV2(userId, {
  risk_tolerance: 'medium',
  time_horizon: 'long',
  experience_level: 'intermediate',
});

if (result.success) {
  console.log('Profile:', result.profile);
}
```

### API Endpoints

#### GET /api/ai/profile/:userId

Returns existing investor profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "risk_level": "medium",
    "horizon": "long",
    "style_tags": ["diversified", "growth-focused", "tech-heavy"],
    "explanation": [
      "Portfolio shows balanced allocation across stocks and crypto",
      "Moderate risk tolerance with focus on growth assets",
      "Long-term investment horizon indicated by holding patterns"
    ],
    "disclaimer": "Informational only, not investment advice.",
    "computed_at": "2024-01-15T10:30:00Z",
    "version": "1"
  }
}
```

#### POST /api/ai/profile/:userId/recompute

Recomputes investor profile (optionally with questionnaire).

**Request Body (optional):**
```json
{
  "questionnaire": {
    "risk_tolerance": "medium",
    "investment_goal": "Long-term wealth building",
    "time_horizon": "long",
    "experience_level": "intermediate"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "profile_id": "uuid",
    "risk_level": "medium",
    "horizon": "long",
    "style_tags": [...],
    "explanation": [...],
    "disclaimer": "...",
    "computed_at": "2024-01-15T10:30:00Z"
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

## Questionnaire Structure

Optional questionnaire answers:

```typescript
{
  risk_tolerance?: "low" | "medium" | "high",
  investment_goal?: string,
  time_horizon?: "short" | "medium" | "long",
  experience_level?: "beginner" | "intermediate" | "advanced",
  [key: string]: unknown
}
```

## Processing Flow

```
1. Fetch user and latest portfolio snapshot
   ↓
2. Calculate rule-based scores (risk, horizon, style hints)
   ↓
3. Apply questionnaire overrides (if provided)
   ↓
4. LLM refinement with structured outputs
   ↓
5. Store in investor_profile table
```

## Seed Data

The seed script (`prisma/seed-ai.ts`) includes:

- Mock portfolio snapshot with:
  - AAPL, MSFT (stocks)
  - BTC (crypto)
  - THYAO (BIST stock)
  - Cash balance

- Mock questionnaire:
  - risk_tolerance: "medium"
  - investment_goal: "Long-term wealth building"
  - time_horizon: "long"
  - experience_level: "intermediate"

## Integration

The profile inference integrates with:

- **Portfolio Snapshots**: Uses latest snapshot for analysis
- **User Settings**: Respects base_currency and locale
- **Questionnaire**: Optional refinement via API

## Example Output

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "risk_level": "medium",
  "horizon": "long",
  "style_tags": [
    "diversified",
    "growth-focused",
    "tech-heavy",
    "crypto-inclusive"
  ],
  "explanation": [
    "Portfolio allocation shows balanced approach with 35% crypto exposure indicating moderate risk tolerance",
    "Long-term holding patterns and diversified positions suggest patient investment strategy",
    "Tech-heavy allocation combined with crypto suggests growth-oriented approach with some volatility acceptance"
  ],
  "disclaimer": "Informational only, not investment advice."
}
```

## Troubleshooting

### No Portfolio Snapshot

1. Ensure portfolio snapshot exists for user
2. Check `portfolio_snapshots` table
3. Run seed script: `npm run db:seed`

### Profile Not Found

1. Compute profile first: `POST /api/ai/profile/:userId/recompute`
2. Check user exists
3. Verify portfolio snapshot structure

### Invalid Schema

1. Check OpenAI model supports structured outputs
2. Review schema definition
3. Check retry logs for fix attempts

## See Also

- `docs/OPENAI_STRUCTURED.md` - Structured OpenAI client
- `src/lib/ai/investor-profile-v2.service.ts` - Implementation
- `src/app/api/ai/profile/[userId]/route.ts` - API endpoints
