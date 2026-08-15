# LifeHub — Website Overview & Feature Guide

> LifeHub (PadelLifeHub) adalah aplikasi web **manajemen hidup all-in-one**: keuangan pribadi + manajemen tugas + habit tracker + goal + wishlist + daftar belanja + kalender + catatan + pomodoro + statistik, dalam satu akun.

Dokumen ini dimaksudkan untuk:
1. Memberi pemahaman menyeluruh tentang apa yang sudah dibangun.
2. Jadi bahan diskusi dengan AI eksternal / tim untuk pengembangan production.

---

## 1. Ringkasan

| Aspek | Detail |
|---|---|
| Nama | LifeHub (repo: PadelLifeHub) |
| Jenis | Web app personal, single-user per akun |
| Frontend | Angular 21 (standalone components, signals), Tailwind CSS, Lucide icons, desain neo-brutalist |
| Backend | Express.js (CommonJS) + Mongoose, MongoDB Atlas |
| Autentikasi | JWT Bearer + **Google Identity Services** (popup) |
| Zona waktu | **Asia/Jakarta (WIB, UTC+7)** — dipaksa di `server.js` dan semua agregasi |
| Mata uang | IDR (format `1.234.567`) |
| Bahasa | Inggris (default) & Indonesia (i18n live-switch) |
| Mode gelap | Ya (Light / Dark / System) |
| Scheduler | 3 job `setInterval` in-proses **hanya di dev**; production memakai `POST /api/cron/tick` via cron-job.org |
| Target deploy | Vercel (2 project: frontend statis + backend serverless) |

---

## 2. Arsitektur

```
Browser (Angular SPA, localhost:4200)
   │  HTTPS
   ▼
Express API (port 5000, /api)
   │
   ├── Auth: JWT + Google GIS (verifyIdToken di backend)
   ├── Mongoose → MongoDB Atlas (15 koleksi)
   ├── Scheduler (reminder 30s, recurring 60s, task 60s)
   └── Uploads (folder lokal saat dev; Cloudinary saat production)
```

**Koleksi MongoDB (15):**

| Koleksi | Fungsi |
|---|---|
| `users` | Akun (email/password/Google), avatar |
| `settings` | Preferensi: tema, bahasa, notifikasi, onboarding, widget dashboard |
| `categories` | Kategori tugas & transaksi (10 default per user baru) |
| `accounts` | Rekening kas/bank/e-wallet + saldo |
| `transactions` | Pemasukan/pengeluaran/transfer + transaksi berulang |
| `budgets` | Budget per kategori per bulan |
| `tasks` | Tugas + reminder + tugas berulang |
| `reminders` | Reminder sekali/berulang (custom/task/bill/shopping/goal/wishlist) |
| `notifications` | Notifikasi in-app dari scheduler |
| `habits` | Habit + streak (tanggal kalender WIB) |
| `goals` | Goal umum & tabungan |
| `notes` | Catatan (masonry, pin, tag) |
| `needs` | Daftar belanja + riwayat pembelian |
| `wishlist` | Wishlist + progress saving |
| `weeklyreviews` | Refleksi mingguan |

---

## 3. Fitur Lengkap

### 3.1 Akun & Autentikasi
- Register email/password, login, logout.
- **Continue with Google** (GIS popup). 3 kasus backend:
  - A: email belum ada → akun dibuat + di-provision (setting + kategori default).
  - B: email sudah punya password → Google di-link, password lama tetap berlaku (2 metode masuk, tanpa duplikat).
  - C: googleId sudah terhubung → login seperti biasa, profil di-refresh dari token.
- Lupa password → token reset (hash sha256, kedaluwarsa 1 jam).
- Ganti password (tersembunyi untuk akun Google-only).
- Foto profil: upload JPG/PNG/WebP/GIF max 3MB.
- Onboarding otomatis: welcome dialog + guided tour.

### 3.2 Halaman Today (landing)
- Salam sesuai jam (☀️🌤️🌆🌙).
- Kartu progress, "Today's focus" (tugas jatuh tempo/terlambat).
- "Today's money" (in/out/net hari ini).
- Habit hari ini (toggle langsung), goals, panel upcoming.
- Tombol quick-add (Tugas/Transaksi/Catatan) & shortcut ke Pomodoro.

### 3.3 Dashboard
- Welcome custom + tombol Customize & Focus.
- **10 widget yang bisa diatur user** (drag-and-drop, show/hide, reset, urutan tersimpan di backend):
  1. stats tugas, 2. finance (balance/income/expense/net + hide-balance), 3. today, 4. upcoming, 5. habits, 6. grafik batang income vs expense 6 bulan, 7. budget, 8. goals, 9. wishlist, 10. transaksi terbaru.

