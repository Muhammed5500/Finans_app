# Background Jobs Runner - Implementation Summary

## ✅ Implementation Complete

A simple background job runner has been implemented for periodic tasks. No external queue system required.

## Files Created

### Job Runner

1. **`scripts/jobs-tick.ts`**
   - Runs all jobs sequentially
   - Sensible limits per job
   - Error handling and logging
   - Summary output

### Documentation

2. **`docs/BACKGROUND_JOBS.md`**
   - Complete cron setup guide
   - Monitoring instructions
   - Troubleshooting guide

3. **`README.md`** (Updated)
   - Cron setup examples
   - systemd timer examples
   - Docker examples

## Jobs

### 1. Ingest RSS

- Fetches RSS feeds from all enabled sources
- No limit (processes all sources)
- Rate limiting and timeout handling

### 2. Clean News

- Converts raw news items to cleaned format
- **Limit**: 50 items per run

### 3. Embed News

- Generates embeddings for cleaned items
- **Limit**: 20 items per run (OpenAI API)

### 4. Analyze News

- AI analysis of cleaned items
- **Limit**: 10 items per run (OpenAI API)

### 5. Recompute Profile + Insights

- Recomputes investor profile for seed user
- Recomputes portfolio insights for seed user
- Finds user by email containing "demo"/"seed" or first user

## Usage

### Run Once

```bash
npm run jobs:tick
```

### Makefile

```bash
make jobs-tick
```

## Cron Setup

### Linux/macOS

```cron
# Every 15 minutes
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick >> /var/log/finans-jobs.log 2>&1

# Every hour
0 * * * * cd /path/to/finans-app && npm run jobs:tick >> /var/log/finans-jobs.log 2>&1
```

### systemd Timer

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

### Windows Task Scheduler

1. Create Basic Task
2. Set trigger (e.g., every 15 minutes)
3. Action: Start a program
   - Program: `npm`
   - Arguments: `run jobs:tick`
   - Start in: `/path/to/finans-app`

## Job Limits

Configurable in `scripts/jobs-tick.ts`:

```typescript
const JOB_LIMITS = {
  cleanNews: 50,
  embedNews: 20,
  analyzeNews: 10,
};
```

## Output

### Success Example

```
🚀 BACKGROUND JOB RUNNER
============================================================
Started at: 2024-01-15T10:00:00.000Z

============================================================
🔄 Starting job: ingest-rss
============================================================
...
✅ Job completed: ingest-rss (5234ms)

============================================================
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
============================================================
```

### With Errors

```
📊 JOB RUN SUMMARY
============================================================
Total duration: 35230ms
Successful jobs: 4/5
Failed jobs: 1/5

Failed jobs:
  - analyze-news: OpenAI API rate limit exceeded

Job details:
  ✅ ingest-rss: 5234ms
  ✅ clean-news: 1234ms
  ✅ embed-news: 15234ms
  ❌ analyze-news: 18234ms
  ✅ recompute-profile-insights: 5294ms
============================================================
```

## Error Handling

- Individual job failures don't stop the runner
- Failed jobs are logged with error messages
- Exit code 1 if any job fails
- Partial success is acceptable

## Exit Codes

- `0`: All jobs succeeded
- `1`: One or more jobs failed

## Monitoring

### Logs

Redirect output to log file:
```cron
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick >> /var/log/finans-jobs.log 2>&1
```

### systemd Journal

```bash
journalctl -u finans-jobs.service -f
```

## Recommended Schedule

### Development

Every 15 minutes:
```cron
*/15 * * * * cd /path/to/finans-app && npm run jobs:tick
```

### Production

Every hour:
```cron
0 * * * * cd /path/to/finans-app && npm run jobs:tick
```

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key

Optional:
- `NODE_ENV`: Environment (development/production)
- `LOG_OPENAI`: Enable OpenAI request logging

## Troubleshooting

### Jobs Not Running

1. Check cron service: `systemctl status cron`
2. Verify cron entry: `crontab -l`
3. Check logs: `tail -f /var/log/finans-jobs.log`

### Jobs Failing

1. Check database: `npm run db:studio`
2. Verify API key: `echo $OPENAI_API_KEY`
3. Test manually: `npm run ingest:rss`

## Manual Execution

Run individual jobs:

```bash
npm run ingest:rss
npm run clean:news "" 50
npm run embed:news "" 20
npm run ai:analyze-news -- --limit=10
```

## Integration

The job runner integrates with:

- **RSS Fetcher**: Ingests news from RSS feeds
- **News Cleaner**: Cleans raw news items
- **Embeddings**: Generates vector embeddings
- **News Analysis**: AI analysis of news
- **Investor Profile**: Profile inference
- **Portfolio Insights**: Insight generation

## Next Steps

1. **Set up cron**: Configure periodic execution
2. **Monitor logs**: Track job success/failure rates
3. **Adjust limits**: Tune based on API usage
4. **Alerting**: Set up alerts for job failures

## Documentation

See `docs/BACKGROUND_JOBS.md` for:
- Complete cron setup guide
- systemd timer configuration
- Docker examples
- Troubleshooting guide

The Background Jobs Runner is ready for production use! 🚀
