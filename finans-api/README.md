# Finans Takip API

Express + TypeScript backend scaffold.

## Setup

```bash
npm install
cp .env.example .env   # optional; edit PORT if needed
```

## Scripts

- **`npm run dev`** – start with ts-node-dev (watch)
- **`npm run build`** – compile to `dist/`
- **`npm run start`** – run `node dist/server.js`

## Endpoints

- **`GET /health`** – `{ "status": "ok", "time": "<ISO string>" }`
