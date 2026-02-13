# News API Documentation

## Overview

The News API allows tracking financial news from RSS feeds. Users can add their own RSS sources, and the system ingests articles for reading with read/unread tracking.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  RSS Sources     │ ──▶ │  RSS Parser      │ ──▶ │  news_items  │
│  (user-defined)  │     │  (rss-parser)    │     │    table     │
└──────────────────┘     └──────────────────┘     └──────────────┘
                                                        │
                                                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  News Feed UI    │ ◀── │  GET /api/news/  │ ◀── │  read_states │
│                  │     │      feed        │     │    table     │
└──────────────────┘     └──────────────────┘     └──────────────┘
```

---

## RSS Sources API

### List Sources

```http
GET /api/news/sources
```

```bash
curl http://localhost:3000/api/news/sources -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx...",
      "name": "Bloomberg Markets",
      "url": "https://feeds.bloomberg.com/markets/news.rss",
      "description": "Market news from Bloomberg",
      "tags": ["markets", "global"],
      "isActive": true,
      "lastFetchedAt": "2024-01-15T10:00:00.000Z",
      "itemCount": 127,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Source

```http
POST /api/news/sources
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/api/news/sources \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Reuters Business",
    "url": "https://feeds.reuters.com/reuters/businessNews",
    "description": "Business news from Reuters",
    "tags": ["business", "global"]
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Source name (1-100 chars) |
| url | string | ✅ | RSS feed URL |
| description | string | ❌ | Description (max 500) |
| tags | string[] | ❌ | Tags for filtering (max 10) |
| isActive | boolean | ❌ | Active status (default: true) |

### Update Source

```http
PATCH /api/news/sources/:id
```

```bash
curl -X PATCH http://localhost:3000/api/news/sources/clxxx... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "isActive": false
  }'
```

### Delete Source

```http
DELETE /api/news/sources/:id
```

Deletes the source and all its news items.

---

## News Feed API

### Get Feed

```http
GET /api/news/feed
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `since` | ISO date | Items published after this date |
| `sourceId` | string | Filter by source ID |
| `unreadOnly` | boolean | Only unread items (default: false) |
| `tag` | string | Filter by source tag |
| `limit` | number | Items per page (default: 50, max: 100) |
| `offset` | number | Pagination offset |

```bash
# All recent news
curl "http://localhost:3000/api/news/feed" -b cookies.txt

# Unread only
curl "http://localhost:3000/api/news/feed?unreadOnly=true" -b cookies.txt

# Filter by tag
curl "http://localhost:3000/api/news/feed?tag=crypto" -b cookies.txt

# Since specific date
curl "http://localhost:3000/api/news/feed?since=2024-01-14T00:00:00Z" -b cookies.txt

# Pagination
curl "http://localhost:3000/api/news/feed?limit=20&offset=40" -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clitem...",
        "title": "Bitcoin Hits New High Amid ETF Optimism",
        "url": "https://example.com/article/123",
        "summary": "Bitcoin reached a new all-time high today...",
        "publishedAt": "2024-01-15T09:30:00.000Z",
        "source": {
          "id": "clsrc...",
          "name": "CoinDesk",
          "tags": ["crypto"]
        },
        "isRead": false,
        "readAt": null
      },
      {
        "id": "clitem2...",
        "title": "Fed Signals Rate Cut in March",
        "url": "https://example.com/article/456",
        "summary": "Federal Reserve officials indicated...",
        "publishedAt": "2024-01-15T08:15:00.000Z",
        "source": {
          "id": "clsrc2...",
          "name": "Reuters",
          "tags": ["markets"]
        },
        "isRead": true,
        "readAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "meta": {
      "total": 245,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### Mark as Read

```http
POST /api/news/:id/read
```

```bash
curl -X POST http://localhost:3000/api/news/clitem.../read -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clitem...",
    "isRead": true,
    "readAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Mark as Unread

```http
POST /api/news/:id/unread
```

```bash
curl -X POST http://localhost:3000/api/news/clitem.../unread -b cookies.txt
```

---

## RSS Ingestion API

### Trigger Ingestion

```http
POST /api/admin/ingest/rss
```

Fetches all active RSS sources and imports new items.

