# KAP (Kamuyu Aydınlatma Platformu) Collector Setup

## Overview

KAP (Public Disclosure Platform) is Turkey's official platform for corporate disclosures. This collector fetches disclosures from KAP using their internal API endpoints.

**Important**: KAP does not provide an official public API. This collector uses endpoints discovered by inspecting browser network calls. These endpoints may change without notice.

## Finding the Correct Endpoint

### Step 1: Open KAP's Disclosure Query Page

1. Navigate to: https://www.kap.org.tr/tr/bildirim-sorgu
2. Open your browser's Developer Tools (F12)
3. Go to the **Network** tab
4. Filter by "XHR" or "Fetch" requests

### Step 2: Perform a Search

1. On the KAP page, fill in some search criteria (or leave defaults)
2. Click "Ara" (Search)
3. Watch the Network tab for new requests

### Step 3: Identify the API Endpoint

Look for requests that return JSON data with disclosure information. Common patterns:

```
POST https://www.kap.org.tr/tr/api/bildirim
POST https://www.kap.org.tr/tr/api/bildirimSorgu
POST https://www.kap.org.tr/tr/api/memberDisclosures
```

### Step 4: Inspect Request Details

Click on the API request and note:

1. **Request URL** → `KAP_QUERY_PATH`
2. **Request Method** → `KAP_METHOD`
3. **Request Headers** → `KAP_HEADERS`
4. **Request Body (POST)** → `KAP_BODY`
5. **Response Format** → `KAP_RESPONSE_TYPE`

## Configuration

Set these environment variables in your `.env` file:

```bash
# Enable/disable the collector
KAP_ENABLED=true

# Base URL (usually don't need to change)
KAP_BASE_URL=https://www.kap.org.tr

# Query path discovered from Network tab
# Example: /tr/api/bildirim or /tr/api/memberDisclosures
KAP_QUERY_PATH=/tr/api/bildirim

# HTTP method (GET or POST)
KAP_METHOD=POST

# Request headers (JSON format)
# Copy important headers from browser DevTools
KAP_HEADERS={"Content-Type":"application/json","X-Requested-With":"XMLHttpRequest"}

# Request body for POST requests (JSON format)
# Example body that typically works:
KAP_BODY={"fromDate":"","toDate":"","year":"","pession":"","subject":"","term":"","memberOidOrIndex":"","disclosure":"","disclosureType":"","stockCode":""}

# Query params for GET requests (JSON format)
KAP_QUERY_PARAMS={}

# Expected response type: json, html, or auto
KAP_RESPONSE_TYPE=json
```

## Response Format

The collector supports multiple response formats. Here are common structures:

### Format 1: Wrapped Array

```json
{
  "success": true,
  "data": [
    {
      "disclosureId": "12345",
      "title": "Özel Durum Açıklaması",
      "url": "/bildirim/12345",
      "publishDate": "15.01.2024 16:30",
      "stockCode": "THYAO",
      "companyName": "Türk Hava Yolları A.O.",
      "disclosureType": "ODA"
    }
  ]
}
```

### Format 2: Turkish Field Names

```json
{
  "basarili": true,
  "bildirimler": [
    {
      "bildirrimId": "12345",
      "baslik": "Özel Durum Açıklaması",
      "yayinTarihi": "15.01.2024 16:30",
      "hisseKodu": "THYAO",
      "sirketAdi": "Türk Hava Yolları A.O.",
      "bildirimTipi": "ODA"
    }
  ]
}
```

### Format 3: Direct Array

```json
[
  {
    "id": "12345",
    "title": "Disclosure Title",
    "link": "/bildirim/12345",
    "publishDate": "2024-01-15T16:30:00"
  }
]
```

## Field Mapping

The parser automatically maps various field names:

| Standard Field | Alternative Names |
|---------------|-------------------|
| `sourceId` | `disclosureId`, `id`, `bildirrimId` |
| `title` | `baslik`, `disclosureTitle` |
| `url` | `link`, `pdfUrl` |
| `publishedAt` | `publishDate`, `yayinTarihi`, `disclosureDate` |
| `stockCode` | `hisseKodu` |
| `companyName` | `sirketAdi` |
| `disclosureType` | `bildirimTipi` |

## Date Formats

Supported date formats:

- ISO 8601: `2024-01-15T16:30:00`
- Turkish: `15.01.2024 16:30` or `15.01.2024 16:30:00`
- Alternative: `2024-01-15 16:30:00`
- Unix timestamp: `1705337400` (seconds) or `1705337400000` (ms)

## Rate Limiting

The collector enforces a **minimum 5-second delay** between requests to be respectful of KAP's servers.

Do NOT reduce this limit. KAP may block IPs that make too many requests.

## Troubleshooting

### No data returned

1. Check `KAP_QUERY_PATH` is set correctly
2. Verify the endpoint hasn't changed (re-inspect Network tab)
3. Check `KAP_BODY` contains correct parameters

### 403 Forbidden

KAP may be blocking requests. Try:
1. Adding more browser-like headers in `KAP_HEADERS`
2. Using a different User-Agent
3. Waiting before retrying

### Parse errors

1. Check `KAP_RESPONSE_TYPE` matches actual response
2. Try `auto` to let the parser detect format
3. Check logs for actual response content

## Example Complete Configuration

```bash
# .env
KAP_ENABLED=true
KAP_BASE_URL=https://www.kap.org.tr
KAP_QUERY_PATH=/tr/api/bildirim
KAP_METHOD=POST
KAP_HEADERS={"Content-Type":"application/json","Accept":"application/json","Origin":"https://www.kap.org.tr","Referer":"https://www.kap.org.tr/tr/bildirim-sorgu"}
KAP_BODY={"fromDate":"","toDate":"","year":"","pession":"","subject":"","term":"","memberOidOrIndex":"","disclosure":"","disclosureType":"","stockCode":""}
KAP_RESPONSE_TYPE=json
```

## Testing

To manually trigger collection:

```bash
# Via API (if admin endpoint is exposed)
curl -X POST http://localhost:4000/admin/ingestion/kap/trigger

# Or check status
curl http://localhost:4000/admin/ingestion/status
```

## Caching & Deduplication

The collector uses:
1. **In-memory cache** (10,000 items, 24h TTL) for fast deduplication
2. **Database URL uniqueness** as final dedup layer
3. **sourceId + URL** dual-key caching

This prevents re-ingesting the same disclosure even if it appears in multiple API calls.


