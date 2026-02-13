# News Embeddings & Vector Search

## Overview

The embeddings system generates vector representations of news items for semantic search using OpenAI's embedding API and pgvector.

## Architecture

```
news_items_clean → OpenAI Embeddings API → news_embeddings (JSON + vector)
                                                      ↓
                                            Vector Search (pgvector)
```

## Embedding Generation

### Text Preparation

Embeddings are generated from:
```
${title}\n\n${content}
```

- Text is truncated to 8000 characters (safety limit)
- Empty content falls back to title only
- Format: Title on first line, content on subsequent lines

### Model Configuration

- **Default Model**: `text-embedding-3-small`
- **Dimensions**: 1536
- **Configurable**: Set `EMBEDDING_MODEL` environment variable

### Storage

Embeddings are stored in two formats:
1. **JSON** (Prisma-compatible): Array of floats in `embedding` column
2. **Vector** (pgvector): `vector(1536)` type in `embedding_vector` column

The vector column is used for similarity search, JSON is for compatibility.

## Usage

### Generate Embeddings

```bash
# Generate embeddings for all items without embeddings
npm run embed:news

# Generate with custom limit
npm run embed:news "" 500

# Generate for specific item
npm run embed:news <clean-item-id>
```

### Vector Search

```bash
# Search news semantically
curl "http://localhost:3000/api/ai/news/search?q=Federal+Reserve+interest+rates&limit=5" \
  -H "Authorization: Bearer <token>"
```

## API Endpoint

### GET /api/ai/news/search

**Query Parameters:**
- `q` (required): Search query string
- `limit` (optional): Max results (1-50, default: 10)
- `threshold` (optional): Minimum similarity (0-1, default: 0.7)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "Federal Reserve interest rates",
    "results": [
      {
        "id": "uuid",
        "title": "Federal Reserve Signals Rate Cuts",
        "content": "...",
        "url": "https://...",
        "source": "Reuters Finance",
        "publishedAt": "2024-01-15T10:30:00Z",
        "markets": ["US"],
        "tickers": ["SPY"],
        "similarity": 0.89
      }
    ],
    "count": 5
  }
}
```

## Similarity Calculation

Uses **cosine similarity** via pgvector:
- Distance operator: `<=>` (cosine distance)
- Similarity: `1 - distance` (higher = more similar)
- Range: 0.0 to 1.0

## Vector Index

The migration creates an **ivfflat** index for fast approximate search:
```sql
CREATE INDEX news_embeddings_embedding_vector_idx 
ON news_embeddings 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);
```

**Note**: ivfflat requires data to exist. The index is created in the migration but may need tuning based on data volume.

## Deduplication

Embeddings are not regenerated if:
- Embedding exists for the same `clean_id` and `model`
- Vector column is already populated

This ensures idempotency and avoids unnecessary API calls.

## Performance

- **Generation**: ~0.5-1 second per item (OpenAI API)
- **Storage**: Fast (indexed lookups)
- **Search**: ~10-50ms for 1000 items (with index)

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
EMBEDDING_MODEL=text-embedding-3-small  # Default
```

## Troubleshooting

### Embeddings not generating

1. Check OpenAI API key:
   ```bash
   echo $OPENAI_API_KEY
   ```

2. Check API quota/limits
3. Check database connection
4. Check logs for specific errors

### Vector search returns no results

1. Verify embeddings exist:
   ```sql
   SELECT COUNT(*) FROM news_embeddings WHERE embedding_vector IS NOT NULL;
   ```

2. Check threshold (try lower value):
   ```bash
   curl "...?q=query&threshold=0.5"
   ```

3. Verify pgvector extension:
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'vector';
   ```

### Vector column not populated

After generating embeddings, convert JSON to vector:
```sql
UPDATE news_embeddings
SET embedding_vector = (
    SELECT array_agg(value::float)::vector(1536)
    FROM jsonb_array_elements_text(embedding) AS value
)
WHERE embedding_vector IS NULL
  AND embedding IS NOT NULL;
```

## Integration with AI Analysis

Embeddings can be linked to AI analysis:
- `analysisId` field in `news_embeddings`
- Allows searching by analyzed content
- Can use analysis summary for embedding (future enhancement)

## Future Enhancements

- [ ] Batch embedding generation (OpenAI supports up to 2048 inputs)
- [ ] Use analysis summary for embedding (if available)
- [ ] HNSW index for better quality (if pgvector supports)
- [ ] Hybrid search (vector + keyword)
- [ ] Filtering by markets/tickers in search
