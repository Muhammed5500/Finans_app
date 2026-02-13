# =============================================================================
# Test Portfolio API (PowerShell)
# Run: .\scripts\test-portfolio.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing Portfolio API" -ForegroundColor Cyan
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
# ACCOUNTS
# =============================================================================
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host "📁 ACCOUNTS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# List accounts
Write-Host "`n1️⃣  GET /api/accounts" -ForegroundColor Yellow
$accounts = Invoke-RestMethod -Uri "$BaseUrl/api/accounts" -WebSession $Session
Write-Host "   Found $($accounts.data.Count) accounts"
$accounts.data | ForEach-Object { Write-Host "   - $($_.name) ($($_.type))" }

# Create account
Write-Host "`n2️⃣  POST /api/accounts (create test account)" -ForegroundColor Yellow
$newAccount = @{
    name = "Test Account $(Get-Date -Format 'HHmmss')"
    type = "brokerage"
    currency = "USD"
} | ConvertTo-Json

try {
    $created = Invoke-RestMethod -Uri "$BaseUrl/api/accounts" -Method Post `
        -Body $newAccount -ContentType "application/json" -WebSession $Session
    $testAccountId = $created.data.id
    Write-Host "   ✅ Created: $($created.data.name) (ID: $testAccountId)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Update account
if ($testAccountId) {
    Write-Host "`n3️⃣  PATCH /api/accounts/$testAccountId" -ForegroundColor Yellow
    $updateBody = @{ notes = "Updated via test script" } | ConvertTo-Json
    try {
        $updated = Invoke-RestMethod -Uri "$BaseUrl/api/accounts/$testAccountId" -Method Patch `
            -Body $updateBody -ContentType "application/json" -WebSession $Session
        Write-Host "   ✅ Updated: notes = '$($updated.data.notes)'"
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }

    # Delete account
    Write-Host "`n4️⃣  DELETE /api/accounts/$testAccountId" -ForegroundColor Yellow
    try {
        $null = Invoke-WebRequest -Uri "$BaseUrl/api/accounts/$testAccountId" -Method Delete -WebSession $Session
        Write-Host "   ✅ Deleted"
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

# =============================================================================
# ASSETS
# =============================================================================
Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "📊 ASSETS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# List assets
Write-Host "`n1️⃣  GET /api/assets" -ForegroundColor Yellow
$assets = Invoke-RestMethod -Uri "$BaseUrl/api/assets" -WebSession $Session
Write-Host "   Found $($assets.data.pagination.total) assets"

# Filter by type
Write-Host "`n2️⃣  GET /api/assets?type=crypto" -ForegroundColor Yellow
$cryptoAssets = Invoke-RestMethod -Uri "$BaseUrl/api/assets?type=crypto" -WebSession $Session
Write-Host "   Found $($cryptoAssets.data.items.Count) crypto assets"
$cryptoAssets.data.items | ForEach-Object { Write-Host "   - $($_.symbol): $($_.name)" }

# Search
Write-Host "`n3️⃣  GET /api/assets?query=apple" -ForegroundColor Yellow
$searchResults = Invoke-RestMethod -Uri "$BaseUrl/api/assets?query=apple" -WebSession $Session
Write-Host "   Found $($searchResults.data.items.Count) results"
$searchResults.data.items | ForEach-Object { Write-Host "   - $($_.symbol): $($_.name)" }

# Get single asset
if ($assets.data.items.Count -gt 0) {
    $assetId = $assets.data.items[0].id
    Write-Host "`n4️⃣  GET /api/assets/$assetId" -ForegroundColor Yellow
    $asset = Invoke-RestMethod -Uri "$BaseUrl/api/assets/$assetId" -WebSession $Session
    Write-Host "   $($asset.data.symbol): $($asset.data.name)"
    Write-Host "   Trade count: $($asset.data.tradeCount)"
}

# =============================================================================
# TRADES
# =============================================================================
Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "💹 TRADES" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# List trades
Write-Host "`n1️⃣  GET /api/trades" -ForegroundColor Yellow
$trades = Invoke-RestMethod -Uri "$BaseUrl/api/trades" -WebSession $Session
Write-Host "   Found $($trades.data.pagination.total) trades"

# Show recent trades
Write-Host "`n   Recent trades:" -ForegroundColor Gray
$trades.data.items | Select-Object -First 5 | ForEach-Object {
    Write-Host "   - $($_.type.ToUpper()) $($_.quantity) $($_.asset.symbol) @ `$$($_.price)"
}

# Filter by type
Write-Host "`n2️⃣  GET /api/trades?type=buy" -ForegroundColor Yellow
$buyTrades = Invoke-RestMethod -Uri "$BaseUrl/api/trades?type=buy" -WebSession $Session
Write-Host "   Found $($buyTrades.data.items.Count) buy trades"

# Create a test trade (if we have accounts and assets)
$accounts = Invoke-RestMethod -Uri "$BaseUrl/api/accounts" -WebSession $Session
$assets = Invoke-RestMethod -Uri "$BaseUrl/api/assets?type=stock&limit=1" -WebSession $Session

if ($accounts.data.Count -gt 0 -and $assets.data.items.Count -gt 0) {
    $accountId = $accounts.data[0].id
    $assetId = $assets.data.items[0].id
    
    Write-Host "`n3️⃣  POST /api/trades (create test trade)" -ForegroundColor Yellow
    $newTrade = @{
        accountId = $accountId
        assetId = $assetId
        type = "buy"
        quantity = 1
        price = 100.00
        fees = 0.50
        currency = "USD"
        executedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        notes = "Test trade from script"
    } | ConvertTo-Json
    
    try {
        $createdTrade = Invoke-RestMethod -Uri "$BaseUrl/api/trades" -Method Post `
            -Body $newTrade -ContentType "application/json" -WebSession $Session
        $testTradeId = $createdTrade.data.id
        Write-Host "   ✅ Created trade: $($createdTrade.data.type) $($createdTrade.data.quantity) $($createdTrade.data.asset.symbol)"
        Write-Host "   Total: `$$($createdTrade.data.total)"
        
        # Delete test trade
        Write-Host "`n4️⃣  DELETE /api/trades/$testTradeId" -ForegroundColor Yellow
        $null = Invoke-WebRequest -Uri "$BaseUrl/api/trades/$testTradeId" -Method Delete -WebSession $Session
        Write-Host "   ✅ Deleted test trade"
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "✅ Tests complete!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Gray





