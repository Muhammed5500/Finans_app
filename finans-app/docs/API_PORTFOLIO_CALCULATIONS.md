# Portfolio Calculations API

## Overview

These endpoints calculate portfolio positions and summary **dynamically** from trade data. No snapshots are stored - calculations are performed on each request.

## Calculation Method: Average Cost Basis

The portfolio uses the **Average Cost Method** for position calculations:

```
When buying:
  new_avg_cost = (old_qty × old_avg + buy_qty × buy_price) / total_qty

When selling:
  quantity -= sell_qty
  avg_cost stays the same (realized gain calculated)

Cost basis = quantity × avg_cost
```

### Why Average Cost?

- **Simple**: One number to track per position
- **Common**: Used by most brokerages for mutual funds and crypto
- **Tax-friendly**: Accepted method in most jurisdictions
- **No lot tracking**: Don't need to track individual purchase lots

### Trade Type Handling

| Type | Effect on Position |
|------|-------------------|
| `buy` | +quantity, adjusts avg_cost |
| `sell` | -quantity, calculates realized gain |
| `dividend` | Tracked as income, no position change |
| `interest` | Tracked as income, no position change |
| `deposit` | +quantity (for cash positions) |
| `withdrawal` | -quantity |
| `transfer_in` | +quantity, adjusts avg_cost |
| `transfer_out` | -quantity |
| `split` | Adjusts quantity & avg_cost inversely |
| `fee` | Tracked as expense |

---

## API Endpoints

### GET /api/portfolio/positions

Returns calculated positions for all assets with trades.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| accountId | string | Filter by specific account |
| includeZero | boolean | Include closed positions (default: false) |

**Request:**
```bash
# All positions
curl http://localhost:3000/api/portfolio/positions -b cookies.txt

# Positions for specific account
curl "http://localhost:3000/api/portfolio/positions?accountId=clxxx..." -b cookies.txt

# Include closed positions
curl "http://localhost:3000/api/portfolio/positions?includeZero=true" -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "assetId": "clxxx...",
        "asset": {
          "id": "clxxx...",
          "symbol": "AAPL",
          "name": "Apple Inc.",
          "type": "stock",
          "exchange": "NASDAQ",
          "currency": "USD"
        },
        "quantity": 150,
        "avgCost": 158.67,
        "costBasis": 23800.50,
        "currentPrice": 185.50,
        "currentValue": 27825.00,
        "unrealizedGain": 4024.50,
        "unrealizedGainPercent": 16.91,
        "realizedGain": 0,
        "totalDividends": 37.50,
        "totalFees": 2.00
      },
      {
        "assetId": "clyyy...",
        "asset": {
          "symbol": "BTC",
          "name": "Bitcoin",
          "type": "crypto",
          ...
        },
        "quantity": 0.75,
        "avgCost": 49666.67,
        "costBasis": 37250.00,
        "currentPrice": 95000.00,
        "currentValue": 71250.00,
        "unrealizedGain": 34000.00,
        "unrealizedGainPercent": 91.28,
        ...
      }
    ],
    "meta": {
      "count": 9,
      "pricesMissing": [],
      "calculatedAt": "2024-01-15T10:30:00.000Z",
      "accountFilter": null
    }
  }
}
```

**Position Fields:**

| Field | Type | Description |
|-------|------|-------------|
| quantity | number | Current position size |
| avgCost | number | Weighted average purchase price |
| costBasis | number | quantity × avgCost |
| currentPrice | number\|null | Latest price (null if no price data) |
| currentValue | number\|null | quantity × currentPrice |
| unrealizedGain | number\|null | currentValue - costBasis |
| unrealizedGainPercent | number\|null | (unrealizedGain / costBasis) × 100 |
| realizedGain | number | Gain/loss from closed positions |
| totalDividends | number | Total dividends received |
| totalFees | number | Total fees paid |

---

### GET /api/portfolio/summary

Returns portfolio-level summary with totals and top holdings.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| accountId | string | Filter by specific account |

