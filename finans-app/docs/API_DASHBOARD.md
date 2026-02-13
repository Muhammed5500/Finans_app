# Dashboard API Documentation

## Overview

The Dashboard API provides a single aggregated endpoint that returns all data needed for the main dashboard view. This reduces the number of API calls from the frontend and improves perceived performance.

## Endpoint

```http
GET /api/dashboard
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `baseCurrency` | string | Convert all values to this currency (e.g., `TRY`) |

```bash
# Default (USD values)
curl http://localhost:3000/api/dashboard -b cookies.txt

# With TRY conversion
curl "http://localhost:3000/api/dashboard?baseCurrency=TRY" -b cookies.txt
```

---

## Example Response

```json
{
  "success": true,
  "data": {
    "portfolio": {
      "totalValue": 125750.50,
      "totalCostBasis": 98500.00,
      "unrealizedGain": 27250.50,
      "unrealizedGainPercent": 27.66,
      "positionCount": 8,
      "currency": "USD"
    },

    "topHoldings": [
      {
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "value": 45000.00,
        "weight": 35.78
      },
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "stock",
        "value": 18550.00,
        "weight": 14.75
      },
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "type": "crypto",
        "value": 15480.00,
        "weight": 12.31
      },
      {
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "type": "stock",
        "value": 11235.00,
        "weight": 8.93
      },
      {
        "symbol": "THYAO",
        "name": "Türk Hava Yolları",
        "type": "stock",
        "value": 8820.00,
        "weight": 7.01
      }
    ],

    "allocation": [
      { "type": "crypto", "value": 65480.00, "percentage": 52.07 },
      { "type": "stock", "value": 60270.50, "percentage": 47.93 }
    ],

    "watchlist": {
      "id": "clwatch123...",
      "name": "US Tech",
      "items": [
        {
          "symbol": "AAPL",
          "name": "Apple Inc.",
          "type": "stock",
          "currency": "USD",
          "price": { "value": 185.50, "timestamp": "2024-01-15T16:00:00Z" },
          "change": { "value": 2.35, "percent": 1.28 }
        },
        {
          "symbol": "NVDA",
          "name": "NVIDIA Corporation",
          "type": "stock",
          "currency": "USD",
          "price": { "value": 545.00, "timestamp": "2024-01-15T16:00:00Z" },
          "change": { "value": -8.50, "percent": -1.54 }
        },
        {
          "symbol": "BTC",
          "name": "Bitcoin",
          "type": "crypto",
          "currency": "USD",
          "price": { "value": 45000.00, "timestamp": "2024-01-15T16:05:00Z" },
          "change": { "value": 1250.00, "percent": 2.86 }
        }
      ]
    },

    "news": {
      "items": [
        {
          "id": "clnews1...",
          "title": "Bitcoin ETF Approval Drives Market Rally",
          "url": "https://example.com/news/btc-etf",
          "source": "CoinDesk",
          "publishedAt": "2024-01-15T14:30:00Z",
          "isRead": false
        },
        {
          "id": "clnews2...",
          "title": "Fed Signals Rate Cut Expectations",
          "url": "https://example.com/news/fed-rates",
          "source": "Reuters",
          "publishedAt": "2024-01-15T13:15:00Z",
          "isRead": false
        },
        {
          "id": "clnews3...",
          "title": "Apple Reports Strong Q4 Earnings",
          "url": "https://example.com/news/aapl-earnings",
          "source": "Bloomberg",
          "publishedAt": "2024-01-15T10:00:00Z",
          "isRead": true
        }
      ],
      "unreadCount": 7
    },

    "meta": {
      "calculatedAt": "2024-01-15T16:10:00.000Z",
      "durationMs": 145,
      "pricesMissing": ["NEWSTOCK"]
    }
  }
}
```

---

## Response Structure

### `portfolio`
Main portfolio metrics.

| Field | Type | Description |
|-------|------|-------------|
| `totalValue` | number\|null | Current portfolio value |
| `totalCostBasis` | number | Total cost of all positions |
| `unrealizedGain` | number\|null | Unrealized profit/loss |
| `unrealizedGainPercent` | number\|null | P&L as percentage |
| `positionCount` | number | Number of active positions |
| `currency` | string | Currency of values |

### `topHoldings`
Top 5 positions by value.

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Asset symbol |
| `name` | string | Asset name |
| `type` | string | Asset type (stock/crypto) |
| `value` | number\|null | Current value |
| `weight` | number\|null | % of portfolio |

### `allocation`
Portfolio breakdown by asset type.

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Asset type |
| `value` | number\|null | Total value for type |
| `percentage` | number\|null | % of portfolio |

### `watchlist`
Default watchlist with current prices.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Watchlist ID |
| `name` | string | Watchlist name |
| `items[].symbol` | string | Asset symbol |
| `items[].price` | object\|null | Current price & timestamp |
| `items[].change` | object\|null | Daily change (value & %) |

### `news`
Latest news headlines.

| Field | Type | Description |
|-------|------|-------------|
| `items` | array | News items (max 10) |
| `unreadCount` | number | Total unread in feed |

### `meta`
Request metadata.

| Field | Type | Description |
|-------|------|-------------|
| `calculatedAt` | string | Timestamp of calculation |
| `durationMs` | number | Query duration in ms |
| `pricesMissing` | string[] | Symbols without prices |

---

## Optimizations

### Current Optimizations

1. **Parallel Queries**: Independent data (trades, watchlist, news, FX rates) fetched in parallel using `Promise.all()`

2. **Single Price Lookup**: All asset prices (portfolio + watchlist) fetched in one query

3. **Minimal SELECT**: Only required fields selected from database

4. **Limited Results**: 
   - Top 5 holdings
   - 10 watchlist items
   - 10 news items

### Adding Caching (Future)

If performance becomes an issue, add Redis caching:

```typescript
// Example caching implementation
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN });
const CACHE_TTL = 60; // 1 minute

