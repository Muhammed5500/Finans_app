# Price Ingestion API Documentation

## Overview

The price ingestion service fetches real-time price data from external providers and stores it in the database. It's designed to be provider-agnostic, allowing easy addition of new data sources.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Admin API      │ ──▶ │ Ingestion Service │ ──▶ │  Database    │
│  (Trigger)      │     │                  │     │  (prices)    │
└─────────────────┘     └──────────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Provider    │
                        │  Interface   │
                        └──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ CoinGecko│    │ US Stocks│    │   BIST   │
        │ (crypto) │    │ (future) │    │ (future) │
        └──────────┘    └──────────┘    └──────────┘
```

---

## API Endpoints

### Trigger Crypto Price Ingestion

```http
POST /api/admin/ingest/crypto-prices
Content-Type: application/json
```

**Authentication Required:** Yes (cookie or session)

#### Request Options

| Field | Type | Description |
|-------|------|-------------|
| `symbols` | string[] | Specific symbols to fetch (e.g., `["BTC", "ETH"]`) |
| `fromWatchlists` | boolean | Use symbols from user's watchlists |

If neither provided, fetches all crypto assets in database.

#### Examples

```bash
# Fetch specific symbols
curl -X POST http://localhost:3000/api/admin/ingest/crypto-prices \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"symbols": ["BTC", "ETH", "SOL", "DOGE"]}'

# Fetch from user's watchlists
curl -X POST http://localhost:3000/api/admin/ingest/crypto-prices \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"fromWatchlists": true}'

# Fetch all crypto assets in database
curl -X POST http://localhost:3000/api/admin/ingest/crypto-prices \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

#### Response

```json
{
  "success": true,
  "data": {
    "success": true,
    "provider": "CoinGecko",
    "stats": {
      "requested": 4,
      "inserted": 3,
      "skipped": 1,
      "errors": 0
    },
    "symbols": ["BTC", "ETH", "SOL", "DOGE"],
    "durationMs": 1250,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Stats Explanation:**
- `requested`: Number of symbols requested
- `inserted`: New prices stored in database
- `skipped`: Prices already exist (de-duplicated)
- `errors`: Failed to fetch or store

---

## Provider Interface

To add a new price provider, implement the `PriceProvider` interface:

```typescript
interface PriceProvider {
  // Provider identification
  readonly name: string;
  readonly source: PriceSource;  // Enum value for database
  readonly supportedTypes: string[];  // e.g., ['crypto'], ['stock']
  
  // Methods
  fetchPrices(symbols: string[]): Promise<FetchResult>;
  isAvailable(): boolean;
  mapSymbol(symbol: string): string;  // Internal → Provider format
}
```

### Example Implementation

```typescript
// src/lib/providers/my-provider.ts

import { PriceSource } from '@prisma/client';
import type { PriceProvider, FetchResult } from './types';

class MyProvider implements PriceProvider {
  readonly name = 'MyProvider';
  readonly source = PriceSource.manual;
  readonly supportedTypes = ['stock'];

  isAvailable(): boolean {
    return !!process.env.MY_PROVIDER_API_KEY;
  }

  mapSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  async fetchPrices(symbols: string[]): Promise<FetchResult> {
    // Implementation...
  }
}

