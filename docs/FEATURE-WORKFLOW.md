# LifeHub — Panduan Menambah Fitur Baru

Panduan end-to-end untuk menambah fitur (backend + frontend), mengikuti pola
yang sudah ada di codebase. Contoh lengkap di sini: fitur **Kata Mutiara
(Quotes)**.

> Deploy otomatis: setiap push ke `master` memicu Vercel membangun ulang
> backend (`lifehub-api`) dan frontend (`lifehub-psi-two`) secara otomatis.
> Kamu cukup mengerjakan fitur → test lokal → push → verifikasi.

---

## Arsitektur singkat

```
backend/                      (Express, Node, MongoDB via Mongoose)
  api/index.js                → entry point Vercel (satu app yang sama)
  app.js                      → mount semua route  /api/<nama>
  models/*.js                 → schema Mongoose
  controllers/*Controller.js  → logika API
  routes/*Routes.js           → daftar endpoint + middleware protect
  services/*.js               → logika terpisah (AI, scheduler, dll)

frontend/                     (Angular, standalone components, lazy loading)
  src/app/features/<fitur>/   → halaman/komponen per fitur
  src/app/core/services/      → service (pola ApiService)
  src/app/core/models/        → tipe/interface model
  src/app/app.routes.ts       → daftar route (lazy loadComponent)
  src/environments/           → apiUrl, googleClientId, siteUrl
```

- Semua data punya scope per-user: setiap dokumen menyimpan `user: ObjectId`,
  dan setiap query difilter `{ user: req.user._id }`.
- Endpoint yang butuh login memakai middleware `protect`
  (`backend/middleware/auth.js`).
- Frontend memanggil API lewat `ApiService`
  (`frontend/src/app/core/services/api.service.ts`) yang otomatis
  menyematkan base URL dari `environment.apiUrl` + token JWT.

---

## 1. Backend — buat API baru (contoh: Quotes)

### 1a. Model — `backend/models/Quote.js`

```js
const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Quote text is required'],
      trim: true,
      maxlength: [500, 'Quote cannot exceed 500 characters'],
    },
    author: {
      type: String,
      default: 'Anonim',
      trim: true,
      maxlength: [100, 'Author cannot exceed 100 characters'],
    },
  },
  { timestamps: true }
);

quoteSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Quote', quoteSchema);
```

> Ganti `Task.js` → `Quote.js`. Setiap fitur mengikuti pola: `user` wajib,
> validasi field, `timestamps: true`, index untuk query umum.

### 1b. Controller — `backend/controllers/quoteController.js`

```js
const Quote = require('../models/Quote');

const getQuotes = async (req, res, next) => {
  try {
    const quotes = await Quote.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    next(err);
  }
};

const createQuote = async (req, res, next) => {
  try {
    const quote = await Quote.create({ user: req.user._id, ...req.body });
    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
};

const deleteQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!quote) {
      res.status(404);
      throw new Error('Quote not found');
    }
    res.json({ message: 'Quote removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getQuotes, createQuote, deleteQuote };
```

> Pola wajib: `try/catch` + `next(err)`, dan **selalu scope ke
> `req.user._id`** — jangan pernah query tanpa filter user.

### 1c. Route — `backend/routes/quoteRoutes.js`

```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getQuotes, createQuote, deleteQuote } = require('../controllers/quoteController');

router.use(protect);

router.route('/').get(getQuotes).post(createQuote);
router.route('/:id').delete(deleteQuote);

module.exports = router;
```

### 1d. Daftarkan di `backend/app.js`

Tambahkan satu baris di blok mount (urutkan sesuai alfabet):

```js
app.use('/api/quotes', require('./routes/quoteRoutes'));
```

Hasil akhir: `GET /api/quotes`, `POST /api/quotes`, `DELETE /api/quotes/:id` —
semuanya butuh token JWT.

### 1e. Test backend

```bash
cd backend
npm test            # unit tests (19 test — wajib lulus)
node -e "require('./app')"   # pastikan app termuat tanpa error
```

Opsional (butuh MongoDB lokal): `node scripts/integration-test.js`.

---

## 2. Frontend — buat UI baru (contoh: Quotes)

### 2a. Model — `frontend/src/app/core/models/quote.model.ts`

```ts
export interface Quote {
  _id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface QuotePayload {
  text: string;
  author?: string;
}
```

### 2b. Service — `frontend/src/app/core/services/quote.service.ts`

Ikuti pola `task.service.ts` (inject `ApiService`):

