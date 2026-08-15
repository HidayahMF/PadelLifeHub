# LifeHub — Deploy ke Vercel (Tutorial Lengkap, Gratis)

Tutorial langkah demi langkah untuk men-deploy LifeHub **tanpa biaya** — tanpa
custom domain (semua pakai subdomain `*.vercel.app`):

- **Backend** → `https://lifehub-api.vercel.app`
- **Frontend** → `https://lifehub-psi-two.vercel.app`

Dibaca bersama `docs/production-checklist.md` dan `docs/AI-FEATURE.md`.

> **Penting — rahasia (secret):** `backend/.env` tidak ikut ter-commit (git-ignored).
> Semua nilai asli diisi sebagai **Environment Variable di dashboard Vercel**,
> atau di `.env` lokal. **Jangan pernah** menaruh key asli di `.env.example`,
> `environment*.ts`, atau dokumen — file itu ter-commit ke GitHub.

---

## Urutan singkat

1. Siapkan akun yang belum ada (Resend, Cloudinary, cron-job.org)
2. MongoDB Atlas: izinkan akses dari internet
3. Google Cloud: tambah origin `https://lifehub-psi-two.vercel.app`
4. Deploy **backend** (dulu, agar URL-nya pasti)
5. Deploy **frontend**
6. cron-job.org untuk scheduler
7. Verifikasi akhir

---

## Langkah 0 — Prasyarat & akun

Yang **belum** Anda miliki saat tutorial ini ditulis (Agt 2026): akun Resend,
Cloudinary, dan cron-job.org. Sisanya sudah ada.

| Layanan | Keperluan | Akun? |
|---|---|---|
| Vercel | Host frontend + backend | Sudah (buat 2 project baru) |
| MongoDB Atlas | Database | Sudah (cluster `cluster0.iz5gbfu`) |
| Google Cloud | OAuth Client ID (Google login) | Sudah |
| Resend | Email (lupa password, reminder) | **Belum — buat** |
| Cloudinary | Avatar storage | **Belum — buat** |
| cron-job.org | Trigger scheduler tiap menit | **Belum — buat** |

### 0.1 Buat akun Resend
1. Daftar di <https://resend.com> (gratis).
2. **API Keys** → Create API Key → salin `re_...`.
3. Tanpa domain, pakai sender default `EMAIL_FROM=LifeHub <onboarding@resend.dev>`.
   Catatan: sender `onboarding@resend.dev` **hanya bisa mengirim ke email akun
   Resend kamu sendiri** (untuk produksi dengan banyak pengguna, verifikasi
   domain via **Add Domain** — kapan pun nanti, tidak wajib sekarang).

### 0.2 Buat akun Cloudinary
1. Daftar di <https://cloudinary.com> (free tier, 25 kredit).
2. Dashboard menampilkan **Cloud Name**, **API Key**, **API Secret**.
3. Sudah diisi di `backend/.env` lokal: `UPLOAD_STORAGE=cloudinary` +
   `CLOUDINARY_*`.

### 0.3 Buat akun cron-job.org
1. Daftar gratis di <https://cron-job.org>.
2. Job dibuat **setelah** backend live (Langkah 6).

---

## Langkah 1 — MongoDB Atlas: izinkan akses Vercel

Lambda Vercel berjalan dari IP AWS yang berubah-ubah:

1. Atlas → **Network Access** → **Add IP Address** → pilih **Allow access from
   anywhere** (`0.0.0.0/0`) → Confirm.

---

## Langkah 2 — Google Cloud: tambah origin produksi

1. Google Cloud Console → **Credentials** → OAuth Client ID Web yang dipakai
   sekarang (`987681566381-...apps.googleusercontent.com`).
2. **Authorized JavaScript origins** tambahkan:
   - `https://lifehub-psi-two.vercel.app` (produksi)
   - `http://localhost:4200` (dev, tetap)
3. Client ID yang sama dipakai backend (`GOOGLE_CLIENT_ID`) dan frontend
   (`googleClientId` — sudah diisi di `environment.production.ts`).

---

