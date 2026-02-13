# =============================================================================
# Test Authentication API (PowerShell)
# Run: .\scripts\test-auth.ps1
# =============================================================================

$BaseUrl = $env:BASE_URL ?? "http://localhost:3000"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

Write-Host "🧪 Testing Authentication API" -ForegroundColor Cyan
Write-Host "   Base URL: $BaseUrl"
Write-Host ""

# -----------------------------------------------------------------------------
# Test 1: Health Check
# -----------------------------------------------------------------------------
Write-Host "1️⃣  Health Check (GET /api/health)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 2: Check Auth (should fail - not logged in)
# -----------------------------------------------------------------------------
Write-Host "2️⃣  Get Current User - Not Authenticated (GET /api/auth/me)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method Get -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    $_.Exception.Response | ConvertTo-Json -Depth 10 -ErrorAction SilentlyContinue
    Write-Host "Expected: Not authenticated" -ForegroundColor Gray
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 3: Login with invalid credentials
# -----------------------------------------------------------------------------
Write-Host "3️⃣  Login - Invalid Credentials (POST /api/auth/login)" -ForegroundColor Yellow
$body = @{
    email = "wrong@email.com"
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -Body $body -ContentType "application/json" -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected: Invalid credentials" -ForegroundColor Gray
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 4: Login with valid credentials
# -----------------------------------------------------------------------------
Write-Host "4️⃣  Login - Valid Credentials (POST /api/auth/login)" -ForegroundColor Yellow
$body = @{
    email = "admin@finans.local"
    password = "changeme123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -Body $body -ContentType "application/json" -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 5: Check Auth (should succeed - logged in)
# -----------------------------------------------------------------------------
Write-Host "5️⃣  Get Current User - Authenticated (GET /api/auth/me)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method Get -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 6: Logout
# -----------------------------------------------------------------------------
Write-Host "6️⃣  Logout (POST /api/auth/logout)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/logout" -Method Post -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# -----------------------------------------------------------------------------
# Test 7: Check Auth after logout (should fail)
# -----------------------------------------------------------------------------
Write-Host "7️⃣  Get Current User - After Logout (GET /api/auth/me)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method Get -WebSession $Session
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected: Not authenticated" -ForegroundColor Gray
}
Write-Host ""

Write-Host "✅ Tests complete!" -ForegroundColor Green





