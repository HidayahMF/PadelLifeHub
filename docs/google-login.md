# Google Login (Continue with Google) — Developer Setup

LifeHub uses **Google Identity Services (GIS)**. The frontend shows the official
"Continue with Google" button, receives a signed ID token, and the backend
verifies it with `google-auth-library` before creating or linking the account.

No OAuth **redirect URI** is required for this flow — only **Authorized
JavaScript origins** (where the frontend runs).

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com>.
2. Click the project dropdown → **New Project**.
3. Name it (e.g. `lifehub`) and create it.
4. Make sure the new project is selected.

## 2. Configure the OAuth consent screen

1. Open **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in:
   - **App name**: `LifeHub`
   - **User support email**: your email
   - **Developer contact information**: your email
4. Save and continue. Add **test users** if the app is still in "Testing" mode
   (in production you may need to complete verification — not required for
   personal use).

## 3. Create an OAuth Client ID

1. Open **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. **Application type**: **Web application**.
4. **Name**: `LifeHub Web`.
5. **Authorized JavaScript origins** — add every origin the frontend runs on:
   - `http://localhost:4200` (local development)
   - your production frontend URL, e.g. `https://lifehub.vercel.app`
6. Click **Create**. Copy the **Client ID** (`...apps.googleusercontent.com`).

> The Client ID is not a secret — it ships in the frontend bundle. Never copy
> the **Client Secret** (it is not needed for GIS).

## 4. Backend environment

Add to `backend/.env` (and mirror in Vercel):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Backend reads `GOOGLE_CLIENT_ID` for the OAuth audience. If it is empty,
`POST /api/auth/google` returns `500 Google sign-in is not configured`.

## 5. Frontend environment

| File | Value |
|---|---|
| `frontend/src/environments/environment.ts` (dev) | `googleClientId: 'your-client-id...'` |
| `frontend/src/environments/environment.production.ts` (prod build) | `googleClientId: 'your-client-id...'` |

> Keep development and production Client IDs separate if you create more than
> one OAuth client.

## 6. Run

1. `cd backend && npm install && npm run dev`
2. `cd frontend && npm install && ng serve`
3. Open `http://localhost:4200/login`.

## 7. Test

- **New user**: click **Continue with Google** → a new account is created
  (provider `google`), a `Setting` document is created with onboarding
  status `not_started` (first-time tour shows), default categories are seeded,
  the Google picture is saved as the avatar, and the session is established.
- **Existing email account**: signing in with the same email links the Google
  identity (`googleId` + `provider = google`) to the existing account. The
  password is kept, so email/password login still works.
- **Existing Google account**: signed in immediately (no duplicate).
- **Google-only accounts** cannot change or reset their password (guarded on
  the backend and hidden in the Profile UI).

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Button does not render | `googleClientId` is empty in the active environment, or the GIS script is blocked. |
| `idpiframe_initialization_failed` / popup blocked | The current origin is missing from **Authorized JavaScript origins**. |
| `redirect_uri_mismatch` | Only relevant for redirect flows — GIS popup does not use redirect URIs. |
| `Google sign-in is not configured` | Backend `GOOGLE_CLIENT_ID` is unset. |
| `Invalid value '1.client_id...'` in console | Two GIS scripts loaded, or `initialize()` called more than once — refresh the page. |