## Langkah 3 — Deploy Backend

1. Pastikan kode terbaru sudah di-`push` ke GitHub (termasuk fix koneksi Mongo
   di `api/index.js` dan `config/db.js`).
2. Vercel → **Add New → Project** → import repo `PadelLifeHub` → project name
   **`lifehub-api`**.
3. **Root Directory**: `backend`. Vercel membaca `vercel.json` (`builds` +
   `routes`) → semua request menuju `api/index.js` (Express app). Framework
   otomatis "Other".
4. **Environment Variables** — isi:

| Variable | Nilai |
|---|---|
| `MONGODB_URI` | `mongodb+srv://LifeHub:…@cluster0.iz5gbfu.mongodb.net/lifehub?...` |
| `JWT_SECRET` | string acak ≥32 char (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `30d` |
| `CLIENT_URL` | `https://lifehub-psi-two.vercel.app` |
| `GOOGLE_CLIENT_ID` | `987681566381-…apps.googleusercontent.com` |
| `RESEND_API_KEY` | `re_…` (dari Langkah 0.1) |
| `EMAIL_FROM` | `LifeHub <onboarding@resend.dev>` |
| `UPLOAD_STORAGE` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | `jes2zgrm` |
| `CLOUDINARY_API_KEY` | dari Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | dari Cloudinary dashboard |
| `GEMINI_API_KEY` | dari AI Studio |
| `GEMINI_MODEL` | `gemini-3.6-flash` (default) |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` |
| `AI_DAILY_LIMIT` | `100` |
| `CRON_SECRET` | string acak (dipakai header `x-cron-secret`) |

> `NODE_ENV=production` di-set otomatis oleh Vercel → scheduler in-proses mati,
> `POST /api/cron/tick` yang aktif, forgot-password tidak pernah mengembalikan
> token di response. `RUN_SCHEDULERS` tidak perlu di-set di Vercel.

5. **Deploy**. URL final: `https://lifehub-api.vercel.app`.
6. Verifikasi di browser/curl:
   ```bash
   curl https://lifehub-api.vercel.app/
   # → { "name": "LifeHub API", "version": "1.0.0", "status": "running" }

   curl -X POST https://lifehub-api.vercel.app/api/cron/tick -H "Content-Type: application/json" -d '{}'
   # → 401 Unauthorized (berarti app jalan; butuh header x-cron-secret)
   ```
   Kalau muncul 503 `Database unavailable`, periksa `MONGODB_URI` + Network
   Access (Langkah 1).

---

## Langkah 4 — Deploy Frontend

1. `frontend/src/environments/environment.production.ts` **sudah diisi**:
   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://lifehub-api.vercel.app/api',
     googleClientId: '987681566381-…apps.googleusercontent.com',
     siteUrl: 'https://lifehub-psi-two.vercel.app',
   };
   ```
2. Pastikan perubahan ini sudah di-commit & di-push.
3. Vercel → **Add New → Project** → import repo → project name **`lifehub`**,
   **Root Directory**: `frontend`.
4. Vercel mendeteksi framework **Angular** otomatis.
   - Build Command: `npm run build`
   - Output Directory: `dist/frontend/browser`
5. **Deploy**. URL final: `https://lifehub-psi-two.vercel.app` — buka, cek halaman
   landing + login termuat (gambar `assets/*.png`, logo, dsb).

> Bila nama project ternyata sudah dipakai orang lain, Vercel menambahkan
> akhiran (mis. `lifehub-xyz.vercel.app`). Jika itu terjadi, beri tahu saya
> untuk update `siteUrl`/canonical/OG + `CLIENT_URL` backend, lalu redeploy.

---

## Langkah 5 — cron-job.org (Scheduler)

1. backend mengekspos `POST /api/cron/tick` yang dilindungi header
   `x-cron-secret` (nilainya = `CRON_SECRET` di Vercel).
