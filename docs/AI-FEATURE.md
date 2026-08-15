# LifeHub AI

LifeHub AI is a personal productivity and finance assistant built into LifeHub.
It reads the *logged-in user's own data* (tasks, transactions, habits, goals)
from MongoDB and uses Google Gemini to produce grounded, actionable insights —
financial analysis, daily planning, habit and goal reviews, and free-form
questions about your data.

It is not a generic chatbot: every answer is generated from a compact context
built server-side from the authenticated user's real data.

---

## How it works end-to-end

```
Angular /ai page
  │  POST /api/ai/...  (auth header from the existing JWT interceptor)
  ▼
Express aiRoutes → protect (JWT) → per-user rate limit
  ▼
aiController → aiContext (server-side MongoDB queries scoped to req.user._id)
  ▼
geminiService (backend only, holds GEMINI_API_KEY) → Gemini API
  ▼
safe reply rendered as sanitized Markdown in the chat UI
```

- The **frontend never sees the API key** and never sends raw data to Gemini
  directly — it only calls LifeHub's own `/api/ai/*` endpoints.
- The **user id always comes from the JWT** (`req.user._id`); the client can
  never choose whose data is read.

---

## Files

### Backend (new)

| File | Purpose |
| --- | --- |
| `backend/services/geminiService.js` | Gemini client wrapper: model from env, timeout, safe error codes, system prompt |
| `backend/services/aiContext.js` | Data-minimization context builders (`buildFinancialContext`, `buildDailyContext`, `buildHabitContext`, `buildGoalContext`, `buildGeneralContext`) |
| `backend/controllers/aiController.js` | The five AI endpoints |
| `backend/routes/aiRoutes.js` | Auth + per-user rate limiting + route wiring |
| `backend/test/geminiService.test.cjs` | Unit tests for the Gemini service (missing key, model default) |
| `backend/test/aiApi.test.cjs` | HTTP + context tests: auth, validation, rate limit, safe errors, data minimization, user isolation |

### Backend (modified)