### 3.4 Tugas
- Filter status/kategori/search/siklus hidup (Active/Archived/Trash)/tag.
- Pin, prioritas, due date, reminder per tugas.
- **Tugas berulang**: harian/mingguan/bulanan/tahunan + pilih hari (Su–Sa).
- Detail modal, badge keterlambatan, tag (max 10).

### 3.5 Keuangan
- **Akun**: Cash/Bank/E-wallet + **deteksi logo otomatis** (BCA, Mandiri Livin, BNI Wondr, DANA, GoPay, SeaBank).
- **Transaksi**: income/expense/**transfer antar-akun**; saldo dihitung ulang otomatis pada create/update/delete (termasuk ganti tipe).
- **Transaksi berulang**: scheduler membuat entri baru (clamp akhir bulan, langsung memengaruhi saldo).
- **Budget** per kategori/bulan (spent dihitung real dari transaksi), progress bar.
- Donut spending-by-category, statistik balance/income/expense bulan ini.

### 3.6 Wishlist & Belanja
- **Wishlist**: prioritas, harga, tag, progress saving, status Purchased, lifecycle.
- **Need**: kuantitas + satuan (kg/pcs/liter), harga × qty, toggle shopping list, **riwayat pembelian**.

### 3.7 Kalender & Reminder
- Kalender gabungan (tugas/goal/reminder/habit) **WIB** — view Bulan/Minggu/Hari/Agenda.
- Reminder sekali/berulang dengan tipe Custom/Task/Bill/Shopping/Goal/Wishlist.
- Panel detail per tanggal, modal tambah reminder dari sel tanggal.

### 3.8 Goal & Habit
- **Goal**: umum & tabungan (unit Rp, panel "Remaining / Needed per month"), auto-complete, deadline, tag.
- **Habit**: frekuensi daily/weekly/monthly, **streak** + best streak (hitung backend pakai tanggal kalender WIB agar anti-drift), strip cek 7 hari (hanya hari ini toggle).

### 3.9 Notes, Pomodoro, Statistik
- **Notes**: dinding masonry, pin, tag, arsip/trash/permanent delete, search.
- **Pomodoro**: 25/5/15 menit, ring timer SVG, long break tiap 4 sesi, transisi otomatis.
- **Statistics**: range 7d/30d/bulan ini/bulan lalu/tahun ini/semua; produktivitas, cash flow, spending donut, **Insights keuangan** (savings rate, budget adherence, MoM, weekend vs weekday).
- **Weekly Review**: kartu produktivitas/habit/keuangan/goal + refleksi mingguan tersimpan.

### 3.10 Lintas-fitur
- **Pencarian global** (Ctrl+K) di 8 koleksi.
- **Quick Add** (tugas/transaksi/catatan/goal/reminder/wishlist/need) + shortcut keyboard.
- **Notifikasi in-app**: reminder jatuh tempo, reminder tugas, **milestone** (budget ≥80%/100%, streak 7/30/100 hari, goal 50%/100%), unread count, browser notification.
- **Ekspor**: CSV transaksi, CSV tugas, **JSON lengkap** (11 koleksi, tanpa data sensitif).
- **Pengaturan**: tema, bahasa, notifikasi per tipe, shortcut reference.
- **Bantuan**: panduan `<details>` accordion + "Recommended Routine" + tombol ulangi tour.

---

## 4. API (Ringkasan Endpoint)

Semua `/api/*` kecuali auth publik dilindungi JWT (`Authorization: Bearer <token>`).

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET/PUT /auth/profile`, `PUT /auth/change-password`, `POST /auth/avatar` |
| Accounts | `GET/POST /accounts`, `PUT/DELETE /accounts/:id` |
| Transactions | `GET/POST /transactions`, `GET /transactions/summary`, `GET/PUT/DELETE /transactions/:id` |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| Budgets | `GET/POST /budgets` (filter `?month=`), `PUT/DELETE /budgets/:id` |
| Goals | `GET/POST /goals`, `PUT/DELETE /goals/:id` |
| Habits | `GET/POST /habits`, `PUT /habits/:id/toggle`, `PUT/DELETE /habits/:id` |
| Tasks | `GET/POST /tasks`, `GET/PUT/DELETE /tasks/:id` |
| Reminders | `GET/POST /reminders`, `PUT/DELETE /reminders/:id` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PUT /read-all`, `PUT /:id/read`, `DELETE /:id` |
| Settings | `GET/PUT /settings` |
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/statistics?range=` |
| Search | `GET /search?q=` |
| Today | `GET /today` |
| Insights | `GET /insights` |
| Weekly Review | `GET/PUT /weekly-review` |
| Export | `GET /export/transactions`, `GET /export/tasks`, `GET /export/all` |

---

## 5. Scheduler (Detail)

| Job | Interval | Kerja |
|---|---|---|
| Reminder scheduler | 30 detik | Reminder jatuh tempo → notifikasi (gate per-tipe di settings) + advance reminder berulang; reminder tugas (`reminderSentAt` null) → notifikasi; milestone budget/streak/goal |
| Recurring transaction | 60 detik | Parent berulang → buat child transaksi + update saldo (idempoten via `parentRecurringId`+`date`) |
| Recurring task | 60 detik | Parent tugas berulang → buat child tugas (idempoten via partial unique index `{user, recurrenceId, dueDate}`) |

Semua job pakai klaim atomik `findOneAndUpdate` agar aman dari restart/tumpang-tindih.

---

## 6. Catatan Teknis Penting

1. **Timezone**: seluruh sistem WIB. `process.env.TZ='Asia/Jakarta'` di `server.js` baris pertama; habit pakai string `YYYY-MM-DD`.
2. **Saldo transaksi** dikelola di controller (`adjustAccountBalance`, `applyTransfer`) — bukan hook model.
3. **Budget.spent** sengaja "stale" — dihitung ulang dari transaksi saat `?month` dikirim.
4. **i18n**: string EN sebagai kunci; `core/i18n/id.ts` berisi kamus Bahasa Indonesia; `{k}` interpolasi.
5. **Google auth**: data identitas hanya diambil dari token yang diverifikasi (`verifyIdToken`), tidak pernah dari klien.
6. **Ekspor JSON** memfilter data sensitif (password/token tidak pernah diekspor).

---

## 7. Kesiapan Production — Current vs TODO

### 7.1 Sudah dikerjakan (kode terimplementasi & terverifikasi di dev)

| Area | Status |
|---|---|
| Password | **bcrypt hash** + migrasi otomatis user plaintext saat login (terverifikasi) |
| Rate limiting | `express-rate-limit` di semua endpoint `/api/auth` |
| Security headers | `helmet` (CSP dimatikan agar GIS tetap berjalan) |
| Halaman reset password | `frontend /reset-password?token=...` (route + komponen + i18n) |
| Scheduler | Endpoint **`POST /api/cron/tick`** (guard header `x-cron-secret`); in-process `setInterval` hanya berjalan di dev (`NODE_ENV !== 'production'`) |
| Vercel scaffolding | `app.js` (Express app), `api/index.js`, `vercel.json`, `environment.production.ts` — file siap, **belum di-deploy** |
| Avatar upload | Abstraksi storage: **Cloudinary bila dikonfigurasi**, fallback folder lokal; hapus otomatis foto lama |

### 7.2 Production TODO (belum selesai — butuh konfigurasi/akun/deploy)

| Area | Yang belum dilakukan |
|---|---|
| `JWT_SECRET` | Di dev sudah kuat; **wajib set nilai kuat di env production** Vercel |
| **Resend (email)** | Kode siap tapi **belum aktif**: butuh `RESEND_API_KEY` + `EMAIL_FROM` + verifikasi domain. Sampai ada key, forgot-password tidak mengirim email (dev masih mengembalikan token) |
| **Cloudinary (avatar)** | Kode siap tapi **belum aktif**: butuh `CLOUDINARY_*` + `UPLOAD_STORAGE=cloudinary`. Saat ini masih memakai folder lokal |
| **cron-job.org (scheduler)** | Endpoint siap tapi **belum berjalan**: butuh `CRON_SECRET` + job cron-job.org → `POST /api/cron/tick` tiap menit |
| Google Cloud | Tambah **Authorized JavaScript origin** produksi `https://<frontend>.vercel.app` |
| Deploy Vercel | 2 project (frontend + backend) + set semua env production (lihat `docs/production-checklist.md`) |
| Monitoring | Console log → Sentry (opsional, setelah live) |
| CI/CD | Belum ada (opsional: GitHub Actions) |

---

## 8. Cara Menjalankan (Dev)

```
# Backend (port 5000)
cd backend
cp .env.example .env   # isi MONGODB_URI, GOOGLE_CLIENT_ID, dll
npm install
npm run dev

# Frontend (port 4200)
cd frontend
npm install
npm start
```

**Test:**
```
cd backend
node scripts/integration-test.js      # 36 cek terhadap server live
node scripts/test-google-login.js     # 22 cek alur Google (mock token)
cd ../frontend
npm test                              # unit test vitest
npm run build                         # build production
```
