# KeepPeer School — Standalone MySQL Edition

This edition runs **fully locally without the Base44 SDK**, backed by a **MySQL** database.
The React frontend talks to a local Express API which reads/writes MySQL tables that are
auto-created from your entity definitions in `base44/entities/`.

## What's included

```
server/                     Express + mysql2 backend (no Base44)
  package.json
  .env.example
  db.js                     MySQL connection pool
  migrate.js                Auto-creates the database + all tables from base44/entities/*.jsonc
  auth.js                   JWT + bcrypt helpers
  index.js                  API: auth, generic entity CRUD, uploads, integration stubs
standalone/                 Files to swap into the React app for local runs
  .env.example              VITE_API_URL
  src/api/base44Client.js   Drop-in client (replaces @base44/sdk, same surface)
  src/lib/app-params.js     Standalone app params
  src/lib/AuthContext.jsx   Standalone auth (JWT-based)
  src/pages/Login.jsx       Email/password login + registration
```

## Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.5+)

## 1. Start the backend

```bash
cd server
cp .env.example .env        # then edit DB credentials + JWT_SECRET
npm install
npm run migrate             # creates the DB + all entity tables
npm start                   # API on http://localhost:4000
```

Create your first admin account by registering in the app, or via the API:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@keeppeer.local","password":"secret","full_name":"Admin","role":"admin"}'
```

## 2. Run the frontend locally (Base44-free)

Copy the standalone drop-in files over the Base44-coupled originals:

```bash
cp standalone/.env.example .env
cp standalone/src/api/base44Client.js src/api/base44Client.js
cp standalone/src/lib/app-params.js src/lib/app-params.js
cp standalone/src/lib/AuthContext.jsx src/lib/AuthContext.jsx
cp standalone/src/pages/Login.jsx src/pages/Login.jsx

npm install
npm run dev
```

Open the printed Vite URL, sign in with the account you created, and use the app.
All data is stored in your local MySQL database (`keeppeer_school` by default).

## How it works
- `base44.entities.Student.list()` → `GET /api/entities/Student`
- `base44.entities.Attendance.create({...})` → `POST /api/entities/Attendance`
- `base44.auth.me()` → `GET /api/auth/me` (JWT from localStorage)
- `base44.integrations.Core.UploadFile({file})` → `POST /api/uploads` (saved to `server/uploads/`)

## Notes / limitations
- **AI features** (facial recognition via InvokeLLM, AI image generation, transcription) are
  **stubbed** locally. Wire a real LLM/vision provider into `server/index.js` (`/api/integrations/llm`)
  to enable them.
- **Email** is stubbed (logs to the server console). Integrate SMTP in `server/index.js` to send mail.
- **Realtime subscriptions** are no-ops in this edition (returns an empty unsubscribe).
- The Base44-coupled `src/lib/AuthContext.jsx` (original) and `src/api/base44Client.js` are
  restored by reverting the copies above if you want to return to the Base44-hosted version.