```bash
# Ingest all sources
curl -X POST http://localhost:3000/api/admin/ingest/rss \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# Ingest specific source
curl -X POST http://localhost:3000/api/admin/ingest/rss \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"sourceId": "clsrc..."}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "totals": {
      "sourcesProcessed": 5,
      "sourcesFailed": 0,
      "itemsFetched": 125,
      "itemsInserted": 23,
      "itemsSkipped": 102
    },
    "sources": [
      {
        "id": "clsrc1...",
        "name": "Bloomberg Markets",
        "success": true,
        "itemsFetched": 25,
        "itemsInserted": 5,
        "itemsSkipped": 20
      },
      {
        "id": "clsrc2...",
        "name": "CoinDesk",
        "success": true,
        "itemsFetched": 30,
        "itemsInserted": 8,
        "itemsSkipped": 22
      }
    ],
    "durationMs": 3450,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Stats Explanation:**
- `itemsFetched`: Total items parsed from feeds
- `itemsInserted`: New items added to database
- `itemsSkipped`: Items already exist (de-duplicated by URL)
- `sourcesFailed`: Sources that couldn't be fetched/parsed

---

## De-duplication

News items are de-duplicated by URL within each source:

- Unique constraint: `(source_id, url)`
- Same article from different sources = separate items
- Re-ingesting doesn't create duplicates

---

## Recommended RSS Sources

Here's a recommended format for adding financial news sources:

### Crypto
```json
{
  "name": "CoinDesk",
  "url": "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "tags": ["crypto", "blockchain"]
}
```

### Markets
```json
{
  "name": "Reuters Business",
  "url": "https://feeds.reuters.com/reuters/businessNews",
  "tags": ["business", "global"]
}
```

### Turkey / BIST
```json
{
  "name": "BloombergHT",
  "url": "https://www.bloomberght.com/rss",
  "tags": ["turkey", "bist"]
}
```

### Tech
```json
{
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed/",
  "tags": ["tech", "startups"]
}
```

### Central Banks
```json
{
  "name": "Fed News",
  "url": "https://www.federalreserve.gov/feeds/press_all.xml",
  "tags": ["central-bank", "fed"]
}
```

---

## Frontend Usage

### React Hook Example

```typescript
// hooks/useNewsFeed.ts
import { useState, useEffect, useCallback } from 'react';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string;
  source: { name: string; tags: string[] };
  isRead: boolean;
}

export function useNewsFeed(options: {
  unreadOnly?: boolean;
  tag?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchNews = useCallback(async (offset = 0) => {
    const params = new URLSearchParams();
    if (options.unreadOnly) params.set('unreadOnly', 'true');
    if (options.tag) params.set('tag', options.tag);
    params.set('limit', String(options.limit || 50));
    params.set('offset', String(offset));

    const res = await fetch(`/api/news/feed?${params}`, {
      credentials: 'include',
    });
    const { data } = await res.json();

    if (offset === 0) {
      setItems(data.items);
    } else {
      setItems(prev => [...prev, ...data.items]);
    }
    setHasMore(data.meta.hasMore);
    setLoading(false);
  }, [options]);

  const markRead = async (id: string) => {
    await fetch(`/api/news/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    });
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isRead: true } : item
      )
    );
  };

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { items, loading, hasMore, fetchMore: fetchNews, markRead };
}
```

### News List Component

```tsx
export function NewsList() {
  const { items, loading, markRead } = useNewsFeed({ unreadOnly: true });

  if (loading) return <div>Loading...</div>;

  return (
    <ul className="news-list">
      {items.map(item => (
        <li 
          key={item.id} 
          className={item.isRead ? 'read' : 'unread'}
          onClick={() => markRead(item.id)}
        >
          <span className="source">{item.source.name}</span>
          <a href={item.url} target="_blank" rel="noopener">
            {item.title}
          </a>
          <time>{new Date(item.publishedAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}
```

---

## Scheduled Ingestion

For automatic news updates:

**Vercel Cron:**
```json
{
  "crons": [{
    "path": "/api/admin/ingest/rss",
    "schedule": "*/30 * * * *"
  }]
}
```

**External Scheduler:**
```bash
# Every 30 minutes
*/30 * * * * curl -X POST https://yourapp.com/api/admin/ingest/rss -H "Cookie: ..."
```

---

## Error Handling

### Invalid Feed URL
```json
{
  "sources": [{
    "name": "Bad Source",
    "success": false,
    "error": "Status code 404"
  }]
}
```

### Network Timeout
```json
{
  "sources": [{
    "name": "Slow Source",
    "success": false,
    "error": "network timeout at: https://..."
  }]
}
```

The ingestion continues even if some sources fail - only failed sources are marked with errors.

---

## Test Script

```bash
# 1. Create RSS source
curl -X POST http://localhost:3000/api/news/sources \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Hacker News",
    "url": "https://hnrss.org/frontpage",
    "tags": ["tech"]
  }'

# 2. Ingest feeds
curl -X POST http://localhost:3000/api/admin/ingest/rss \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# 3. Get news feed
curl "http://localhost:3000/api/news/feed?limit=10" -b cookies.txt

# 4. Mark item as read
curl -X POST http://localhost:3000/api/news/ITEM_ID/read -b cookies.txt

# 5. Get unread only
curl "http://localhost:3000/api/news/feed?unreadOnly=true" -b cookies.txt
```





