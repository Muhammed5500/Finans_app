# =============================================================================
# Test Watchlists & Markets API (PowerShell)
# Run: .\scripts\test-watchlists.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing Watchlists & Markets API" -ForegroundColor Cyan
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
# WATCHLISTS
# =============================================================================
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host "📋 WATCHLISTS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# List watchlists
Write-Host "`n1️⃣  GET /api/watchlists" -ForegroundColor Yellow
$watchlists = Invoke-RestMethod -Uri "$BaseUrl/api/watchlists" -WebSession $Session
Write-Host "   Found $($watchlists.data.Count) watchlists"
$watchlists.data | ForEach-Object { Write-Host "   - $($_.name) ($($_.itemCount) items)" }

# Get first watchlist ID for further tests
$watchlistId = $watchlists.data[0].id
Write-Host "`n   Using watchlist: $($watchlists.data[0].name)" -ForegroundColor Gray

# Get watchlist items
Write-Host "`n2️⃣  GET /api/watchlists/$watchlistId/items" -ForegroundColor Yellow
$items = Invoke-RestMethod -Uri "$BaseUrl/api/watchlists/$watchlistId/items" -WebSession $Session
Write-Host "   Found $($items.data.items.Count) items in watchlist"
$items.data.items | Select-Object -First 5 | ForEach-Object {
    Write-Host "   - $($_.asset.symbol): $($_.asset.name)"
}

# Create new watchlist
Write-Host "`n3️⃣  POST /api/watchlists (create test)" -ForegroundColor Yellow
$newWatchlist = @{
    name = "Test Watchlist $(Get-Date -Format 'HHmmss')"
    description = "Created by test script"
} | ConvertTo-Json

try {
    $created = Invoke-RestMethod -Uri "$BaseUrl/api/watchlists" -Method Post `
        -Body $newWatchlist -ContentType "application/json" -WebSession $Session
    $testWatchlistId = $created.data.id
    Write-Host "   ✅ Created: $($created.data.name)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Add item to new watchlist
if ($testWatchlistId) {
    Write-Host "`n4️⃣  POST /api/watchlists/$testWatchlistId/items (add NVDA)" -ForegroundColor Yellow
    
    # Find NVDA asset
    $assets = Invoke-RestMethod -Uri "$BaseUrl/api/assets?query=NVDA" -WebSession $Session
    if ($assets.data.items.Count -gt 0) {
        $assetId = $assets.data.items[0].id
        $addItem = @{ assetId = $assetId } | ConvertTo-Json
        
        try {
            $addedItem = Invoke-RestMethod -Uri "$BaseUrl/api/watchlists/$testWatchlistId/items" -Method Post `
                -Body $addItem -ContentType "application/json" -WebSession $Session
            $testItemId = $addedItem.data.id
            Write-Host "   ✅ Added: $($addedItem.data.asset.symbol)"
        } catch {
            Write-Host "   ❌ Failed: $_" -ForegroundColor Red
        }
    }

    # Delete item
    if ($testItemId) {
        Write-Host "`n5️⃣  DELETE /api/watchlists/$testWatchlistId/items/$testItemId" -ForegroundColor Yellow
        try {
            $null = Invoke-WebRequest -Uri "$BaseUrl/api/watchlists/$testWatchlistId/items/$testItemId" -Method Delete -WebSession $Session
            Write-Host "   ✅ Removed item"
        } catch {
            Write-Host "   ❌ Failed: $_" -ForegroundColor Red
        }
    }

    # Delete watchlist
    Write-Host "`n6️⃣  DELETE /api/watchlists/$testWatchlistId" -ForegroundColor Yellow
    try {
        $null = Invoke-WebRequest -Uri "$BaseUrl/api/watchlists/$testWatchlistId" -Method Delete -WebSession $Session
        Write-Host "   ✅ Deleted watchlist"
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

# =============================================================================
# MARKETS
# =============================================================================
Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "📊 MARKETS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# Get market data for watchlist
Write-Host "`n1️⃣  GET /api/markets/watchlist/$watchlistId" -ForegroundColor Yellow
try {
    $marketData = Invoke-RestMethod -Uri "$BaseUrl/api/markets/watchlist/$watchlistId" -WebSession $Session
    Write-Host "   Watchlist: $($marketData.data.watchlist.name)"
    Write-Host "   Items with prices:"
    $marketData.data.items | Where-Object { $_.price } | Select-Object -First 5 | ForEach-Object {
        $changeStr = if ($_.change) { 
            $sign = if ($_.change.percent -ge 0) { "+" } else { "" }
            "$sign$($_.change.percent)%"
        } else { "N/A" }
        Write-Host "   - $($_.asset.symbol): `$$($_.price.value) ($changeStr)"
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Get quotes by symbol
Write-Host "`n2️⃣  GET /api/markets/quotes?symbols=AAPL,BTC,ETH" -ForegroundColor Yellow
try {
    $quotes = Invoke-RestMethod -Uri "$BaseUrl/api/markets/quotes?symbols=AAPL,BTC,ETH" -WebSession $Session
    Write-Host "   Found $($quotes.data.quotes.Count) quotes:"
    $quotes.data.quotes | ForEach-Object {
        $priceStr = if ($_.price) { "`$$($_.price)" } else { "No price" }
        $changeStr = if ($_.change) { 
            $sign = if ($_.change.percent -ge 0) { "+" } else { "" }
            "$sign$($_.change.percent)%"
        } else { "N/A" }
        Write-Host "   - $($_.symbol): $priceStr ($changeStr)"
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "✅ Tests complete!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Gray





