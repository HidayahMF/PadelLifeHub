# LifeHub — Production Checklist

Checklist langkah demi langkah untuk membawa LifeHub ke production (Vercel) dengan konfigurasi yang sudah dipilih:

- **Email**: Resend (`RESEND_API_KEY`)
- **Avatar**: Cloudinary (`CLOUDINARY_*`)
- **Cron**: cron-job.org (hit `POST /api/cron/tick` tiap 1 menit)
- **AI**: Gemini (`GEMINI_API_KEY`)

> **Tutorial lengkap langkah demi langkah (custom domain + deploy):**
> baca [docs/VERCEL-DEPLOY.md](VERCEL-DEPLOY.md). Checklist ini versi ringkasnya.

---

## 0. Prasyarat Akun

- [ ] MongoDB Atlas (sudah ada)
- [ ] Google Cloud Console (OAuth Client ID Web — sudah di-set untuk dev; tambah origin produksi)
- [ ] Vercel (2 project: `lifehub-frontend`, `lifehub-backend`)
- [ ] Resend (buat API key + verifikasi domain)
- [ ] Cloudinary (buat akun gratis → ambil Cloud Name / API Key / API Secret)
- [ ] cron-job.org (gratis, cukup daftar email)

---

## 1. Environment Variables

### Backend (Vercel project `lifehub-backend`)
| Variable | Nilai |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | **generate kuat** (lihat Fase 2) |
| `JWT_EXPIRES_IN` | `30d` |
| `CLIENT_URL` | `https://<your-frontend>.vercel.app` |
| `GOOGLE_CLIENT_ID` | Web Client ID Google |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | alamat pengirim (mis. `LifeHub <no-reply@yourdomain.com>`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `GEMINI_API_KEY` | Gemini API key (LifeHub AI) |
| `GEMINI_MODEL` | `gemini-3.6-flash` (default) |
| `AI_RATE_LIMIT_PER_MINUTE` / `AI_DAILY_LIMIT` | `10` / `100` (opsional) |
| `CRON_SECRET` | string rahasia acak (dipakai header `x-cron-secret`) |
| `NODE_ENV` | `production` |
| `UPLOAD_STORAGE` | `cloudinary` (atau kosong = lokal untuk dev) |

### Frontend (Vercel project `lifehub-frontend`)
| File | Isi |
|---|---|
| `src/environments/environment.production.ts` | `apiUrl: 'https://<your-backend>.vercel.app/api'`, `googleClientId: '<web client id>'` |

---

## 2. Scheduler → cron-job.org

1. Backend mengekspos `POST /api/cron/tick` yang melindungi dengan header `x-cron-secret`.
2. Di cron-job.org buat job baru:
   - URL: `https://<your-backend>.vercel.app/api/cron/tick`
   - Method: `POST`
   - Header: `x-cron-secret: <CRON_SECRET>` (+ `Content-Type: application/json`, body `{}`)
   - Schedule: **setiap menit** (`*/1 * * * *`)
3. Di production, scheduler in-proses (`setInterval`) **nonaktif** (hanya jalan saat dev).

> Catatan: Vercel Hobby hanya mengizinkan cron maksimal 1×/hari — itu sebabnya dipakai cron-job.org.

---

## 3. Google Cloud — Origin Produksi

1. Google Cloud Console → **OAuth consent screen** → pastikan sudah Published.
2. Credentials → Client ID Web → **Authorized JavaScript origins**:
   - `https://<your-frontend>.vercel.app`
   - (dev) `http://localhost:4200`
3. Client ID yang sama dipakai backend (`GOOGLE_CLIENT_ID`) dan frontend (`googleClientId`).

---

## 4. Resend (Email)

1. Buat API key di dash.resend.com → api keys.
2. Verifikasi domain untuk pengirim profesional (`EMAIL_FROM`).
3. Fitur email yang aktif:
   - Lupa password (link reset ke `https://<frontend>/reset-password?token=...`)
   - Notifikasi reminder/tugas bila `Setting.notifications.emailUpdates` aktif.

---

## 5. Cloudinary (Avatar)

1. Upload avatar sekarang disimpan ke Cloudinary bila `UPLOAD_STORAGE=cloudinary` (fallback folder lokal di dev).
2. Foto lama otomatis dihapus dari Cloudinary saat diganti/dihapus.
3. Tidak perlu endpoint `/uploads` statis di production.

---

## 6. Vercel Deploy

### Backend
1. `api/index.js` (re-export Express app) + `vercel.json` (semua request → serverless function) sudah disiapkan di repo.
2. Import repo ke Vercel → New Project → pilih folder `backend` → Framework "Other".
3. Build Settings default (Vercel membaca `vercel.json`; dependency otomatis terinstall).
4. Set semua env di atas.
5. Root Directory: `backend`.

### Frontend
1. Vercel → New Project → pilih folder `frontend`.
2. Build Command: `npm run build`, Output Directory: `dist/frontend/browser`.
3. Set env? Tidak wajib (nilai dibundle saat build dari `environment.production.ts`).

---

## 7. Verifikasi Akhir

- [ ] `https://<frontend>/*` termuat & login jalan (email + Google).
- [ ] Forgot password mengirim email → link reset → password baru masuk.
- [ ] Reminder (30s) & transaksi berulang (60s) berjalan via cron-job.org (cek muncul notifikasi dalam ≤1 menit).
- [ ] Upload avatar → URL Cloudinary permanen.
- [ ] Ekspor CSV/JSON berhasil.
- [ ] Rate limit aktif (10 percobaan/menit untuk auth).

---

## 8. Keamanan (status implementasi)

Sudah dikerjakan & terverifikasi di kode:
- [x] bcrypt hash password (migrasi otomatis user lama saat login)
- [x] `express-rate-limit` pada `/api/auth`
- [x] `helmet` security headers
- [x] Token reset password disimpan sebagai hash sha256, kedaluwarsa 1 jam

Wajib di-set saat deploy (belum dikerjakan sampai env production diisi):
- [ ] `JWT_SECRET` kuat di Vercel (nilai dev sudah kuat, tapi production pakai env sendiri)
- [ ] `CRON_SECRET` untuk job cron-job.org
- [ ] `NODE_ENV=production` (menonaktifkan scheduler in-proses, mengaktifkan alur email/upload production)