export const GET = withAuth(async (request, { user }) => {
  const cacheKey = `dashboard:${user.id}:${baseCurrency || 'USD'}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return successResponse({ ...cached, meta: { ...cached.meta, cached: true } });
  }
  
  // Calculate fresh data
  const data = await calculateDashboard(user.id, baseCurrency);
  
  // Cache for 1 minute
  await redis.set(cacheKey, data, { ex: CACHE_TTL });
  
  return successResponse(data);
});
```

**Cache Invalidation Points:**
- After trade creation/update/delete
- After price ingestion
- After news ingestion
- After watchlist changes

---

## Frontend Mapping

### React Component Structure

```tsx
// pages/dashboard.tsx
import { useDashboard } from '@/hooks/useDashboard';
import { 
  PortfolioValue, 
  StatCard, 
  DonutChart, 
  HoldingsList,
  MarketWatch,
  NewsFeed 
} from '@/components/dashboard';

export default function DashboardPage() {
  const { data, loading, error } = useDashboard('TRY');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <PageContainer title="Dashboard">
      {/* Main Portfolio Value */}
      <PortfolioValue
        value={data.portfolio.totalValue}
        change={data.portfolio.unrealizedGain}
        changePercent={data.portfolio.unrealizedGainPercent}
        currency={data.portfolio.currency}
      />

      {/* Summary Cards */}
      <div className={styles.statsRow}>
        <StatCard 
          label="Cost Basis" 
          value={data.portfolio.totalCostBasis}
          format="currency"
        />
        <StatCard 
          label="Positions" 
          value={data.portfolio.positionCount}
          format="number"
        />
        <StatCard 
          label="Unread News" 
          value={data.news.unreadCount}
          format="number"
        />
      </div>

      {/* Charts & Lists */}
      <div className={styles.mainGrid}>
        <DonutChart 
          data={data.allocation}
          labelKey="type"
          valueKey="percentage"
        />
        
        <HoldingsList 
          holdings={data.topHoldings}
          currency={data.portfolio.currency}
        />

        <MarketWatch 
          watchlist={data.watchlist}
        />

        <NewsFeed 
          items={data.news.items}
        />
      </div>
    </PageContainer>
  );
}
```

### Data Hook

```typescript
// hooks/useDashboard.ts
import { useState, useEffect } from 'react';

interface DashboardData {
  portfolio: { totalValue: number | null; /* ... */ };
  topHoldings: Array<{ symbol: string; value: number | null; /* ... */ }>;
  allocation: Array<{ type: string; percentage: number | null }>;
  watchlist: { name: string; items: Array<{ /* ... */ }> } | null;
  news: { items: Array<{ /* ... */ }>; unreadCount: number };
}

export function useDashboard(baseCurrency?: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const params = baseCurrency ? `?baseCurrency=${baseCurrency}` : '';
        const res = await fetch(`/api/dashboard${params}`, {
          credentials: 'include',
        });
        const json = await res.json();
        
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error);
        }
      } catch (e) {
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [baseCurrency]);

  return { data, loading, error };
}
```

### Component Data Mapping

| Component | Dashboard Field | Notes |
|-----------|----------------|-------|
| `PortfolioValue` | `portfolio.totalValue`, `portfolio.unrealizedGain` | Main metric display |
| `StatCard` (Cost) | `portfolio.totalCostBasis` | Format as currency |
| `StatCard` (Positions) | `portfolio.positionCount` | Format as number |
| `DonutChart` | `allocation` | Map type → label, percentage → value |
| `HoldingsList` | `topHoldings` | Already sorted by value |
| `MarketWatch` | `watchlist.items` | Use price.value, change.percent |
| `NewsFeed` | `news.items` | Use isRead for styling |

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Response time | < 200ms | Without cache |
| With cache | < 50ms | After implementing Redis |
| Queries | 4-5 | Trades, watchlist, news, prices (×2) |

---

## Test

```bash
curl http://localhost:3000/api/dashboard -b cookies.txt | jq

# With TRY conversion
curl "http://localhost:3000/api/dashboard?baseCurrency=TRY" -b cookies.txt | jq
```





