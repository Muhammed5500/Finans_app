#!/bin/bash
# =============================================================================
# Test Authentication API
# Run: bash scripts/test-auth.sh
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="/tmp/finans_cookies.txt"

echo "🧪 Testing Authentication API"
echo "   Base URL: $BASE_URL"
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

# -----------------------------------------------------------------------------
# Test 1: Health Check
# -----------------------------------------------------------------------------
echo "1️⃣  Health Check (GET /api/health)"
curl -s "$BASE_URL/api/health" | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 2: Check Auth (should fail - not logged in)
# -----------------------------------------------------------------------------
echo "2️⃣  Get Current User - Not Authenticated (GET /api/auth/me)"
curl -s "$BASE_URL/api/auth/me" | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 3: Login with invalid credentials
# -----------------------------------------------------------------------------
echo "3️⃣  Login - Invalid Credentials (POST /api/auth/login)"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "wrong@email.com", "password": "wrongpassword"}' | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 4: Login with valid credentials
# -----------------------------------------------------------------------------
echo "4️⃣  Login - Valid Credentials (POST /api/auth/login)"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@finans.local", "password": "changeme123"}' \
  -c "$COOKIE_FILE" | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 5: Check Auth (should succeed - logged in)
# -----------------------------------------------------------------------------
echo "5️⃣  Get Current User - Authenticated (GET /api/auth/me)"
curl -s "$BASE_URL/api/auth/me" \
  -b "$COOKIE_FILE" | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 6: Logout
# -----------------------------------------------------------------------------
echo "6️⃣  Logout (POST /api/auth/logout)"
curl -s -X POST "$BASE_URL/api/auth/logout" \
  -b "$COOKIE_FILE" \
  -c "$COOKIE_FILE" | jq .
echo ""

# -----------------------------------------------------------------------------
# Test 7: Check Auth after logout (should fail)
# -----------------------------------------------------------------------------
echo "7️⃣  Get Current User - After Logout (GET /api/auth/me)"
curl -s "$BASE_URL/api/auth/me" \
  -b "$COOKIE_FILE" | jq .
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

echo "✅ Tests complete!"





