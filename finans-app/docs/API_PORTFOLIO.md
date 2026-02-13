# Portfolio API Documentation

## Authentication

All endpoints require authentication. Login first and use cookies:

```bash
# Login and save cookie
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@finans.local", "password": "changeme123"}' \
  -c cookies.txt

# Use cookie for subsequent requests
curl http://localhost:3000/api/accounts -b cookies.txt
```

---

## Accounts API

### List Accounts

```http
GET /api/accounts
```

```bash
curl http://localhost:3000/api/accounts -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx...",
      "name": "Interactive Brokers",
      "type": "brokerage",
      "currency": "USD",
      "institution": "Interactive Brokers LLC",
      "accountNumber": null,
      "isActive": true,
      "notes": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "tradeCount": 5
    }
  ]
}
```

### Create Account

```http
POST /api/accounts
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Fidelity",
    "type": "brokerage",
    "currency": "USD",
    "institution": "Fidelity Investments",
    "notes": "Retirement account"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Account name (1-100 chars) |
| type | enum | ✅ | `brokerage`, `crypto_exchange`, `bank`, `retirement`, `other` |
| currency | enum | ❌ | `USD`, `TRY`, `EUR`, `GBP` (default: USD) |
| institution | string | ❌ | Institution name |
| accountNumber | string | ❌ | Masked account number |
| notes | string | ❌ | Notes (max 500 chars) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "name": "Fidelity",
    "type": "brokerage",
    "currency": "USD",
    "institution": "Fidelity Investments",
    "accountNumber": null,
    "isActive": true,
    "notes": "Retirement account",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Account

```http
GET /api/accounts/:id
```

```bash
curl http://localhost:3000/api/accounts/clxxx... -b cookies.txt
```

### Update Account

```http
PATCH /api/accounts/:id
Content-Type: application/json
```

```bash
curl -X PATCH http://localhost:3000/api/accounts/clxxx... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Fidelity IRA",
    "notes": "Updated notes"
  }'
```

### Delete Account

```http
DELETE /api/accounts/:id
```

```bash
curl -X DELETE http://localhost:3000/api/accounts/clxxx... -b cookies.txt
```

**Note:** If account has trades, it's soft-deleted (isActive=false). Otherwise, hard-deleted.

---

## Assets API

### List Assets

```http
GET /api/assets
GET /api/assets?type=stock
GET /api/assets?exchange=NASDAQ
GET /api/assets?query=apple
GET /api/assets?type=crypto&limit=10&offset=0
```

```bash
# All assets
curl "http://localhost:3000/api/assets" -b cookies.txt

# Filter by type
curl "http://localhost:3000/api/assets?type=crypto" -b cookies.txt

# Search by name/symbol
curl "http://localhost:3000/api/assets?query=bit" -b cookies.txt

# Combine filters with pagination
curl "http://localhost:3000/api/assets?type=stock&exchange=NASDAQ&limit=10" -b cookies.txt
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| type | enum | `stock`, `crypto`, `etf`, `bond`, `cash`, `commodity` |
| exchange | string | Exchange filter (NASDAQ, BIST, CRYPTO, etc.) |
| query | string | Search symbol or name (case-insensitive) |
| limit | number | Results per page (1-100, default 50) |
| offset | number | Skip N results (default 0) |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "exchange": "CRYPTO",
        "currency": "USD",
        "isin": null,
        "sector": null,
        "country": null,
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 21,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Create Asset

```http
POST /api/assets
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "symbol": "DOGE",
    "name": "Dogecoin",
    "type": "crypto",
    "exchange": "CRYPTO",
    "currency": "USD"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| symbol | string | ✅ | Asset symbol (auto-uppercased) |
| name | string | ✅ | Asset name |
| type | enum | ✅ | Asset type |
| exchange | string | ❌ | Exchange (default: GLOBAL) |
| currency | enum | ❌ | Currency (default: USD) |
| isin | string | ❌ | ISIN code |
| sector | string | ❌ | Sector |
| country | string | ❌ | Country |

### Get Asset

```http
GET /api/assets/:id
```

```bash
curl http://localhost:3000/api/assets/clxxx... -b cookies.txt
```

**Response includes latest price:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "crypto",
    "exchange": "CRYPTO",
    "currency": "USD",
    "latestPrice": {
      "close": "95000.00",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "source": "coingecko"
    },
    "tradeCount": 2
  }
}
```

### Update Asset

```http
PATCH /api/assets/:id
Content-Type: application/json
```

```bash
curl -X PATCH http://localhost:3000/api/assets/clxxx... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "sector": "Technology"
  }'
```

### Delete Asset

```http
DELETE /api/assets/:id
```

```bash
curl -X DELETE http://localhost:3000/api/assets/clxxx... -b cookies.txt
```

---

## Trades API

### List Trades

