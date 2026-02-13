# =============================================================================
# Test News API (PowerShell)
# Run: .\scripts\test-news.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing News API" -ForegroundColor Cyan
Write-Host "   Base URL: $BaseUrl`n"

# Login first
Write-Host "🔐 Logging in..." -ForegroundColor Yellow
$loginBody = @{ email = "admin@finans.local"; password = "changeme123" } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -Body $loginBody -ContentType "application/json" -WebSession $Session
    Write-Host "   ✅ Logged in`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

# =============================================================================
# RSS SOURCES
# =============================================================================
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "📰 RSS SOURCES" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# List existing sources
Write-Host "`n1️⃣  GET /api/news/sources" -ForegroundColor Yellow
try {
    $sources = Invoke-RestMethod -Uri "$BaseUrl/api/news/sources" -WebSession $Session
    Write-Host "   Found $($sources.data.Count) sources"
    $sources.data | ForEach-Object {
        $status = if ($_.isActive) { "✓" } else { "○" }
        Write-Host "   $status $($_.name) - $($_.itemCount) items"
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Create test source (Hacker News - reliable public RSS)
Write-Host "`n2️⃣  POST /api/news/sources (create test)" -ForegroundColor Yellow
$newSource = @{
    name = "Test - Hacker News"
    url = "https://hnrss.org/frontpage"
    description = "Test RSS source"
    tags = @("tech", "test")
} | ConvertTo-Json

$testSourceId = $null
try {
    $created = Invoke-RestMethod -Uri "$BaseUrl/api/news/sources" -Method Post `
        -Body $newSource -ContentType "application/json" -WebSession $Session
    $testSourceId = $created.data.id
    Write-Host "   ✅ Created: $($created.data.name)" -ForegroundColor Green
    Write-Host "   ID: $testSourceId" -ForegroundColor Gray
} catch {
    $errorMessage = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorMessage.error -match "duplicate") {
        Write-Host "   ⚠️  Source already exists" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

# =============================================================================
# RSS INGESTION
# =============================================================================
Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "📥 RSS INGESTION" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n3️⃣  POST /api/admin/ingest/rss" -ForegroundColor Yellow
try {
    $ingestion = Invoke-RestMethod -Uri "$BaseUrl/api/admin/ingest/rss" -Method Post `
        -Body "{}" -ContentType "application/json" -WebSession $Session
    
    Write-Host "   Sources processed: $($ingestion.data.totals.sourcesProcessed)"
    Write-Host "   Items fetched: $($ingestion.data.totals.itemsFetched)"
    Write-Host "   Items inserted: $($ingestion.data.totals.itemsInserted)" -ForegroundColor Green
    Write-Host "   Items skipped: $($ingestion.data.totals.itemsSkipped)" -ForegroundColor Yellow
    Write-Host "   Duration: $($ingestion.data.durationMs)ms"
    
    if ($ingestion.data.totals.sourcesFailed -gt 0) {
        Write-Host "   ⚠️  $($ingestion.data.totals.sourcesFailed) sources failed" -ForegroundColor Red
        $ingestion.data.sources | Where-Object { -not $_.success } | ForEach-Object {
            Write-Host "   - $($_.name): $($_.error)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# =============================================================================
# NEWS FEED
# =============================================================================
Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "📋 NEWS FEED" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Get all news
Write-Host "`n4️⃣  GET /api/news/feed" -ForegroundColor Yellow
$testItemId = $null
try {
    $feed = Invoke-RestMethod -Uri "$BaseUrl/api/news/feed?limit=10" -WebSession $Session
    
    Write-Host "   Total items: $($feed.data.meta.total)"
    Write-Host "   Showing: $($feed.data.items.Count)"
    
    if ($feed.data.items.Count -gt 0) {
        $testItemId = $feed.data.items[0].id
        Write-Host "`n   Latest headlines:"
        $feed.data.items | Select-Object -First 5 | ForEach-Object {
            $readStatus = if ($_.isRead) { "[READ]" } else { "[NEW]" }
            $title = if ($_.title.Length -gt 50) { $_.title.Substring(0, 47) + "..." } else { $_.title }
            Write-Host "   $readStatus $($_.source.name): $title" -ForegroundColor $(if ($_.isRead) { "Gray" } else { "White" })
        }
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Filter by tag
Write-Host "`n5️⃣  GET /api/news/feed?tag=tech" -ForegroundColor Yellow
try {
    $techFeed = Invoke-RestMethod -Uri "$BaseUrl/api/news/feed?tag=tech&limit=5" -WebSession $Session
    Write-Host "   Tech news items: $($techFeed.data.meta.total)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# =============================================================================
# READ/UNREAD
# =============================================================================
if ($testItemId) {
    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "✓ READ/UNREAD" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    # Mark as read
    Write-Host "`n6️⃣  POST /api/news/$testItemId/read" -ForegroundColor Yellow
    try {
        $readResult = Invoke-RestMethod -Uri "$BaseUrl/api/news/$testItemId/read" -Method Post -WebSession $Session
        Write-Host "   ✅ Marked as read at: $($readResult.data.readAt)" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }

    # Get unread only
    Write-Host "`n7️⃣  GET /api/news/feed?unreadOnly=true" -ForegroundColor Yellow
    try {
        $unreadFeed = Invoke-RestMethod -Uri "$BaseUrl/api/news/feed?unreadOnly=true&limit=5" -WebSession $Session
        Write-Host "   Unread items: $($unreadFeed.data.meta.total)"
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }

    # Mark as unread
    Write-Host "`n8️⃣  POST /api/news/$testItemId/unread" -ForegroundColor Yellow
    try {
        $unreadResult = Invoke-RestMethod -Uri "$BaseUrl/api/news/$testItemId/unread" -Method Post -WebSession $Session
        Write-Host "   ✅ Marked as unread" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

# =============================================================================
# CLEANUP
# =============================================================================
if ($testSourceId) {
    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "🧹 CLEANUP" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    Write-Host "`n9️⃣  DELETE /api/news/sources/$testSourceId" -ForegroundColor Yellow
    try {
        $null = Invoke-WebRequest -Uri "$BaseUrl/api/news/sources/$testSourceId" -Method Delete -WebSession $Session
        Write-Host "   ✅ Deleted test source" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Could not delete test source (may have been deleted manually)" -ForegroundColor Yellow
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "✅ News API tests complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Add RSS sources for your preferred news sites"
Write-Host "   - Run ingestion periodically to fetch new articles"
Write-Host "   - Use tags to organize sources by topic`n"





