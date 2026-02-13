# Backend Setup Instructions

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Quick Start

```bash
# 1. Install dependencies
cd finans-app
npm install

# 2. Start PostgreSQL (see options below)

# 3. Create .env file
cp .env.example .env  # or create manually

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Seed database (creates default user)
npm run db:seed

# 6. Start development server
npm run dev
```

## 1. Database Setup

### Option A: Local PostgreSQL

```bash
# Create database
createdb finans_dev

# Or via psql
psql -U postgres -c "CREATE DATABASE finans_dev;"
```

### Option B: Docker

```bash
docker run --name finans-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=finans_dev \
  -p 5432:5432 \
  -d postgres:15
```

### Option C: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: finans_dev
    ports:
      - "5432:5432"
    volumes:
      - finans_db:/var/lib/postgresql/data

volumes:
  finans_db:
```

```bash
docker-compose up -d
```

## 2. Environment Configuration

Create `.env` file in project root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finans_dev?schema=public"

# Auth (REQUIRED - generate a strong secret for production)
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
BCRYPT_ROUNDS=12

# Default user (for seeding)
DEFAULT_USER_EMAIL="admin@finans.local"
DEFAULT_USER_PASSWORD="changeme123"
```

### Generate Secure JWT Secret

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## 3. Install Dependencies

```bash
cd finans-app
npm install
```

## 4. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev --name init

# Or for production
npx prisma migrate deploy
```

## 5. Seed Database

```bash
npm run db:seed
```

Output:
```
🌱 Seeding database...
✅ User created: admin@finans.local
   Password: changeme123
✅ 21 assets created
✅ 3 accounts created
✅ 3 watchlists created
✅ 4 RSS sources created
✅ 4 FX rates created

✅ Seeding complete!

📝 Login credentials:
   Email: admin@finans.local
   Password: changeme123
```

## 6. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

## 7. Verify Setup

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

## 8. Test Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@finans.local", "password": "changeme123"}' \
  -c cookies.txt

# Get current user
curl http://localhost:3000/api/auth/me -b cookies.txt

# Or run the test script
# Windows:
.\scripts\test-auth.ps1

# Linux/Mac:
bash scripts/test-auth.sh
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Create new migration |
| `npm run db:push` | Push schema without migration |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run db:reset` | Reset database (dev only) |

## View Database

```bash
# Open Prisma Studio (web GUI)
npm run db:studio
```

Opens at `http://localhost:5555`

## Project Structure

```
finans-app/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed script
│   └── migrations/        # Migration files
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   └── health/route.ts
│   │   └── ...            # Frontend pages
│   ├── lib/
│   │   ├── db.ts          # Prisma client
│   │   ├── auth.ts        # Authentication utilities
│   │   └── api.ts         # API utilities
│   └── ...
├── scripts/
│   ├── test-auth.sh       # Auth test script (bash)
│   └── test-auth.ps1      # Auth test script (PowerShell)
└── docs/
    ├── BACKEND_SETUP.md   # This file
    └── AUTHENTICATION.md  # Auth documentation
```

## Troubleshooting

### Database Connection

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U postgres -d finans_dev -c "SELECT 1"
```

### Connection refused

- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify port 5432 is not blocked

### Migration failed

```bash
# Reset and start fresh (dev only!)
npx prisma migrate reset
```

### Prisma client out of sync

```bash
npx prisma generate
```

### Auth Issues

See `docs/AUTHENTICATION.md` for detailed troubleshooting.

## Next Steps

1. ✅ Database schema created
2. ✅ Authentication implemented
3. ⏳ Implement Portfolio API (accounts, trades)
4. ⏳ Implement Markets API (watchlists, prices)
5. ⏳ Implement News API (RSS, articles)
6. ⏳ Connect frontend to backend
