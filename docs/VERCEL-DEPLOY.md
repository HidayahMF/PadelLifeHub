# LifeHub — Deploy ke Vercel (Tutorial Lengkap)

Tutorial langkah demi langkah untuk men-deploy LifeHub:
- **Backend** → Vercel serverless (URL default: `https://lifehub-backend.vercel.app`)
- **Frontend** → Vercel statis dengan **custom domain** (mis. `https://lifehub.id`)

Dibaca bersama `docs/production-checklist.md` dan `docs/AI-FEATURE.md`.

> **Penting — rahasia (secret):** `backend/.env` tidak ikut ter-commit (git-ignored).
> Semua nilai asli diisi sebagai **Environment Variable di dashboard Vercel**,
> atau di `.env` lokal. **Jangan pernah** menaruh key asli di `.env.example`,
> `environment*.ts`, atau dokumen — file itu ter-commit ke GitHub.

---

## Urutan singkat

1. Siapkan akun & beli domain
2. MongoDB Atlas: izinkan akses dari internet
3. Google Cloud: tambah origin produksi
4. Deploy **backend** (dulu, agar URL-nya diketahui)
5. Isi `environment.production.ts` → deploy **frontend**
6. Sambungkan **custom domain** ke frontend
7. Balik ke Google Cloud bila perlu
8. cron-job.org untuk scheduler
9. Verifikasi akhir

---

## Langkah 0 — Prasyarat & akun

Yang **belum** Anda miliki saat tutorial ini ditulis (Agt 2026): akun Resend,
Cloudinary, cron-job.org, dan custom domain. Sisanya sudah ada.

| Layanan | Keperluan | Akun? |
|---|---|---|
| Vercel | Host frontend + backend | Sudah (buat project baru) |
| MongoDB Atlas | Database | Sudah (cluster `cluster0.iz5gbfu`) |
| Google Cloud | OAuth Client ID (Google login) | Sudah |
| Resend | Email (lupa password, reminder) | **Belum — buat** |
| Cloudinary | Avatar storage | **Belum — buat** |
| cron-job.org | Trigger scheduler tiap menit | **Belum — buat** |
| Custom domain | Frontend (bukan `*.vercel.app`) | **Belum — beli** |

### 0.1 Buat akun Resend
1. Daftar di <https://resend.com> (gratis).
2. **API Keys** → Create API Key → salin `re_...`.
3. Kirim-tes/verifikasi **domain** (mis. `lifehub.id`) via **Add Domain**:
   Resend menampilkan record DNS `TXT` (dan `MX`) → tambahkan di DNS registrar
   → tunggu status "Verified". Selama belum verifikasi domain, pakai default
   `onboarding@resend.dev` (hanya bisa kirim ke email akun Resend sendiri).
4. Setelah verified, `EMAIL_FROM=LifeHub <no-reply@lifehub.id>`.

### 0.2 Buat akun Cloudinary
1. Daftar di <https://cloudinary.com> (free tier, 25 kredit).
2. Dashboard menampilkan **Cloud Name**, **API Key**, **API Secret**.
3. Sudah diisi di `backend/.env` lokal: `UPLOAD_STORAGE=cloudinary` +
   `CLOUDINARY_*`.

### 0.3 Buat akun cron-job.org
1. Daftar gratis di <https://cron-job.org>.
2. Job dibuat **setelah** backend live (Langkah 6).

### 0.4 Beli custom domain
1. Beli di registrar mana pun (contoh: Niagahoster, Namecheap, atau langsung
   "Domains" di dashboard Vercel yang memakai partner registrar).
2. Tidak perlu setup DNS dulu — Vercel akan memberi record yang tepat saat
   domain dihubungkan (Langkah 5).

---

## Langkah 1 — MongoDB Atlas: izinkan akses Vercel

Lambda Vercel berjalan dari IP AWS yang berubah-ubah. Untuk sekarang buka akses:

1. Atlas → **Network Access** → **Add IP Address** → pilih **Allow access from
   anywhere** (`0.0.0.0/0`) → Confirm.