```ts
import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { Quote, QuotePayload } from '../models/quote.model';

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private api = inject(ApiService);

  readonly quotes = signal<Quote[]>([]);
  readonly loading = signal(false);

  load() {
    this.loading.set(true);
    return this.api.get<Quote[]>('/quotes').subscribe({
      next: (res) => {
        this.quotes.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create(payload: QuotePayload) {
    return this.api.post<Quote>('/quotes', payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/quotes/${id}`);
  }
}
```

### 2c. Komponen — `frontend/src/app/features/quotes/quotes.component.ts`

Semua komponen **standalone**:

```ts
import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { FieldComponent } from '../../layout/components/field.component';
import { ToastService } from '../../core/services/toast.service';
import { QuoteService } from '../../core/services/quote.service';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, PageHeaderComponent, CardComponent, ButtonComponent, FieldComponent],
  template: `
    <app-page-header title="Kata Mutiara" subtitle="Koleksi kalimat motivasi" />
    <app-card>
      <form (ngSubmit)="add()">
        <app-field label="Kata mutiara">
          <input name="text" [(ngModel)]="text" required />
        </app-field>
        <app-button type="submit">Simpan</app-button>
      </form>
      <ul *ngFor="let q of service.quotes()">
        <li>
          "{{ q.text }}" — {{ q.author }}
          <button (click)="remove(q._id)">Hapus</button>
        </li>
      </ul>
    </app-card>
  `,
})
export class QuotesComponent implements OnInit {
  service = inject(QuoteService);
  private toast = inject(ToastService);
  text = '';

  ngOnInit() {
    this.service.load();
  }

  add() {
    if (!this.text.trim()) return;
    this.service.create({ text: this.text }).subscribe({
      next: () => {
        this.text = '';
        this.service.load();
        this.toast.show('Kata mutiara disimpan');
      },
      error: (e) => this.toast.show(e.message, 'error'),
    });
  }

  remove(id: string) {
    this.service.remove(id).subscribe(() => this.service.load());
  }
}
```

> Halaman di dalam aplikasi (setelah login) didaftarkan sebagai **child** dari
> route `app` yang dilindungi `authGuard`.

### 2d. Daftarkan route — `frontend/src/app/app.routes.ts`

Di dalam `children` milik route `app`:

```ts
{
  path: 'quotes',
  loadComponent: () =>
    import('./features/quotes/quotes.component').then((m) => m.QuotesComponent),
},
```

Hasil: halaman bisa dibuka di `https://lifehub-psi-two.vercel.app/app/quotes`.

> Kalau fiturnya **publik** (tanpa login), daftarkan di level atas seperti
> `login`/`about`, dan pasang link-nya di landing
> (`features/public/landing/landing.component.ts`).

### 2e. Test & build frontend

```bash
cd frontend
npm run build    # wajib sukses — kalau gagal Vercel tetap serve build lama
ng test          # opsional, bila ada unit test
```

---

## 3. Kalau fitur butuh env variable baru

1. Tambah ke **`backend/.env`** (lokal, git-ignored — nilai asli).
2. Tambah placeholder ke **`backend/.env.example`** (boleh di-commit).
3. Tambah nilai asli ke **Vercel → project `lifehub-api` → Settings →
   Environment Variables**. Vercel otomatis redeploy setelah env diubah.
4. **Jangan pernah commit `.env`.** Cek dengan:
   ```bash
   git status --short | grep -E "\.env$" && echo "SEKRET TERBUKA!" || echo "aman"
   ```

---

## 4. Commit & deploy

```bash
git add -A
git commit -m "Add Quotes feature (backend API + frontend page)"
git push origin master
```

Vercel otomatis:
- Backend → build + deploy `lifehub-api` (route `/api/quotes` live)
- Frontend → build + deploy `lifehub-psi-two`

Cek status di Vercel dashboard (tunggu banner hijau "Ready" untuk keduanya).

---

## 5. Verifikasi production

1. **Backend:** tes endpoint dengan curl (token dari akun yang sudah ada):
   ```bash
   TOKEN="<jwt dari login>"
   curl -X POST https://lifehub-api.vercel.app/api/quotes \
     -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
     -d '{"text":"Hidup adalah perjalanan.","author":"Anonim"}'
   ```
2. **Frontend:** hard reload (`Ctrl+Shift+R`) → buka `/app/quotes` → coba
   simpan & hapus.
3. Cek browser DevTools → Network: pastikan tidak ada error CORS.

---

## Troubleshooting umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Route not found: /api/quotes` | Deploy masih build lama / route belum ada | Tunggu deploy selesai di dashboard; cek `app.js` sudah mount |
| CORS error di browser | `CLIENT_URL` di Vercel salah/tidak set | Set `CLIENT_URL=https://lifehub-psi-two.vercel.app` (backend log warning otomatis bila invalid) |
| Build frontend gagal | Error TS/template | Perbaiki lokal, pastikan `npm run build` sukses sebelum push |
| Data orang lain muncul | Query tanpa filter `user` | Wajib scope `{ user: req.user._id }` di semua query |
| `Duplicate key` saat tambah field `unique` | Data lama bentrok | Hindari index unique tanpa `partialFilterExpression`; cek data lama |
| Google login `origin_mismatch` | Origin frontend belum ada di OAuth Client | Google Cloud Console → tambah origin ke client ID aktif |

---

## Checklist cepat

- [ ] Backend: model, controller, routes, sudah di-mount di `app.js`
- [ ] Semua query di-scope ke `req.user._id` + `protect`
- [ ] `cd backend && npm test` lulus
- [ ] Frontend: model, service, komponen (standalone), route terdaftar
- [ ] `cd frontend && npm run build` sukses
- [ ] Env baru: `.env` + `.env.example` + Vercel env (bukan sekadar lokal)
- [ ] `git add -A && git commit && git push`
- [ ] Verifikasi di production (curl endpoint + hard reload + cek CORS)
