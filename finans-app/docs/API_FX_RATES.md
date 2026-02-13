# FX Rates API Documentation

## Overview

The FX Rates system enables converting portfolio values to a user's base currency (e.g., TRY). This is essential when the portfolio contains assets priced in different currencies.

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Admin Trigger  │ ──▶ │  FX Provider     │ ──▶ │  fx_rates    │
│  POST /api/...  │     │ exchangerate.host│     │    table     │
└─────────────────┘     └──────────────────┘     └──────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Portfolio API  │ ──▶ │  getFxRatesMap() │ ◀── │  Convert $   │
│  ?baseCurrency  │     │                  │     │  to TRY      │
└─────────────────┘     └──────────────────┘     └──────────────┘
```

---

## FX Rates Table

```sql
CREATE TABLE fx_rates (
  id TEXT PRIMARY KEY,
  base_currency TEXT NOT NULL,    -- e.g., 'USD'
  quote_currency TEXT NOT NULL,   -- e.g., 'TRY'
  rate DECIMAL NOT NULL,          -- e.g., 34.50
  timestamp TIMESTAMP NOT NULL,
  UNIQUE (base_currency, quote_currency, timestamp)
);
```

**Rate Interpretation:**
- `base=USD, quote=TRY, rate=34.50` means: 1 USD = 34.50 TRY

---

## API Endpoints

### Ingest FX Rates

```http
POST /api/admin/ingest/fx
```

Fetches current FX rates from exchangerate.host and stores in database.

**Default pairs fetched:**
- USD/TRY
- EUR/TRY
- EUR/USD

```bash
curl -X POST http://localhost:3000/api/admin/ingest/fx -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "source": "exchangerate.host",
    "rates": [
      { "pair": "USD/TRY", "rate": 34.52 },
      { "pair": "EUR/TRY", "rate": 37.15 },
      { "pair": "EUR/USD", "rate": 1.076 }
    ],
    "stats": {
      "inserted": 3,
      "updated": 0,
      "errors": 0
    },
    "durationMs": 850,
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Portfolio with Base Currency

Add `?baseCurrency=TRY` to portfolio endpoints to convert all values.

#### Positions

```bash
# Default (values in original currencies)
curl http://localhost:3000/api/portfolio/positions -b cookies.txt

# Convert to TRY
curl "http://localhost:3000/api/portfolio/positions?baseCurrency=TRY" -b cookies.txt
```

**Response with baseCurrency:**
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "asset": {
          "symbol": "AAPL",
          "currency": "USD"
        },
        "quantity": 10,
        "avgCost": 5175.00,          // Was 150 USD, now 5175 TRY
        "costBasis": 51750.00,
        "currentPrice": 6397.25,     // Was 185.50 USD
        "currentValue": 63972.50,
        "unrealizedGain": 12222.50,
        "unrealizedGainPercent": 23.62   // Stays same (it's a ratio)
      },
      {
        "asset": {
          "symbol": "THYAO",
          "currency": "TRY"
        },
        "quantity": 100,
        "avgCost": 250.00,           // Already in TRY (rate=1)
        "costBasis": 25000.00,
        "currentPrice": 294.00,
        "currentValue": 29400.00,
        "unrealizedGain": 4400.00
      }
    ],
    "meta": {
      "baseCurrency": "TRY",
      "fxMissing": []                // Currencies we couldn't convert
    }
  }
}
```

#### Summary

```bash
curl "http://localhost:3000/api/portfolio/summary?baseCurrency=TRY" -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCostBasis": 76750.00,     // All in TRY
    "totalValue": 93372.50,
    "unrealizedGain": 16622.50,
    "baseCurrency": "TRY",
    "fxMissing": [],
    "allocationByType": [
      {
        "type": "stock",
        "costBasis": 76750.00,
        "value": 93372.50,
        "percentage": 100
      }
    ]
  }
}
```

---

## Handling Missing FX Rates

If an FX rate is missing for a currency:

1. **Position values**: Value fields become `null`
2. **Summary totals**: Total value becomes `null` (incomplete)
3. **fxMissing array**: Lists which currencies need rates

**Example response with missing rate:**
```json
{
  "success": true,
  "data": {
    "totalValue": null,              // Can't calculate complete total
    "fxMissing": ["EUR"],            // EUR/TRY rate is missing
    "positions": [
      {
        "asset": { "symbol": "AAPL", "currency": "USD" },
        "currentValue": 63972.50     // USD converted OK
      },
      {
        "asset": { "symbol": "EUROSTOXX", "currency": "EUR" },
        "currentValue": null         // Can't convert EUR
      }
    ]
  }
}
```

**Solution:** Ingest the missing rate:
```bash
curl -X POST http://localhost:3000/api/admin/ingest/fx -b cookies.txt
```

---

## Currency Support

| Currency | Description | Primary Use |
|----------|-------------|-------------|
| `USD` | US Dollar | Crypto, US stocks |
| `TRY` | Turkish Lira | BIST stocks |
| `EUR` | Euro | European stocks |

---

## Rate Calculation Logic

### Direct Rate
If `USD/TRY` exists: Use directly

### Inverse Rate
If only `TRY/USD` exists: Use `1 / rate`

### Same Currency
If `baseCurrency == assetCurrency`: Rate = 1 (no conversion)

---

## Automatic Fallback

The FX provider has built-in fallback:

1. **Primary**: exchangerate.host (free, no API key)
2. **Fallback**: frankfurter.app (free, no API key)

If the primary fails, the fallback is automatically tried.

---

## Test Script

```bash
# Test FX ingestion
curl -X POST http://localhost:3000/api/admin/ingest/fx \
  -H "Content-Type: application/json" \
  -b cookies.txt

# Verify portfolio in TRY
curl "http://localhost:3000/api/portfolio/summary?baseCurrency=TRY" -b cookies.txt

# Verify positions in USD (no conversion)
curl "http://localhost:3000/api/portfolio/positions" -b cookies.txt

# Verify positions in TRY
curl "http://localhost:3000/api/portfolio/positions?baseCurrency=TRY" -b cookies.txt
```

---

## Frontend Usage

```typescript
// Get portfolio in user's preferred currency
async function getPortfolioInTRY() {
  const response = await fetch('/api/portfolio/summary?baseCurrency=TRY', {
    credentials: 'include',
  });
  const { data } = await response.json();
  
  // Check if all conversions succeeded
  if (data.fxMissing?.length > 0) {
    console.warn('Missing FX rates for:', data.fxMissing);
  }
  
  // Display total in TRY
  if (data.totalValue !== null) {
    display(`₺${data.totalValue.toLocaleString('tr-TR')}`);
  }
}
```

---

## Scheduled Updates

For production, set up automatic FX rate updates:

**Option 1: Vercel Cron**
```json
{
  "crons": [{
    "path": "/api/admin/ingest/fx",
    "schedule": "0 */4 * * *"
  }]
}
```

**Option 2: External Scheduler**
```bash
# Run every 4 hours via cron
0 */4 * * * curl -X POST https://yourapp.com/api/admin/ingest/fx -H "Authorization: Bearer $TOKEN"
```

---

## Notes

1. **De-duplication**: Rates are stored per hour (timestamp rounded)
2. **Update threshold**: Existing rates only updated if change > 0.0001
3. **No API key needed**: Both providers work without authentication
4. **Decimal precision**: Rates stored with Prisma Decimal for accuracy