```http
GET /api/trades
GET /api/trades?accountId=clxxx...
GET /api/trades?assetId=clxxx...
GET /api/trades?type=buy
GET /api/trades?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z
```

```bash
# All trades
curl "http://localhost:3000/api/trades" -b cookies.txt

# Filter by account
curl "http://localhost:3000/api/trades?accountId=clxxx..." -b cookies.txt

# Filter by asset
curl "http://localhost:3000/api/trades?assetId=clxxx..." -b cookies.txt

# Filter by date range
curl "http://localhost:3000/api/trades?startDate=2024-01-01T00:00:00Z&endDate=2024-06-30T23:59:59Z" -b cookies.txt

# Combine filters
curl "http://localhost:3000/api/trades?type=buy&limit=20" -b cookies.txt
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| accountId | string | Filter by account |
| assetId | string | Filter by asset |
| type | enum | Trade type |
| startDate | ISO date | Filter trades >= date |
| endDate | ISO date | Filter trades <= date |
| limit | number | Results per page (1-100, default 50) |
| offset | number | Skip N results (default 0) |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxxx...",
        "type": "buy",
        "quantity": 50,
        "price": 142.5,
        "fees": 1,
        "total": 7126,
        "currency": "USD",
        "executedAt": "2024-03-15T00:00:00.000Z",
        "notes": null,
        "externalId": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "account": {
          "id": "clxxx...",
          "name": "Interactive Brokers",
          "type": "brokerage"
        },
        "asset": {
          "id": "clxxx...",
          "symbol": "AAPL",
          "name": "Apple Inc.",
          "type": "stock"
        }
      }
    ],
    "pagination": {
      "total": 14,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Create Trade

```http
POST /api/trades
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/api/trades \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "accountId": "clxxx...",
    "assetId": "clxxx...",
    "type": "buy",
    "quantity": 10,
    "price": 185.50,
    "fees": 1.00,
    "currency": "USD",
    "executedAt": "2024-01-15T10:30:00Z",
    "notes": "Adding to position"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| accountId | string | ✅ | Account ID (cuid) |
| assetId | string | ✅ | Asset ID (cuid) |
| type | enum | ✅ | `buy`, `sell`, `dividend`, `interest`, `deposit`, `withdrawal`, `transfer_in`, `transfer_out`, `split`, `fee` |
| quantity | number | ✅ | Positive number |
| price | number | ✅ | Price per unit (>= 0) |
| fees | number | ❌ | Fees (default 0) |
| currency | enum | ❌ | Currency (default: USD) |
| executedAt | ISO date | ✅ | Execution timestamp |
| notes | string | ❌ | Notes (max 500) |
| externalId | string | ❌ | External reference |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "type": "buy",
    "quantity": 10,
    "price": 185.5,
    "fees": 1,
    "total": 1856,
    "currency": "USD",
    "executedAt": "2024-01-15T10:30:00.000Z",
    "notes": "Adding to position",
    "account": { ... },
    "asset": { ... }
  }
}
```

### Get Trade

```http
GET /api/trades/:id
```

```bash
curl http://localhost:3000/api/trades/clxxx... -b cookies.txt
```

### Update Trade

```http
PATCH /api/trades/:id
Content-Type: application/json
```

```bash
curl -X PATCH http://localhost:3000/api/trades/clxxx... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "notes": "Updated note",
    "fees": 1.50
  }'
```

### Delete Trade

```http
DELETE /api/trades/:id
```

```bash
curl -X DELETE http://localhost:3000/api/trades/clxxx... -b cookies.txt
```

**Note:** Trades are hard-deleted. Consider keeping audit trail in production.

---

## Trade Types

| Type | Description | Total Calculation |
|------|-------------|-------------------|
| `buy` | Purchase asset | quantity × price + fees |
| `sell` | Sell asset | quantity × price - fees |
| `dividend` | Dividend received | quantity × price |
| `interest` | Interest payment | quantity × price |
| `deposit` | Cash deposit | quantity × price + fees |
| `withdrawal` | Cash withdrawal | quantity × price - fees |
| `transfer_in` | Asset transfer in | quantity × price + fees |
| `transfer_out` | Asset transfer out | quantity × price - fees |
| `split` | Stock split | 0 |
| `fee` | Account fee | fees |

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": {
    "name": ["Name is required"],
    "type": ["Invalid enum value"]
  }
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Account not found"
}
```

### Duplicate (409)
```json
{
  "success": false,
  "error": "Duplicate value for symbol, exchange"
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Position Calculation Trade-offs

The current implementation does **not** enforce position constraints (e.g., preventing negative positions on sell).

**Pros of current approach:**
- Simpler implementation
- Allows corrections and backdated trades
- Supports transfers between accounts
- Handles stock splits and corporate actions

**Cons:**
- User can create invalid data (e.g., sell more than owned)
- Position must be calculated at read time

**Future enhancement:** Add optional position validation that can be toggled.





