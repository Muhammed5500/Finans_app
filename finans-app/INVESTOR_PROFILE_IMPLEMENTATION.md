# Investor Profile Inference - Implementation Summary

## ✅ Implementation Complete

The Investor Profile Inference system has been fully implemented with hybrid rule-based + LLM approach, structured outputs, and API endpoints.

## Files Created

### Core Service

1. **`src/lib/ai/investor-profile-v2.service.ts`**
   - Rule-based scoring from portfolio metrics
   - LLM refinement with structured OpenAI outputs
   - Questionnaire support
   - Strict schema validation

### API Endpoints

2. **`src/app/api/ai/profile/[userId]/route.ts`**
   - GET endpoint for fetching investor profile

3. **`src/app/api/ai/profile/[userId]/recompute/route.ts`**
   - POST endpoint for recomputing profile
   - Optional questionnaire in request body

### Documentation

4. **`docs/INVESTOR_PROFILE.md`**
   - Complete usage guide
   - Schema documentation
   - API reference

### Seed Data

5. **`prisma/seed-ai.ts`** (Updated)
   - Mock portfolio snapshot with proper structure
   - Mock questionnaire data
   - Portfolio includes: AAPL, MSFT, BTC, THYAO, cash

## Features

### ✅ Rule-Based Scoring

- **Risk Score (0-100)**:
  - Crypto > 25%: +25 points
  - Crypto > 10%: +10 points
  - Concentration > 35%: +20 points
  - Cash > 40%: -30 points (conservative)
  - Cash > 20%: -15 points

- **Horizon Score (0-100)**:
  - Cash > 40%: +20 points (longer)
  - Crypto > 25% or concentration: -20 points (shorter)

- **Style Hints**:
  - crypto-focused, concentrated, conservative, liquidity-preference
  - diversified, focused

### ✅ LLM Refinement

- Uses structured OpenAI outputs
- Maps scores to risk_level, horizon
- Generates 3-6 style_tags
- Provides exactly 3 explanation bullets
- Enforces standard disclaimer

### ✅ Questionnaire Support

Optional questionnaire can override scores:
- `risk_tolerance`: low, medium, high
- `time_horizon`: short, medium, long
- `experience_level`: beginner, intermediate, advanced
- `investment_goal`: free text

## Schema

```typescript
{
  user_id: string (UUID),
  risk_level: "low" | "medium" | "high",
  horizon: "short" | "medium" | "long",
  style_tags: string[] (3-6),
  explanation: string[] (exactly 3),
  disclaimer: "Informational only, not investment advice."
}
```

## Usage

### Infer Profile Programmatically

```typescript
import { inferInvestorProfileV2 } from '@/lib/ai/investor-profile-v2.service';

const result = await inferInvestorProfileV2(userId, {
  risk_tolerance: 'medium',
  time_horizon: 'long',
});
```

### API Endpoints

#### GET /api/ai/profile/:userId

```bash
curl http://localhost:3000/api/ai/profile/{userId} \
  -H "Authorization: Bearer <token>"
```

#### POST /api/ai/profile/:userId/recompute

```bash
curl -X POST http://localhost:3000/api/ai/profile/{userId}/recompute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "questionnaire": {
      "risk_tolerance": "medium",
      "time_horizon": "long"
    }
  }'
```

## Portfolio Snapshot Structure

Expected structure in `holdingsJson`:

```json
{
  "holdings": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "stock",
      "quantity": 150,
      "value": 27888,
      "currency": "USD"
    }
  ],
  "totalValue": 105228.75,
  "cashBalance": 15000,
  "baseCurrency": "TRY"
}
```

## Processing Flow

```
1. Fetch user and latest portfolio snapshot
   ↓
2. Calculate rule-based scores
   - Risk score (crypto, concentration, cash)
   - Horizon score (cash, crypto, concentration)
   - Style hints
   ↓
3. Apply questionnaire overrides (if provided)
   ↓
4. LLM refinement with structured outputs
   - Map scores to risk_level/horizon
   - Generate style_tags
   - Create explanation bullets
   ↓
5. Store in investor_profile table (version=1)
```

## Seed Data

The seed script creates:

- **Portfolio Snapshot**:
  - AAPL: $27,888 (stock)
  - MSFT: $28,418 (stock)
  - BTC: $36,422 (crypto) - ~35% allocation
  - THYAO: ₺12,500 (BIST stock)
  - Cash: $15,000 (~14% of total)

- **Mock Questionnaire**:
  ```json
  {
    "risk_tolerance": "medium",
    "investment_goal": "Long-term wealth building",
    "time_horizon": "long",
    "experience_level": "intermediate"
  }
  ```

## Example Output

```json
{
  "user_id": "uuid",
  "risk_level": "medium",
  "horizon": "long",
  "style_tags": [
    "diversified",
    "growth-focused",
    "tech-heavy",
    "crypto-inclusive"
  ],
  "explanation": [
    "Portfolio shows balanced allocation with 35% crypto indicating moderate risk tolerance",
    "Long-term holding patterns suggest patient investment strategy",
    "Tech-heavy allocation with crypto suggests growth-oriented approach"
  ],
  "disclaimer": "Informational only, not investment advice."
}
```

## Integration

The profile inference integrates with:

- **Portfolio Snapshots**: Uses latest snapshot
- **User Settings**: Respects base_currency and locale
- **Questionnaire**: Optional refinement via API
- **Structured OpenAI Client**: Uses new wrapper for validation

## Next Steps

1. **Add Questionnaire Table**: Store questionnaire answers in DB
2. **Historical Analysis**: Track profile changes over time
3. **UI Integration**: Display profile in user dashboard
4. **Refinement**: Improve rule-based scoring based on feedback

## Documentation

See `docs/INVESTOR_PROFILE.md` for:
- Complete API reference
- Usage examples
- Schema details
- Troubleshooting guide

The Investor Profile Inference system is ready for production use! 🚀