2. **Opsi A — otomatis (via API token):**
   ```bash
   cd backend
   node scripts/setup-cron-job.cjs   # butuh CRONJOB_API_TOKEN + CRON_SECRET di .env
   ```
   Script membuat/memperbarui job `LifeHub scheduler tick` → tiap menit →
   `POST https://lifehub-api.vercel.app/api/cron/tick` + header `x-cron-secret`
   + body `{}`. Token diambil dari cron-job.org Console → **Settings → API**.
   (Job sudah dibuat: **#8270730** — masih menampilkan gagal sampai backend
   live, itu normal.)
3. **Opsi B — manual (dashboard):**
   - cron-job.org → **New job**:
     - URL: `https://lifehub-api.vercel.app/api/cron/tick`
     - Method: `POST`
     - Headers: `x-cron-secret: <CRON_SECRET>` dan `Content-Type: application/json`
     - Request Body: `{}`
     - Schedule: **setiap menit** (`*/1 * * * *`)
4. Tanpa job ini, reminder & transaksi berulang **tidak berjalan** di
   production (scheduler in-proses dimatikan saat `NODE_ENV=production`).
5. Uji: jalankan job manual sekali → cek muncul notifikasi baru dalam ≤1 menit.

---

## Langkah 6 — Verifikasi Akhir

- [ ] `https://lifehub-psi-two.vercel.app` termuat (halaman landing + login)
- [ ] Login dengan email & **Continue with Google** dari `https://lifehub-psi-two.vercel.app`
- [ ] Forgot password → (dev `onboarding@resend.dev` hanya ke email akun Resend;
      untuk pengguna lain verifikasi domain dulu) — alur API-nya jalan
- [ ] Upload avatar → URL `res.cloudinary.com/…` permanen
- [ ] LifeHub AI (`/ai`): quick actions menjawab dari data asli
- [ ] cron-job.org: notifikasi reminder muncul ≤1 menit
- [ ] Rate limit: >10 percobaan login/menit → `429`
- [ ] Ekspor CSV/JSON tetap jalan

---

## Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| 503 `Database unavailable` | `MONGODB_URI` salah / Network Access belum dibuka | Cek Langkah 1 + env |
| Login Google gagal | Origin belum didaftarkan di Google Cloud | Langkah 2 |
| Email tidak terkirim | Sender `onboarding@resend.dev` hanya ke email akun sendiri | Verifikasi domain di Resend (opsional) |
| Avatar hilang setelah deploy | Masih `UPLOAD_STORAGE` kosong (filesystem Vercel ephemeral) | Set `cloudinary` |
| Scheduler tidak jalan | `NODE_ENV=production` mematikan in-proses & cron belum dibuat | Langkah 5 |
| CORS error di browser | `CLIENT_URL` backend ≠ URL frontend yang dipakai | Set `https://lifehub-psi-two.vercel.app` |
| Gambar (logo/avatar bank) 404 | Asset tidak ikut build | pastikan di `frontend/assets/` (ter-copy ke `assets/`) |
| AI "not configured" | `GEMINI_API_KEY` kosong | Tambahkan di Vercel |
| Rate limit keburu kena di dev | `express-rate-limit` in-memory (10/15 mnt) | Tunggu 15 menit atau naikkan `auth` limit sementara |

Catatan: `express-rate-limit` dan `aiRoutes` memakai store **in-memory**; pada
Vercel store itu per-instance (cold start baru). Cukup untuk lini pertama;
untuk ketat gunakan external store (Redis/Upstash) bila perlu.

---

## Daftar environment yang SUDAH ada di `backend/.env` lokal (JANGAN di-commit)

Semua nilai di bawah sudah terisi di `backend/.env` (git-ignored) dan harus
diduplikasi ke Vercel (Langkah 3.4):

- `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`,
  `GOOGLE_CLIENT_ID`, `PORT`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `UPLOAD_STORAGE=cloudinary`, `CLOUDINARY_*`
- `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.6-flash`, `AI_*`
- `CRON_SECRET`, `CRONJOB_API_TOKEN` (token API cron-job.org, hanya dipakai
  script `scripts/setup-cron-job.cjs` — tidak perlu di Vercel)

`backend/.env.example` hanya berisi placeholder (aman untuk di-commit).
