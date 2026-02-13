# =============================================================================
# Test FX Rates API (PowerShell)
# Run: .\scripts\test-fx.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing FX Rates API" -ForegroundColor Cyan
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
# FX RATES INGESTION
# =============================================================================
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "💱 FX RATES INGESTION" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n1️⃣  POST /api/admin/ingest/fx" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/ingest/fx" -Method Post `
        -ContentType "application/json" -WebSession $Session
    
    Write-Host "   Source: $($result.data.source)" -ForegroundColor Gray
    Write-Host "   Rates fetched:"
    $result.data.rates | ForEach-Object {
        Write-Host "   - $($_.pair): $($_.rate)" -ForegroundColor Green
    }
    Write-Host "   Stats: $($result.data.stats.inserted) inserted, $($result.data.stats.updated) updated"
    Write-Host "   Duration: $($result.data.durationMs)ms"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    Write-Host "   Note: FX API might be unavailable. Continuing with tests..." -ForegroundColor Yellow
}

# =============================================================================
# PORTFOLIO WITH BASE CURRENCY
# =============================================================================
Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "📊 PORTFOLIO WITH BASE CURRENCY CONVERSION" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Test without base currency
Write-Host "`n2️⃣  GET /api/portfolio/summary (no conversion)" -ForegroundColor Yellow
try {
    $summary = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio/summary" -WebSession $Session
    
    Write-Host "   Total Cost Basis: $($summary.data.totalCostBasis)" -ForegroundColor Gray
    if ($null -ne $summary.data.totalValue) {
        Write-Host "   Total Value: $($summary.data.totalValue)" -ForegroundColor Green
    } else {
        Write-Host "   Total Value: (missing prices)" -ForegroundColor Yellow
    }
    Write-Host "   Positions: $($summary.data.positionCount)"
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test with TRY base currency
Write-Host "`n3️⃣  GET /api/portfolio/summary?baseCurrency=TRY" -ForegroundColor Yellow
try {
    $summaryTRY = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio/summary?baseCurrency=TRY" -WebSession $Session
    
    Write-Host "   Base Currency: $($summaryTRY.data.baseCurrency)" -ForegroundColor Cyan
    Write-Host "   Total Cost Basis: ₺$($summaryTRY.data.totalCostBasis.ToString('N2'))" -ForegroundColor Gray
    
    if ($null -ne $summaryTRY.data.totalValue) {
        Write-Host "   Total Value: ₺$($summaryTRY.data.totalValue.ToString('N2'))" -ForegroundColor Green
        
        if ($null -ne $summaryTRY.data.unrealizedGain) {
            $pnlColor = if ($summaryTRY.data.unrealizedGain -ge 0) { "Green" } else { "Red" }
            Write-Host "   Unrealized P&L: ₺$($summaryTRY.data.unrealizedGain.ToString('N2')) ($($summaryTRY.data.unrealizedGainPercent.ToString('N2'))%)" -ForegroundColor $pnlColor
        }
    } else {
        Write-Host "   Total Value: (missing prices or FX rates)" -ForegroundColor Yellow
    }
    
    if ($summaryTRY.data.fxMissing -and $summaryTRY.data.fxMissing.Count -gt 0) {
        Write-Host "   ⚠️  FX Missing: $($summaryTRY.data.fxMissing -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test positions with TRY
Write-Host "`n4️⃣  GET /api/portfolio/positions?baseCurrency=TRY" -ForegroundColor Yellow
try {
    $positionsTRY = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio/positions?baseCurrency=TRY" -WebSession $Session
    
    Write-Host "   Positions (in TRY):"
    $positionsTRY.data.positions | Select-Object -First 5 | ForEach-Object {
        $symbol = $_.asset.symbol
        $originalCurrency = $_.asset.currency
        $costBasis = "₺$($_.costBasis.ToString('N2'))"
        $value = if ($null -ne $_.currentValue) { "₺$($_.currentValue.ToString('N2'))" } else { "N/A" }
        Write-Host "   - $symbol ($originalCurrency): Cost=$costBasis, Value=$value" -ForegroundColor Gray
    }
    
    if ($positionsTRY.data.meta.fxMissing -and $positionsTRY.data.meta.fxMissing.Count -gt 0) {
        Write-Host "   ⚠️  FX Missing for: $($positionsTRY.data.meta.fxMissing -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test with USD base currency
Write-Host "`n5️⃣  GET /api/portfolio/summary?baseCurrency=USD" -ForegroundColor Yellow
try {
    $summaryUSD = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio/summary?baseCurrency=USD" -WebSession $Session
    
    Write-Host "   Base Currency: $($summaryUSD.data.baseCurrency)" -ForegroundColor Cyan
    Write-Host "   Total Cost Basis: `$$($summaryUSD.data.totalCostBasis.ToString('N2'))" -ForegroundColor Gray
    
    if ($null -ne $summaryUSD.data.totalValue) {
        Write-Host "   Total Value: `$$($summaryUSD.data.totalValue.ToString('N2'))" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

Write-Host "`n" + "=" * 60 -ForegroundColor Gray
Write-Host "✅ FX tests complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Run FX ingestion periodically to keep rates updated"
Write-Host "   - Use ?baseCurrency=TRY for dashboard display"
Write-Host "   - Check fxMissing array for currencies needing rates`n"





