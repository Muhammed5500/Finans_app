# US API Documentation

REST endpoints for US market data via Finnhub.

## Base URL

```
http://localhost:3002
```

## Endpoints

### Health Check

```bash
curl http://localhost:3002/health
```

**Response:**
```json
{
  "status": "ok",
  "time": "2026-01-25T10:30:00.000Z"
}
```

---

### Get Single Quote

```bash
curl "http://localhost:3002/api/us/quote?symbol=AAPL"
```

**Query:** `symbol` (required) – US ticker, e.g. AAPL, MSFT, BRK.B

**Response:**
```json
{
  "ok": true,
  "result": {
    "symbol": "AAPL",
    "market": "US",
    "source": "finnhub",
    "fetchedAt": "2026-01-25T15:30:05.123Z",
    "price": 192.50,
    "currency": "USD",
    "open": 191.00,
    "previousClose": 190.25,
    "dayHigh": 193.00,
    "dayLow": 190.50,
    "change": 2.25,
    "changePercent": 1.18,
    "timestamp": "2026-01-25T21:00:00.000Z"
  }
}
```

---

### Get Multiple Quotes

```bash
# Specific symbols
curl "http://localhost:3002/api/us/quotes?symbols=AAPL,MSFT,NVDA"

# Default symbols (AAPL, MSFT, GOOGL, AMZN, NVDA)
curl "http://localhost:3002/api/us/quotes"
```

**Query:** `symbols` (optional) – Comma-separated tickers, max 25. Omit for defaults.

**Response:**
```json
{
  "ok": true,
  "result": [
    {
      "symbol": "AAPL",
      "market": "US",
      "source": "finnhub",
      "fetchedAt": "2026-01-25T15:30:05.123Z",
      "price": 192.50,
      "currency": "USD",
      "change": 2.25,
      "changePercent": 1.18
    },
    {
      "symbol": "MSFT",
      "market": "US",
      "source": "finnhub",
      "fetchedAt": "2026-01-25T15:30:05.456Z",
      "price": 415.20,
      "currency": "USD",
      "change": -1.50,
      "changePercent": -0.36
    }
  ]
}
```

---

### Get Chart Data

```bash
# Default: 1h interval, 5 days
curl "http://localhost:3002/api/us/chart?symbol=AAPL"

# Custom interval and range
curl "http://localhost:3002/api/us/chart?symbol=AAPL&interval=1h&rangeDays=5"
```

**Query:**

| Parameter   | Required | Default | Description |
|------------|----------|---------|-------------|
| `symbol`   | Yes      | -       | US ticker (e.g. AAPL, MSFT) |
| `interval` | No       | `1h`    | `1m`, `5m`, `15m`, `30m`, `1h`, `1d` |
| `rangeDays`| No       | `5`     | 1–365 |

**Response:**
```json
{
  "ok": true,
  "result": {
    "symbol": "AAPL",
    "market": "US",
    "source": "finnhub",
    "fetchedAt": "2026-01-25T15:30:05.123Z",
    "interval": "1h",
    "rangeDays": 5,
    "candles": [
      {
        "time": "2026-01-20T14:30:00.000Z",
        "open": 188.00,
        "high": 189.50,
        "low": 187.50,
        "close": 189.00,
        "volume": 12500000
      }
    ],
    "meta": { "candleCount": 30 }
  }
}
```

---

### Error: Invalid Symbol (400)

```bash
curl "http://localhost:3002/api/us/quote?symbol=INVALID!!"
```

**Response (400):**
```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid US symbol format"
  }
}
```

---

## Run Instructions

### Start the API

```bash
# From projekt root
cp .env.example .env
# Set FINNHUB_API_KEY or FINNHUB_TOKEN in .env

npm run dev
# or: npm run build && npm start
```

### Smoke test (no server)

```bash
FINNHUB_API_KEY=your_key npm run smoke:us
# or: npx ts-node scripts/smoke-us.ts
```

### Curl examples (server must be running)

```bash
curl http://localhost:3002/health
curl "http://localhost:3002/api/us/quote?symbol=AAPL"
curl "http://localhost:3002/api/us/quotes?symbols=AAPL,MSFT,NVDA"
curl "http://localhost:3002/api/us/chart?symbol=AAPL&interval=1h&rangeDays=5"
curl "http://localhost:3002/api/us/quote?symbol=INVALID!!"
```