- `backend/app.js` — mounts `app.use('/api/ai', require('./routes/aiRoutes'))`
- `backend/package.json` — added `@google/genai`, added `npm test`
- `backend/.env.example` — added `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `AI_RATE_LIMIT_PER_MINUTE`, `AI_DAILY_LIMIT`

### Frontend (new)

| File | Purpose |
| --- | --- |
| `frontend/src/app/features/ai/ai.component.ts` | The `/ai` page: quick actions, chat area, loading/error/empty states |
| `frontend/src/app/core/services/ai.service.ts` | Angular client for the five AI endpoints |
| `frontend/src/app/core/utils/markdown.ts` | Minimal, HTML-escaped Markdown → HTML renderer for AI replies |

### Frontend (modified)

- `frontend/src/app/app.routes.ts` — `/ai` route
- `frontend/src/app/layout/nav-items.ts` — "LifeHub AI" in the sidebar
- `frontend/src/app/features/dashboard/dashboard.component.ts` — compact "✨ LifeHub AI" card (Ask AI / Analyze finances)
- `frontend/src/app/features/today/today.component.ts` — "Plan my day with AI" button (deep-links to `/ai?mode=daily-plan`)
- `frontend/src/app/core/icons.ts` — `bot`, `send`, `message-square` icons
- `frontend/src/app/core/i18n/id.ts` — Bahasa Indonesia strings for the AI page

---

## API endpoints

All endpoints require `Authorization: Bearer <jwt>`.

| Endpoint | Purpose | Body |
| --- | --- | --- |
| `POST /api/ai/chat` | Free-form question answered from the user's data | `{ "message": string }` (1–4000 chars, required) |
| `POST /api/ai/financial-insight` | This month vs last month, top categories, budget risks, recommendations | — |
| `POST /api/ai/daily-plan` | Recommended Morning / Afternoon / Evening schedule (recommendation only, never writes to DB) | — |
| `POST /api/ai/habit-insight` | Consistent / slipping habits, streaks, practical tips | — |
| `POST /api/ai/goal-insight` | Deadline risk, priority order, next steps per goal | — |

Success response:

```json
{ "success": true, "reply": "…Markdown text…" }
```

Error responses (never leak internals):

```json
{ "success": false, "message": "AI service is temporarily unavailable." }
```

| Status | Meaning |
| --- | --- |
| `400` | Validation failed (missing/empty/oversized message) |
| `401` | Missing or invalid token |
| `429` | Rate limit reached: "AI request limit reached. Please try again later." |
| `503` | `GEMINI_API_KEY` not set: "AI service is not configured" |
| `502` | Gemini/network/timeout failure (safe message) |

---

## Environment variables

Add to `backend/.env` (and to the deployed environment):

```bash
GEMINI_API_KEY=            # Google AI Studio key — backend only, never committed
GEMINI_MODEL=gemini-3.6-flash   # optional, default gemini-3.6-flash
GEMINI_TIMEOUT_MS=30000         # optional, default 30s
AI_RATE_LIMIT_PER_MINUTE=10     # optional, default 10 requests/user/minute
AI_DAILY_LIMIT=100              # optional, default 100 requests/user/day
```

- `backend/.env` is already git-ignored; `backend/.env.example` only ships
  placeholders.
- **Never** put a real key in the frontend, `environment*.ts`, Git, or this doc.
- Without `GEMINI_API_KEY` the backend still boots; AI endpoints return `503`
  and the UI shows "AI service is not configured".

Get a key at <https://aistudio.google.com/apikey>. The default model
`gemini-3.6-flash` is available on the free tier and answers quickly; switch via
`GEMINI_MODEL` if you prefer another model.

---

## Security & privacy

- **Key handling:** `GEMINI_API_KEY` is read only in `geminiService.js`
  (server-side). It is never logged, never returned, never persisted.
- **Authentication:** every AI route runs through the existing `protect`
  middleware. The user id is taken from the JWT — `req.body.userId` is
  ignored.
- **Data minimization:** `aiContext.js` builds a compact plain-text summary
  (feature names + amounts only). It never includes passwords, JWT, reset
  tokens, `googleId`, API keys, emails, raw documents, or internal ids.
- **No persistence:** prompts and replies are not stored in the database.
- **Safe rendering:** the frontend escapes all model output and renders only a
  small allow-list of tags (h1–h3, p, ul/ol/li, strong, em, code) through
  Angular's `DomSanitizer` — no raw HTML from Gemini ever reaches the DOM.
- **Logging:** technical errors are logged server-side without the key; the
  client always receives a safe message.
- **Rate limiting:** per-user (JWT) minute and daily limits prevent one account
  from spamming the Gemini API. Note: on serverless (Vercel) the in-memory
  store is per-function-instance, so it is a first line of defense.

---

## Local development

```bash
# backend
cd backend
cp .env.example .env          # add GEMINI_API_KEY, MONGODB_URI, JWT_SECRET
npm install
npm run dev                   # http://localhost:5000

# frontend
cd frontend
npm install
npm start                     # http://localhost:4200 → sidebar → LifeHub AI
```

Run the tests:

```bash
cd backend && npm test        # 19 tests: auth, validation, rate limit, data minimization, isolation
cd frontend && npm run build  # production build
cd frontend && npx ng test --watch=false
```

---

## Production deployment (Vercel)

1. Frontend: unchanged build — deploy the `frontend` project as usual.
2. Backend: deploy the `backend` project (`vercel.json` already routes to
   `api/index.js`). Set these environment variables in Vercel:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional)
   - `AI_RATE_LIMIT_PER_MINUTE`, `AI_DAILY_LIMIT` (optional)
   - existing vars (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `CRON_SECRET`, …)
3. MongoDB Atlas and the Gemini API need no special network config.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| UI shows "AI service is not configured" | `GEMINI_API_KEY` missing | Add it to `.env` / Vercel and restart |
| `429` responses | Rate limit hit (default 10/min, 100/day) | Wait, or raise `AI_RATE_LIMIT_PER_MINUTE` / `AI_DAILY_LIMIT` |
| `502` "temporarily unavailable" | Quota, timeout, or Gemini outage | Check the server log for the technical reason (no key is logged); retry later |
| Answers ignore recent data | Context is built from the current DB state | Re-run the action — contexts are fetched fresh on every request |