**Request:**
```bash
curl http://localhost:3000/api/portfolio/summary -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCostBasis": 125450.75,
    "positionCount": 9,
    "totalValue": 178325.50,
    "unrealizedGain": 52874.75,
    "unrealizedGainPercent": 42.15,
    
    "allocationByType": [
      {
        "type": "stock",
        "costBasis": 56150.50,
        "value": 72450.00,
        "percentage": 40.63
      },
      {
        "type": "crypto",
        "costBasis": 54750.25,
        "value": 89325.00,
        "percentage": 50.09
      },
      {
        "type": "etf",
        "costBasis": 9000.00,
        "value": 9570.00,
        "percentage": 5.37
      }
    ],
    
    "topHoldings": [
      {
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "quantity": 0.75,
        "costBasis": 37250.00,
        "value": 71250.00,
        "weight": 39.96
      },
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "stock",
        "quantity": 150,
        "costBasis": 23800.50,
        "value": 27825.00,
        "weight": 15.60
      },
      ...
    ],
    
    "totalRealizedGain": 2593.00,
    "totalDividends": 37.50,
    "totalFees": 302.45,
    
    "pricesMissing": [],
    "calculatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Summary Fields:**

| Field | Type | Description |
|-------|------|-------------|
| totalCostBasis | number | Sum of all position cost bases |
| positionCount | number | Number of active positions |
| totalValue | number\|null | Sum of all position values (null if any price missing) |
| unrealizedGain | number\|null | totalValue - totalCostBasis |
| unrealizedGainPercent | number\|null | Percentage gain/loss |
| allocationByType | array | Breakdown by asset type |
| topHoldings | array | Top 10 positions by value |
| totalRealizedGain | number | Sum of realized gains from sells |
| totalDividends | number | Sum of all dividends |
| totalFees | number | Sum of all fees |
| pricesMissing | string[] | Symbols without price data |
| calculatedAt | string | Calculation timestamp |

---

## Edge Cases

### Missing Prices

If a position is missing price data:
- Position: `currentPrice`, `currentValue`, `unrealizedGain` = `null`
- Summary: `totalValue`, `unrealizedGain` = `null` (incomplete)
- `pricesMissing` array lists affected symbols

### Zero Positions

Positions where all shares have been sold:
- Not included in summary calculations
- Can be retrieved with `?includeZero=true`
- Still show `realizedGain` from historical trades

### Negative Positions (Short Selling)

Current implementation doesn't prevent negative positions:
- If sell > owned, position becomes 0 (capped)
- Warning logged for data inconsistencies
- Future: Add validation or short-selling support

### Stock Splits

When processing a split trade:
```
quantity = quantity × split_ratio
avgCost = avgCost / split_ratio
costBasis unchanged
```

Example: 4:1 split
- Before: 100 shares @ $400 avg = $40,000 cost basis
- After: 400 shares @ $100 avg = $40,000 cost basis

### Multiple Currencies

Current implementation:
- Each position maintains its original currency
- No automatic currency conversion
- Frontend should handle display conversion using FX rates

Future enhancement: Add `?baseCurrency=TRY` to convert all values.

---

## Calculation Examples

### Example 1: Simple Buy/Sell

```
Trade 1: BUY 100 AAPL @ $150
  quantity = 100
  avgCost = $150
  costBasis = $15,000

Trade 2: BUY 50 AAPL @ $180
  new_avgCost = (100 × $150 + 50 × $180) / 150 = $160
  quantity = 150
  costBasis = $24,000

Trade 3: SELL 50 AAPL @ $200
  realized_gain = (200 - 160) × 50 = $2,000
  quantity = 100
  avgCost = $160 (unchanged)
  costBasis = $16,000

Current price: $185
  currentValue = 100 × $185 = $18,500
  unrealizedGain = $18,500 - $16,000 = $2,500
```

### Example 2: Dividends

```
Position: 100 shares of AAPL

Trade: DIVIDEND 100 × $0.25
  totalDividends += $25
  quantity unchanged
  costBasis unchanged
```

### Example 3: Stock Split

```
Before split: 50 shares @ $800 avg = $40,000 basis

Trade: SPLIT ratio 4 (4:1 split)
  quantity = 50 × 4 = 200 shares
  avgCost = $800 / 4 = $200
  costBasis = $40,000 (unchanged)
```

---

## Performance Considerations

1. **Trades sorted by date**: Calculations process trades chronologically
2. **Raw SQL for prices**: Uses `DISTINCT ON` for efficient latest price lookup
3. **No caching**: Each request recalculates (consider caching for large portfolios)
4. **Account filtering**: Filter early to reduce data processed

Future optimizations:
- Materialized positions table (updated on trade changes)
- Price caching with TTL
- Incremental calculation for new trades only





