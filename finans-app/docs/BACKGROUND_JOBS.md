# Background Jobs

## Overview

Simple background job runner for periodic tasks. No external queue system required - designed to be run via cron or similar schedulers.

## Command

```bash
npm run jobs:tick
```

Runs all jobs sequentially and exits.

## Jobs

### 1. Ingest RSS

- Fetches RSS feeds from all enabled sources
- Stores raw news items
- Handles deduplication and rate limiting
- No limit (processes all enabled sources)

### 2. Clean News

- Converts raw news items to cleaned format
- Extracts tickers and markets
- **Limit**: 50 items per run

### 3. Embed News

- Generates embeddings for cleaned news items
- Uses OpenAI API
- **Limit**: 20 items per run (API rate limits)

### 4. Analyze News

- AI analysis of cleaned news items
- Uses OpenAI API
- **Limit**: 10 items per run (API rate limits)

### 5. Recompute Profile + Insights

- Recomputes investor profile for seed user
- Recomputes portfolio insights for seed user
- Finds user by email containing "demo" or "seed", or first user

## Job Limits

Limits are configured in `scripts/jobs-tick.ts`:

```typescript
const JOB_LIMITS = {
  cleanNews: 50,
  embedNews: 20,
  analyzeNews: 10,
};
```

Adjust based on:
- API rate limits
- Processing time
- Database load

## Cron Setup

### Linux/macOS

Edit crontab:
```bash
crontab -e
```

Add entry (every 15 minutes):
```cron
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick >> /var/log/finans-jobs.log 2>&1
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., every 15 minutes)
4. Action: Start a program
   - Program: `npm`
   - Arguments: `run jobs:tick`
   - Start in: `/path/to/finans-app`

### systemd Timer (Linux)

**Service** (`/etc/systemd/system/finans-jobs.service`):
```ini
[Unit]
Description=Finans Background Jobs
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/finans-app
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run jobs:tick
StandardOutput=journal
StandardError=journal
```

**Timer** (`/etc/systemd/system/finans-jobs.timer`):
```ini
[Unit]
Description=Run Finans Jobs Every 15 Minutes
Requires=finans-jobs.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable finans-jobs.timer
sudo systemctl start finans-jobs.timer
```

### Docker/Container

Run in a loop:
```yaml
services:
  jobs:
    build: .
    command: sh -c "while true; do npm run jobs:tick; sleep 900; done"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

Or use a cron container:
```yaml
services:
  jobs:
    image: node:20
    volumes:
      - .:/app
    command: sh -c "echo '*/15 * * * * cd /app && npm run jobs:tick' | crontab - && crond -f"
```

## Recommended Schedule

### High Frequency (Development)

Every 15 minutes:
```cron
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick
```

### Production

Every hour:
```cron
0 * * * * cd /path/to/finans-app && npm run jobs:tick
```

Or every 30 minutes:
```cron
*/30 * * * * cd /path/to/finans-app && npm run jobs:tick
```

## Monitoring

### Logs

Jobs output to stdout/stderr. Redirect to log file:

```cron
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick >> /var/log/finans-jobs.log 2>&1
```

### Exit Codes

- `0`: All jobs succeeded
- `1`: One or more jobs failed

### Job Summary

Each run outputs a summary:

```
📊 JOB RUN SUMMARY
============================================================
Total duration: 45230ms
Successful jobs: 5/5
Failed jobs: 0/5

Job details:
  ✅ ingest-rss: 5234ms
  ✅ clean-news: 1234ms
  ✅ embed-news: 15234ms
  ✅ analyze-news: 18234ms
  ✅ recompute-profile-insights: 5294ms
```

## Error Handling

- Individual job failures don't stop the runner
- Failed jobs are logged with error messages
- Exit code 1 if any job fails
- Partial success is acceptable (some jobs may fail)

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key (for embedding/analysis jobs)

Optional:
- `NODE_ENV`: Environment (development/production)
- `LOG_OPENAI`: Enable OpenAI request logging

## Troubleshooting

### Jobs Not Running

1. Check cron service is running:
   ```bash
   systemctl status cron  # Linux
   ```

2. Verify cron entry syntax:
   ```bash
   crontab -l
   ```

3. Check log file for errors:
   ```bash
   tail -f /var/log/finans-jobs.log
   ```

### Jobs Failing

1. Check database connection:
   ```bash
   npm run db:studio
   ```

2. Verify OpenAI API key:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. Check individual job manually:
   ```bash
   npm run ingest:rss
   ```

### High API Usage

Reduce limits in `scripts/jobs-tick.ts`:
- Lower `embedNews` limit (default: 20)
- Lower `analyzeNews` limit (default: 10)
- Run less frequently

## Manual Execution

Run individual jobs:

```bash
# Ingest RSS
npm run ingest:rss

# Clean news
npm run clean:news "" 50

# Embed news
npm run embed:news "" 20

# Analyze news
npm run ai:analyze-news -- --limit=10
```

## See Also

- `scripts/jobs-tick.ts` - Job runner implementation
- `README.md` - Cron setup examples
- `docs/NEWS_PIPELINE.md` - News ingestion pipeline
- `docs/NEWS_AI_ANALYSIS.md` - News analysis docs