export const myProvider = new MyProvider();
```

---

## Supported Symbols (Crypto)

The crypto provider maps common symbols to CoinGecko IDs:

| Symbol | CoinGecko ID |
|--------|--------------|
| BTC | bitcoin |
| ETH | ethereum |
| SOL | solana |
| BNB | binancecoin |
| XRP | ripple |
| ADA | cardano |
| DOGE | dogecoin |
| DOT | polkadot |
| MATIC | matic-network |
| LINK | chainlink |
| AVAX | avalanche-2 |
| UNI | uniswap |
| ATOM | cosmos |
| LTC | litecoin |
| XLM | stellar |
| NEAR | near |
| APT | aptos |
| ARB | arbitrum |
| OP | optimism |
| INJ | injective-protocol |

To add more symbols, update the `SYMBOL_MAP` in `src/lib/providers/crypto.ts`.

---

## De-duplication Logic

Prices are de-duplicated by `asset_id + timestamp`:

1. Timestamps are rounded to the minute
2. If a price exists for the same asset and minute:
   - If price changed >0.1%, update the record
   - Otherwise, skip (return as "skipped")

This prevents duplicate entries while allowing price corrections.

---

## Adding New Providers

### Step 1: Create Provider File

```bash
# Copy template
cp src/lib/providers/us-stocks.ts.template src/lib/providers/us-stocks.ts
```

### Step 2: Implement Provider Interface

Edit `src/lib/providers/us-stocks.ts`:
- Configure API endpoint and authentication
- Implement `fetchPrices()` method
- Map symbols to provider format

### Step 3: Update Exports

```typescript
// src/lib/providers/index.ts
export { usStocksProvider } from './us-stocks';
```

### Step 4: Add PriceSource Enum (if needed)

```prisma
// prisma/schema.prisma
enum PriceSource {
  manual
  coingecko
  alphavantage  // Add new source
  polygon
  // etc.
}
```

Run migration: `npm run db:migrate`

### Step 5: Create Ingestion Endpoint

```typescript
// src/app/api/admin/ingest/us-prices/route.ts
import { usStocksProvider, ingestPrices } from '@/lib/providers';

export const POST = withAuth(async (request, { user }) => {
  const result = await ingestPrices(usStocksProvider, options);
  return successResponse(result);
});
```

---

## Error Handling

### Provider Errors

Each provider returns detailed errors:

```typescript
interface ProviderError {
  symbol: string;   // Which symbol failed
  code: string;     // Error code
  message: string;  // Human-readable message
}
```

Common error codes:
- `NOT_FOUND`: Symbol not found in provider
- `FETCH_ERROR`: Network/API error
- `RATE_LIMIT`: Provider rate limit exceeded
- `NO_API_KEY`: API key not configured

### Timeout Handling

All providers have configurable timeouts (default: 10 seconds).

```typescript
const CONFIG = {
  timeout: 10000,  // 10 seconds
};
```

---

## Scheduled Ingestion (Future)

For automated price updates, you can:

1. **Use Vercel Cron** (if deployed on Vercel):
   ```json
   // vercel.json
   {
     "crons": [{
       "path": "/api/admin/ingest/crypto-prices",
       "schedule": "*/15 * * * *"
     }]
   }
   ```

2. **External Cron Service**:
   - Use cron-job.org or similar
   - Call the endpoint with authentication

3. **Background Worker**:
   - Separate Node.js process
   - Use node-cron for scheduling

---

## Testing Locally

```bash
# 1. Ensure you're logged in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "admin@finans.local", "password": "changeme123"}'

# 2. Test crypto ingestion with specific symbols
curl -X POST http://localhost:3000/api/admin/ingest/crypto-prices \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"symbols": ["BTC", "ETH"]}'

# 3. Verify prices in database
curl http://localhost:3000/api/markets/quotes?symbols=BTC,ETH -b cookies.txt

# 4. Check portfolio with new prices
curl http://localhost:3000/api/portfolio/summary -b cookies.txt
```

---

## Rate Limits

| Provider | Free Tier Limit |
|----------|-----------------|
| CoinGecko | 10-30 req/min |
| Alpha Vantage | 5 req/min, 500/day |
| Polygon.io | 5 req/min |
| Yahoo Finance | Unofficial, varies |

The crypto provider uses conservative limits (10 req/min) to avoid rate limiting.

---

## Troubleshooting

### "Symbol not found"
- Check if the asset exists in your database
- Verify the symbol is mapped correctly in the provider
- Add to `SYMBOL_MAP` if needed

### "Rate limit exceeded"
- Wait 1-2 minutes before retrying
- Reduce the number of symbols per request
- Consider batching requests over time

### "Provider unavailable"
- Check internet connectivity
- Verify API is operational (check provider status page)
- Check API key if required

### "No prices inserted"
- All prices may already exist (check `skipped` count)
- Verify assets exist in database for the symbols
- Check for errors in the response





