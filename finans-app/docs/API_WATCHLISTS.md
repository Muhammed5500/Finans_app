# Watchlists & Markets API Documentation

## Overview

The Watchlists API allows users to create and manage lists of assets to track. The Markets API provides price data for watchlist items.

---

## Watchlists API

### List Watchlists

```http
GET /api/watchlists
```

```bash
curl http://localhost:3000/api/watchlists -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx...",
      "name": "US Tech",
      "description": "US technology stocks",
      "sortOrder": 0,
      "itemCount": 6,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "clyyy...",
      "name": "Crypto",
      "description": "Cryptocurrency watchlist",
      "sortOrder": 1,
      "itemCount": 4,
      ...
    }
  ]
}
```

### Create Watchlist

```http
POST /api/watchlists
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/api/watchlists \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My New Watchlist",
    "description": "Optional description"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Watchlist name (1-100 chars) |
| description | string | ❌ | Description (max 500 chars) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clzzz...",
    "name": "My New Watchlist",
    "description": "Optional description",
    "sortOrder": 3,
    "itemCount": 0,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### Get Watchlist

```http
GET /api/watchlists/:id
```

```bash
curl http://localhost:3000/api/watchlists/clxxx... -b cookies.txt
```

### Update Watchlist

```http
PATCH /api/watchlists/:id
Content-Type: application/json
```

```bash
curl -X PATCH http://localhost:3000/api/watchlists/clxxx... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Name",
    "sortOrder": 0
  }'
```

### Delete Watchlist

```http
DELETE /api/watchlists/:id
```

```bash
curl -X DELETE http://localhost:3000/api/watchlists/clxxx... -b cookies.txt
```

**Note:** Deleting a watchlist also removes all its items (cascade delete).

---

## Watchlist Items API

### List Items

```http
GET /api/watchlists/:id/items
```

```bash
curl http://localhost:3000/api/watchlists/clxxx.../items -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "watchlistId": "clxxx...",
    "watchlistName": "US Tech",
    "items": [
      {
        "id": "clitem1...",
        "sortOrder": 0,
        "notes": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "asset": {
          "id": "classet1...",
          "symbol": "AAPL",
          "name": "Apple Inc.",
          "type": "stock",
          "exchange": "NASDAQ",
          "currency": "USD"
        }
      },
      {
        "id": "clitem2...",
        "sortOrder": 1,
        "asset": {
          "symbol": "MSFT",
          "name": "Microsoft Corporation",
          ...
        }
      }
    ]
  }
}
```

### Add Item

```http
POST /api/watchlists/:id/items
Content-Type: application/json
```

```bash
# First, get an asset ID
curl "http://localhost:3000/api/assets?query=tesla" -b cookies.txt

# Then add to watchlist
curl -X POST http://localhost:3000/api/watchlists/clxxx.../items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "assetId": "classet...",
    "notes": "Watching for breakout"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assetId | string | ✅ | Asset ID (cuid) |
| notes | string | ❌ | Optional notes (max 500) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clnewitem...",
    "sortOrder": 6,
    "notes": "Watching for breakout",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "asset": {
      "id": "classet...",
      "symbol": "TSLA",
      "name": "Tesla Inc.",
      "type": "stock",
      "exchange": "NASDAQ",
      "currency": "USD"
    }
  }
}
```

**Errors:**
- `404`: Asset not found
- `409`: Asset already in watchlist

### Remove Item

```http
DELETE /api/watchlists/:id/items/:itemId
```

```bash
curl -X DELETE http://localhost:3000/api/watchlists/clxxx.../items/clitem... -b cookies.txt
```

---

## Markets API

### Get Watchlist Market Data

```http
GET /api/markets/watchlist/:id
```

Returns market data (prices, changes) for all assets in a watchlist.

```bash
curl http://localhost:3000/api/markets/watchlist/clxxx... -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "watchlist": {
      "id": "clxxx...",
      "name": "US Tech",
      "description": "US technology stocks"
    },
    "items": [
      {
        "itemId": "clitem1...",
        "asset": {
          "id": "classet1...",
          "symbol": "AAPL",
          "name": "Apple Inc.",
          "type": "stock",
          "exchange": "NASDAQ",
          "currency": "USD"
        },
        "price": {
          "value": 185.50,
          "timestamp": "2024-01-15T16:00:00.000Z"
        },
        "change": {
          "value": 2.35,
          "percent": 1.28
        }
      },
      {
        "itemId": "clitem2...",
        "asset": {
          "symbol": "MSFT",
          "name": "Microsoft Corporation",
          ...
        },
        "price": {
          "value": 378.90,
          "timestamp": "2024-01-15T16:00:00.000Z"
        },
        "change": {
          "value": -1.20,
          "percent": -0.32
        }
      },
      {
        "itemId": "clitem3...",
        "asset": {
          "symbol": "NEWSTOCK",
          ...
        },
        "price": null,
        "change": null
      }
    ],
    "updatedAt": "2024-01-15T16:05:00.000Z"
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `price.value` | number\|null | Latest price (null if no data) |
| `price.timestamp` | string\|null | When price was recorded |
| `change.value` | number\|null | Absolute change from previous close |
| `change.percent` | number\|null | Percentage change |

