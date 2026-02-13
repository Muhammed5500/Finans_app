# BIST API Documentation

REST API endpoints for BIST (Borsa Istanbul) market data via Yahoo Finance.

## Base URL

```
http://localhost:3002
```

## Endpoints

### Health Check

Check if the API is running.

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

Get real-time quote for a BIST symbol.

```bash
# Using base symbol
curl "http://localhost:3002/api/bist/quote?symbol=THYAO"

# Using full Yahoo symbol
curl "http://localhost:3002/api/bist/quote?symbol=THYAO.IS"

# BIST 100 Index
curl "http://localhost:3002/api/bist/quote?symbol=XU100"
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "symbol": "THYAO.IS",
    "name": "TURK HAVA YOLLARI",
    "displayName": "Türk Hava Yolları A.O.",
    "exchange": "IST",
    "currency": "TRY",
    "price": 287.50,
    "change": 3.25,
    "changePercent": 1.14,
    "previousClose": 284.25,
    "open": 285.00,
    "dayHigh": 289.00,
    "dayLow": 283.50,
    "volume": 12500000,
    "marketCap": 396000000000,
    "fiftyTwoWeekHigh": 320.00,
    "fiftyTwoWeekLow": 180.00,
    "timestamp": "2026-01-25T15:30:00.000Z",
    "market": "BIST",
    "source": "yahoo",
    "fetchedAt": "2026-01-25T15:30:05.123Z"
  }
}
```

---

### Get Multiple Quotes

Get quotes for multiple BIST symbols at once.

```bash
# Specific symbols
curl "http://localhost:3002/api/bist/quotes?symbols=THYAO,GARAN,AKBNK"

# Default symbols (BIST30 blue chips)
curl "http://localhost:3002/api/bist/quotes"
```

**Query Parameters:**
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `symbols` | No | BIST30 list | Comma-separated symbols (max 25) |

**Response:**
```json
{
  "ok": true,
  "result": [
    {
      "symbol": "THYAO.IS",
      "name": "TURK HAVA YOLLARI",
      "price": 287.50,
      "change": 3.25,
      "changePercent": 1.14,
      "market": "BIST",
      "source": "yahoo",
      "fetchedAt": "2026-01-25T15:30:05.123Z"
    },
    {
      "symbol": "GARAN.IS",
      "name": "GARANTI BANKASI",
      "price": 95.20,
      "change": -0.80,
      "changePercent": -0.83,
      "market": "BIST",
      "source": "yahoo",
      "fetchedAt": "2026-01-25T15:30:05.456Z"
    }
  ]
}
```

---

### Get Chart Data

Get candlestick/OHLCV data for a BIST symbol.

```bash
# Default: 1h interval, 5d range
curl "http://localhost:3002/api/bist/chart?symbol=THYAO"

# Custom interval and range
curl "http://localhost:3002/api/bist/chart?symbol=THYAO&interval=1d&range=1mo"

# 4-hour candles for 1 month
curl "http://localhost:3002/api/bist/chart?symbol=XU100&interval=4h&range=1mo"
```

**Query Parameters:**
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `symbol` | Yes | - | BIST symbol (e.g., THYAO, XU100) |
| `interval` | No | `1h` | Candle interval: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d` |
| `range` | No | `5d` | Data range: `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max` |

**Response:**
```json
{
  "ok": true,
  "result": {
    "symbol": "THYAO.IS",
    "interval": "1h",
    "range": "5d",
    "candles": [
      {
        "time": "2026-01-20T09:00:00.000Z",
        "open": 280.00,
        "high": 285.00,
        "low": 278.00,
        "close": 284.00,
        "volume": 5000000
      },
      {
        "time": "2026-01-20T10:00:00.000Z",
        "open": 284.00,
        "high": 287.00,
        "low": 282.00,
        "close": 286.00,
        "volume": 4500000
      }
    ],
    "meta": {
      "requestedInterval": "1h",
      "providerInterval": "1h",
      "requestedRange": "5d",
      "timezone": "Europe/Istanbul",
      "gmtOffset": 10800,
      "currency": "TRY",
      "exchange": "IST",
      "candleCount": 25,
      "firstCandleTime": "2026-01-20T09:00:00.000Z",
      "lastCandleTime": "2026-01-25T15:00:00.000Z"
    },
    "market": "BIST",
    "source": "yahoo",
    "fetchedAt": "2026-01-25T15:30:05.123Z"
  }
}
```

---

### Error Response (Invalid Symbol)

```bash
curl "http://localhost:3002/api/bist/quote?symbol=INVALID123"
```

**Response (400 Bad Request):**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_SYMBOL",
    "message": "Invalid BIST symbol: \"INVALID123\". Must be 3-6 uppercase letters (e.g., THYAO, GARAN)"
  }
}
```

---

## Common BIST Symbols

### Indices
| Symbol | Description |
|--------|-------------|
| `XU100` | BIST 100 Index |
| `XU030` | BIST 30 Index |
| `XUTEK` | BIST Technology Index |
| `XBANK` | BIST Banks Index |

### Popular Stocks
| Symbol | Company |
|--------|---------|
| `THYAO` | Turkish Airlines |
| `GARAN` | Garanti Bank |
| `AKBNK` | Akbank |
| `KCHOL` | Koç Holding |
| `ASELS` | Aselsan |
| `SISE` | Şişecam |
| `EREGL` | Ereğli Demir Çelik |
| `BIMAS` | BİM |
| `SAHOL` | Sabancı Holding |
| `TUPRS` | Tüpraş |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_SYMBOL` | 400 | Invalid symbol format |
| `SYMBOL_NOT_FOUND` | 404 | Symbol not found in Yahoo Finance |
| `INVALID_INTERVAL` | 400 | Invalid interval parameter |
| `INVALID_RANGE` | 400 | Invalid range parameter |
| `TOO_MANY_SYMBOLS` | 400 | Too many symbols (max 25) |
| `RATE_LIMIT` | 429 | Yahoo Finance rate limit |
| `PROVIDER_THROTTLED` | 429 | Yahoo Finance blocking requests |
| `NETWORK_ERROR` | 503 | Network connectivity issue |
| `PROVIDER_ERROR` | 502 | Yahoo Finance error |

---

## Rate Limiting

- API rate limit: **120 requests/minute per IP**
- Yahoo Finance protection:
  - Max 3 concurrent requests
  - 100ms minimum delay between requests
  - Caching (10s quote, 60s chart)
  - Stale-if-error (2 minute fallback)

---

## Smoke Test

Run the BIST integration smoke test:

```bash
npm run smoke:bist
```

This tests:
1. XU100.IS quote (BIST 100 Index)
2. THYAO.IS quote (Turkish Airlines)
3. XU100.IS chart (1h interval, 5d range)
