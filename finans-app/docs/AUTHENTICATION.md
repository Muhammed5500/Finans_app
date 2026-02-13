# Authentication Guide

## Overview

The Finans app uses **JWT-based authentication with HTTP-only cookies**. This provides:

- **Security**: Cookies are HTTP-only (no XSS access) and secure in production
- **Stateless**: No server-side session storage needed
- **Simplicity**: Browser automatically sends cookies with requests

## Authentication Flow

```
┌─────────────┐     POST /api/auth/login      ┌──────────────┐
│   Client    │ ─────────────────────────────▶│    Server    │
│             │   { email, password }         │              │
│             │                               │              │
│             │◀───────────────────────────── │              │
│             │   Set-Cookie: finans_auth=JWT │              │
└─────────────┘                               └──────────────┘

Subsequent requests automatically include the cookie:

┌─────────────┐     GET /api/accounts         ┌──────────────┐
│   Client    │ ─────────────────────────────▶│    Server    │
│             │   Cookie: finans_auth=JWT     │              │
│             │                               │              │
│             │◀───────────────────────────── │              │
│             │   { success: true, data: [...] }             │
└─────────────┘                               └──────────────┘
```

## API Endpoints

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@finans.local",
  "password": "changeme123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "admin@finans.local",
      "name": "Admin",
      "baseCurrency": "TRY"
    },
    "message": "Login successful"
  }
}
```

**Response (Failure - 401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### Logout

```http
POST /api/auth/logout
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  }
}
```

### Get Current User

```http
GET /api/auth/me
```

**Response (Authenticated - 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "admin@finans.local",
      "name": "Admin",
      "baseCurrency": "TRY"
    }
  }
}
```

**Response (Not Authenticated - 401):**
```json
{
  "success": false,
  "error": "Not authenticated"
}
```

## cURL Examples

### Login

```bash
# Login and save cookies to a file
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@finans.local", "password": "changeme123"}' \
  -c cookies.txt \
  -v

# Response headers will include:
# Set-Cookie: finans_auth=eyJhbGciOiJIUzI1NiIs...; Path=/; HttpOnly; SameSite=Lax
```

### Access Protected Endpoint

```bash
# Use saved cookies for subsequent requests
curl http://localhost:3000/api/auth/me \
  -b cookies.txt

# Or manually pass cookie
curl http://localhost:3000/api/auth/me \
  -H "Cookie: finans_auth=eyJhbGciOiJIUzI1NiIs..."
```

### Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

### Health Check (No Auth Required)

```bash
curl http://localhost:3000/api/health
```

## Frontend Integration

### Using fetch

```typescript
// Login
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include', // Important: include cookies
  });
  return response.json();
}

// Get current user
async function getCurrentUser() {
  const response = await fetch('/api/auth/me', {
    credentials: 'include',
  });
  return response.json();
}

// Logout
async function logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  return response.json();
}

// Protected API call
async function getAccounts() {
  const response = await fetch('/api/accounts', {
    credentials: 'include',
  });
  
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login';
    return;
  }
  
  return response.json();
}
```

### React Hook Example

```typescript
import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.data.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.data.user);
    } else {
      throw new Error(data.error);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Environment Variables

```env
# Required
JWT_SECRET="your-super-secret-key-min-32-chars"

# Optional
BCRYPT_ROUNDS=12  # Default: 12

# For seeding default user
DEFAULT_USER_EMAIL="admin@finans.local"
DEFAULT_USER_PASSWORD="changeme123"
```

## Security Considerations

1. **JWT Secret**: Use a strong, random secret (min 32 characters) in production
2. **HTTPS**: In production, cookies are marked `Secure` (HTTPS only)
3. **Token Expiry**: Tokens expire after 7 days
4. **Password Hashing**: bcrypt with 12 rounds by default
5. **HTTP-Only Cookies**: JavaScript cannot access the token (XSS protection)
6. **SameSite**: Cookies use `Lax` policy (CSRF protection)

## Protecting API Routes

Use the `withAuth` wrapper for protected endpoints:

```typescript
// src/app/api/accounts/route.ts
import { withAuth, successResponse } from '@/lib/api';
import { db } from '@/lib/db';

export const GET = withAuth(async (request, { user }) => {
  // user is guaranteed to be authenticated
  const accounts = await db.account.findMany({
    where: { userId: user.id },
  });
  
  return successResponse(accounts);
});
```

Or use `requireAuth()` directly:

```typescript
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse } from '@/lib/api';

export async function GET() {
  try {
    const user = await requireAuth(); // Throws if not authenticated
    
    // ... your logic
    
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Troubleshooting

### "Not authenticated" error

1. Check if cookie is being sent (browser DevTools → Network → Cookies)
2. Ensure `credentials: 'include'` in fetch requests
3. Verify JWT_SECRET hasn't changed since login

### "Invalid credentials" error

1. Check email is correct (case-insensitive)
2. Verify password
3. Run `npm run db:seed` to reset default user

### Cookie not being set

1. Check browser allows cookies
2. In production, ensure HTTPS is enabled
3. Check for CORS issues if API is on different domain