### Get Quotes by Symbols

```http
GET /api/markets/quotes?symbols=AAPL,MSFT,BTC
```

Quick lookup of prices by symbol. Useful for search results or ad-hoc queries.

```bash
# Single symbol
curl "http://localhost:3000/api/markets/quotes?symbols=AAPL" -b cookies.txt

# Multiple symbols
curl "http://localhost:3000/api/markets/quotes?symbols=AAPL,MSFT,BTC,ETH" -b cookies.txt

# Filter by exchange
curl "http://localhost:3000/api/markets/quotes?symbols=THYAO&exchange=BIST" -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "stock",
        "exchange": "NASDAQ",
        "currency": "USD",
        "price": 185.50,
        "timestamp": "2024-01-15T16:00:00.000Z",
        "change": {
          "value": 2.35,
          "percent": 1.28
        }
      },
      {
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "exchange": "CRYPTO",
        "currency": "USD",
        "price": 95000.00,
        "timestamp": "2024-01-15T16:00:00.000Z",
        "change": {
          "value": 1250.00,
          "percent": 1.33
        }
      }
    ],
    "notFound": ["INVALID"],
    "updatedAt": "2024-01-15T16:05:00.000Z"
  }
}
```

---

## Change Calculation

Daily change is calculated as:

```
change_value = current_price - previous_close
change_percent = (change_value / previous_close) × 100
```

**Previous close lookup:**
1. Find most recent price before midnight yesterday
2. For crypto (24/7 markets), uses ~24h ago

**When change is null:**
- No previous price data available
- Only one price point exists

---

## Frontend Usage Examples

### React: Watchlist Component

```typescript
// hooks/useWatchlist.ts
import { useState, useEffect } from 'react';

interface MarketItem {
  itemId: string;
  asset: {
    symbol: string;
    name: string;
    type: string;
    currency: string;
  };
  price: { value: number; timestamp: string } | null;
  change: { value: number; percent: number } | null;
}

export function useWatchlistMarketData(watchlistId: string) {
  const [data, setData] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/markets/watchlist/${watchlistId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        
        if (json.success) {
          setData(json.data.items);
        } else {
          setError(json.error);
        }
      } catch (e) {
        setError('Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    }

    if (watchlistId) {
      fetchData();
      // Refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [watchlistId]);

  return { data, loading, error };
}
```

### React: Markets Page

```tsx
// components/WatchlistTable.tsx
import { useWatchlistMarketData } from '@/hooks/useWatchlist';
import { formatCurrency, formatPercent } from '@/lib/format';

export function WatchlistTable({ watchlistId }: { watchlistId: string }) {
  const { data, loading, error } = useWatchlistMarketData(watchlistId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>Price</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.itemId}>
            <td>{item.asset.symbol}</td>
            <td>{item.asset.name}</td>
            <td>
              {item.price 
                ? formatCurrency(item.price.value, item.asset.currency)
                : '—'
              }
            </td>
            <td className={item.change?.percent >= 0 ? 'positive' : 'negative'}>
              {item.change
                ? `${formatPercent(item.change.percent)}`
                : '—'
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Add Asset to Watchlist

```typescript
async function addToWatchlist(watchlistId: string, assetId: string) {
  const res = await fetch(`/api/watchlists/${watchlistId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ assetId }),
  });
  
  const data = await res.json();
  
  if (!data.success) {
    if (res.status === 409) {
      throw new Error('Asset already in watchlist');
    }
    throw new Error(data.error);
  }
  
  return data.data;
}
```

---

## Test Script

```bash
# 1. List watchlists
curl http://localhost:3000/api/watchlists -b cookies.txt

# 2. Get first watchlist ID from response, then get market data
curl http://localhost:3000/api/markets/watchlist/YOUR_WATCHLIST_ID -b cookies.txt

# 3. Get quick quotes
curl "http://localhost:3000/api/markets/quotes?symbols=AAPL,BTC,ETH" -b cookies.txt

# 4. Create new watchlist
curl -X POST http://localhost:3000/api/watchlists \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Test Watchlist"}'

# 5. Add asset to watchlist (get asset ID first)
ASSET_ID=$(curl -s "http://localhost:3000/api/assets?query=NVDA" -b cookies.txt | jq -r '.data.items[0].id')
curl -X POST http://localhost:3000/api/watchlists/YOUR_WATCHLIST_ID/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"assetId\": \"$ASSET_ID\"}"
```