2. > Catatan: ini kenyamanan untuk production awal. Untuk lebih ketat, gunakan
   [Vercel IP ranges](https://vercel.com/docs/static-files-and-caching/ip-ranges)
   (jangan lupa IP-nya bisa berubah, atau pakai proxy/VPC).

---

## Langkah 2 — Google Cloud: tambah origin produksi

1. Google Cloud Console → **Credentials** → OAuth Client ID Web yang dipakai
   sekarang (`987681566381-...apps.googleusercontent.com`).
2. **Authorized JavaScript origins** tambahkan:
   - `https://<domain-anda>` (mis. `https://lifehub.id`)
   - `https://<nama-frontend>.vercel.app` (cadangan)
   - `http://localhost:4200` (tetap, untuk dev)
3. Client ID yang sama dipakai di backend (`GOOGLE_CLIENT_ID`) dan frontend
   (`googleClientId` di environment).

---

## Langkah 3 — Deploy Backend (dulu)

1. Pastikan kode terbaru sudah di-`push` ke GitHub (termasuk fix koneksi Mongo
   di `api/index.js` dan `config/db.js`).
2. Vercel → **Add New → Project** → import repo `PadelLifeHub`.
3. Pada layar configure, ganti **Root Directory** ke `backend`.
   - Vercel membaca `vercel.json` (`builds` + `routes`) → semua request menuju
     `api/index.js` (Express app). Framework otomatis "Other".
4. **Environment Variables** (section "Settings") — isi persis ini:

| Variable | Nilai |
|---|---|
| `MONGODB_URI` | `mongodb+srv://LifeHub:…@cluster0.iz5gbfu.mongodb.net/lifehub?...` |
| `JWT_SECRET` | string acak ≥32 char (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `30d` |
| `CLIENT_URL` | `https://<domain-anda>` (sementara boleh `https://<frontend>.vercel.app`) |
| `GOOGLE_CLIENT_ID` | `987681566381-…apps.googleusercontent.com` |
| `RESEND_API_KEY` | `re_…` (dari Langkah 0.1) |
| `EMAIL_FROM` | `LifeHub <no-reply@lifehub.id>` (atau `onboarding@resend.dev`) |
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

5. **Deploy**. Salin URL project (mis. `https://lifehub-backend.vercel.app`).
6. Verifikasi di browser/curl:
   ```bash
   curl https://lifehub-backend.vercel.app/
   # → { "name": "LifeHub API", "version": "1.0.0", "status": "running" }

   curl -X POST https://lifehub-backend.vercel.app/api/cron/tick -H "Content-Type: application/json" -d '{}'
   # → 401 Unauthorized (berarti app jalan; butuh header x-cron-secret)
   ```
   Kalau muncul 503 `Database unavailable`, periksa `MONGODB_URI` + Network
   Access (Langkah 1).

---

## Langkah 4 — Deploy Frontend

1. Isi `frontend/src/environments/environment.production.ts` dengan nilai nyata:
   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://lifehub-backend.vercel.app/api',
     googleClientId: '987681566381-…apps.googleusercontent.com',
   };
   ```
2. Commit & push (file ini dibundle saat build — harus masuk repo):
   ```bash
   git add frontend/src/environments/environment.production.ts
   git commit -m "Set production environment"
   git push
   ```
3. Vercel → **Add New → Project** → import repo → **Root Directory**: `frontend`.
4. Vercel mendeteksi framework **Angular** otomatis.
   - Build Command: `npm run build`
   - Output Directory: `dist/frontend/browser`
   (bila terdeteksi otomatis, biarkan; verifikasi Output Directory-nya).
5. **Deploy**. Salin URL (mis. `https://lifehub-frontend.vercel.app`) — buka,
   cek halaman login termuat (gambar `assets/*.png`, logo, dsb).

---

## Langkah 5 — Sambungkan Custom Domain ke Frontend

1. Vercel → project frontend → **Settings → Domains** → **Add** → ketik
   `<domain-anda>` (mis. `lifehub.id`).
2. Vercel menampilkan record DNS yang harus dibuat di registrar:
   - **Apex** (`lifehub.id`): record `A` → `76.76.21.21`
   - **www** (`www.lifehub.id`): record `CNAME` → `cname.vercel-dns.com`
3. Buat record tersebut di panel DNS registrar → tunggu status **Valid**
   (beberapa menit sampai beberapa jam tergantung registrar).
4. Buka `https://<domain-anda>` — harus menampilkan aplikasi.
5. **Sinkronkan URL final:**
   - Update `CLIENT_URL` backend di Vercel → `https://<domain-anda>` → Redeploy.
   - Tambahkan `https://<domain-anda>` ke Google Cloud origin (Langkah 2) bila
     sebelumnya cuma memasang `*.vercel.app`.

---

## Langkah 6 — cron-job.org (Scheduler)

1. backend mengekspos `POST /api/cron/tick` yang dilindungi header
   `x-cron-secret` (nilainya = `CRON_SECRET` di Vercel).
2. cron-job.org → **New job**:
   - URL: `https://lifehub-backend.vercel.app/api/cron/tick`
   - Method: `POST`
   - Headers: `x-cron-secret: <CRON_SECRET>` dan `Content-Type: application/json`
   - Request Body: `{}`
   - Schedule: **setiap menit** (`*/1 * * * *`)
3. Tanpa job ini, reminder & transaksi berulang **tidak berjalan** di
   production (scheduler in-proses dimatikan saat `NODE_ENV=production`).
4. Uji: jalankan job manual sekali → cek muncul notifikasi baru dalam ≤1 menit.

---

## Langkah 7 — Verifikasi Akhir

- [ ] `https://<domain-anda>` termuat (login email + Continue with Google)
- [ ] Login dengan Google dari domain produksi (origin sudah didaftarkan)
- [ ] Forgot password → email masuk → link reset → password baru berhasil
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
| Login Google gagal di domain | Origin belum didaftarkan di Google Cloud | Langkah 2 |
| Email tidak terkirim | Domain Resend belum verified / `EMAIL_FROM` belum milik domain | Langkah 0.1 |
| Avatar hilang setelah deploy | Masih `UPLOAD_STORAGE` kosong (filesystem Vercel ephemeral) | Set `cloudinary` |
| Scheduler tidak jalan | `NODE_ENV=production` mematikan in-proses & cron belum dibuat | Langkah 6 |
| CORS error di browser | `CLIENT_URL` backend ≠ URL frontend yang dipakai | Langkah 5.5 |
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
- `CRON_SECRET`

`backend/.env.example` hanya berisi placeholder (aman untuk di-commit).
