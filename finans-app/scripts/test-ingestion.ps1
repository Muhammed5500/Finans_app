# =============================================================================
# Test Price Ingestion API (PowerShell)
# Run: .\scripts\test-ingestion.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing Price Ingestion API" -ForegroundColor Cyan
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
# CRYPTO PRICE INGESTION
# =============================================================================
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "📈 CRYPTO PRICE INGESTION" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Test 1: Ingest specific symbols
Write-Host "`n1️⃣  POST /api/admin/ingest/crypto-prices (specific symbols)" -ForegroundColor Yellow
$body = @{ symbols = @("BTC", "ETH", "SOL", "DOGE") } | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/ingest/crypto-prices" -Method Post `
        -Body $body -ContentType "application/json" -WebSession $Session
    
    Write-Host "   Provider: $($result.data.provider)" -ForegroundColor Gray
    Write-Host "   Stats:"
    Write-Host "   - Requested: $($result.data.stats.requested)"
    Write-Host "   - Inserted: $($result.data.stats.inserted)" -ForegroundColor Green
    Write-Host "   - Skipped: $($result.data.stats.skipped)" -ForegroundColor Yellow
    Write-Host "   - Errors: $($result.data.stats.errors)" -ForegroundColor $(if ($result.data.stats.errors -gt 0) { "Red" } else { "Gray" })
    Write-Host "   Duration: $($result.data.durationMs)ms"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 2: Verify prices via markets API
Write-Host "`n2️⃣  Verifying prices via /api/markets/quotes" -ForegroundColor Yellow
try {
    $quotes = Invoke-RestMethod -Uri "$BaseUrl/api/markets/quotes?symbols=BTC,ETH,SOL,DOGE" -WebSession $Session
    
    Write-Host "   Found $($quotes.data.quotes.Count) quotes:"
    $quotes.data.quotes | ForEach-Object {
        if ($_.price) {
            $priceStr = if ($_.price -lt 1) { $_.price.ToString("N6") } else { $_.price.ToString("N2") }
            Write-Host "   - $($_.symbol): `$$priceStr" -ForegroundColor Green
        } else {
            Write-Host "   - $($_.symbol): No price" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 3: Ingest from watchlists
Write-Host "`n3️⃣  POST /api/admin/ingest/crypto-prices (from watchlists)" -ForegroundColor Yellow
$body = @{ fromWatchlists = $true } | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/ingest/crypto-prices" -Method Post `
        -Body $body -ContentType "application/json" -WebSession $Session
    
    Write-Host "   Symbols from watchlists: $($result.data.symbols.Count)"
    if ($result.data.symbols.Count -gt 0) {
        Write-Host "   - $($result.data.symbols -join ', ')"
    }
    Write-Host "   Inserted: $($result.data.stats.inserted)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 4: Ingest all crypto assets
Write-Host "`n4️⃣  POST /api/admin/ingest/crypto-prices (all crypto assets)" -ForegroundColor Yellow
$body = @{} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/ingest/crypto-prices" -Method Post `
        -Body $body -ContentType "application/json" -WebSession $Session
    
    Write-Host "   Total crypto assets: $($result.data.stats.requested)"
    Write-Host "   Inserted: $($result.data.stats.inserted)"
    Write-Host "   Skipped: $($result.data.stats.skipped)"
    Write-Host "   Duration: $($result.data.durationMs)ms"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 5: Check portfolio with updated prices
Write-Host "`n5️⃣  Checking portfolio with updated prices" -ForegroundColor Yellow
try {
    $portfolio = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio/summary" -WebSession $Session
    
    Write-Host "   Portfolio Summary:"
    if ($portfolio.data.totalValue) {
        Write-Host "   - Total Value: `$$($portfolio.data.totalValue.ToString('N2'))" -ForegroundColor Green
    }
    if ($portfolio.data.unrealizedPnl) {
        $pnlColor = if ($portfolio.data.unrealizedPnl -ge 0) { "Green" } else { "Red" }
        Write-Host "   - Unrealized P&L: `$$($portfolio.data.unrealizedPnl.ToString('N2'))" -ForegroundColor $pnlColor
    }
    Write-Host "   - Positions: $($portfolio.data.positionCount)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "✅ Ingestion tests complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Run ingestion periodically to keep prices updated"
Write-Host "   - CoinGecko free tier: 10-30 requests/minute"
Write-Host "   - Prices are de-duplicated by asset + minute`n"





