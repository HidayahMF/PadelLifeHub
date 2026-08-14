# Panduan Penggunaan LifeHub (PadelLifeHub)

> Dokumen ini menjelaskan seluruh fitur website sebagai bahan dasar pembuatan halaman tutorial.
> Setiap bagian bisa dipotong menjadi satu halaman tutorial tersendiri.

---

## 1. Tentang LifeHub

LifeHub adalah **asisten pribadi (personal dashboard)** yang menggabungkan **produktivitas**, **keuangan**, dan **kebiasaan** dalam satu aplikasi. Fungsinya membantu kamu mengatur hari, melacak pengeluaran & tabungan, membangun kebiasaan, dan mengejar target — semua dalam satu tempat.

Modul utama yang dimiliki LifeHub:

| Kategori | Halaman |
|---|---|
| Ringkasan harian | Today |
| Ringkasan menyeluruh | Dashboard |
| Manajemen (Manage) | Tasks, Finance, Wishlist, Needs, Calendar |
| Pengembangan diri (Grow) | Goals, Habits, Notes, Pomodoro, Statistics, Weekly Review |
| Akun & pengaturan | Settings, Profile |

---

## 2. Memulai

### 2.1 Membuat akun
1. Buka halaman **Register** (`/register`).
2. Isi **Nama lengkap**, **Email**, dan **Password** (minimal 6 karakter).
3. Klik **Register**.
4. Akun baru otomatis dibuatkan kategori default (untuk tugas & transaksi) sehingga kamu bisa langsung mencatat.

### 2.2 Masuk (Login)
1. Buka halaman **Login** (`/login`).
2. Masukkan email & password, lalu klik **Login**.
3. Jika lupa password, klik **Forgot password** dan ikuti instruksinya.

### 2.3 Setelah masuk
- Kamu diarahkan ke halaman **Today** — ringkasan hari ini (tugas, keuangan, kebiasaan, tujuan).
- Pastikan mulai dari **Settings** untuk mengatur tema & notifikasi, lalu isi **Finance** (rekening) agar keuangan tercatat.

---

## 3. Navigasi & Pintasan

### 3.1 Sidebar
Menu samping mengelompokkan halaman:
- **Today** & **Dashboard** — ringkasan harian & menyeluruh.
- **Manage** — Tasks, Finance, Wishlist, Needs, Calendar.
- **Grow** — Goals, Habits, Notes, Pomodoro, Statistics, Weekly Review.
- **Bawah** — Settings & Profile.

Di layar kecil (mobile), sidebar menjadi drawer yang terbuka lewat ikon menu di kiri atas. Tekan `Esc` untuk menutupnya.

### 3.2 Topbar
- **Search LifeHub (Ctrl K)** — pencarian global (lihat 3.3).
- **Add** — quick add cepat untuk membuat item (lihat 3.4).
- **Toggle tema** — saklar gelap/terang.
- **Lonceng notifikasi** — badge jumlah belum dibaca; klik untuk membuka panel (filter belum dibaca, tandai semua dibaca, hapus). Notifikasi mengarahkan ke halaman terkait (tugas, habits, finance, calendar, dll).
- **Menu akun** — menuju Profile, Settings, atau Log out.

### 3.3 Global Search (Ctrl K atau `/`)
Mencari di semua data sekaligus: **tugas, habits, goals, catatan, transaksi, reminder, wishlist, needs**.
- Navigasi hasil dengan **↑ / ↓**, buka dengan **Enter**, tutup dengan **Esc**.
- Hasil dikelompokkan per tipe dengan kata kunci disorot.
- Memilih hasil otomatis membuka halaman terkait (mis. tugas → halaman Tasks dengan filter pencarian).

### 3.4 Quick Add (tombol N atau tombol +)
Membuat item cepat tanpa berpindah halaman. Tipe yang didukung: **Task, Transaction, Note, Goal, Reminder, Wishlist, Need**. Isi formulir singkat lalu **Create**; data langsung tersimpan dan panel yang bersangkutan ikut diperbarui.

### 3.5 Pintasan keyboard

| Tombol | Aksi |
|---|---|
| `Ctrl/Cmd + K` atau `/` | Buka pencarian global |
| `N` | Buka Quick Add (Task) |
| `D` | Menuju Dashboard |
| `T` | Menuju Tasks |
| `G` | Menuju Goals |

> Pintasan tidak aktif saat sedang mengetik di kolom input.

---

## 4. Today (Ringkasan Hari Ini)

Halaman pembuka setelah login. Menampilkan:
- **Sapaan** berdasarkan waktu (pagi/siang/sore/malam) + tanggal.
- **Progres hari ini**: Tugas hari ini, Selesai, Kebiasaan selesai (x/y), Net hari ini (+pemasukan / −pengeluaran).
- **Today's focus** — tugas yang jatuh tempo hari ini (tugas terlambat ditandai merah). Centang lingkaran untuk menandai selesai.
- **Today's money** — Pemasukan / Pengeluaran / Net hari ini, dengan tautan ke Finance.
- **Goals** — tujuan aktif dengan progress bar.
- **Habits** — saklar harian; centang lingkaran untuk menandai selesai hari ini.
- **Upcoming** — reminder & tugas mendatang (scroll).

**Cara cepat:** tombol **Task / Transaction / Note** membuka Quick Add; tombol **Focus** membuka halaman Pomodoro.

---

## 5. Dashboard (Ringkasan Menyeluruh)

Dashboard menampilkan widget yang bisa diatur sendiri:
- **Task summary** — pending, selesai hari ini, total, deadline mendatang.
- **Finance summary** — Saldo, Pemasukan bulan ini, Pengeluaran bulan ini, Net bulan ini. Tombol **eye/eye-off** untuk menyembunyikan nominal (tersimpan, jadi tetap tersembunyi di sesi berikutnya).
- **Today's tasks** & **Upcoming deadlines** — tugas hari ini & tenggat mendatang (terlambat = merah).
- **Habits** — kebiasaan + streak.
- **Income vs expense** — grafik batang 6 bulan terakhir.
- **Monthly budget** — progres anggaran bulan ini.
- **Goals** & **Wishlist** — progres tujuan & wishlist.
- **Recent transactions** — transaksi terbaru.

### Mengatur dashboard
1. Klik **Customize**.
2. Atur urutan widget (drag & drop atau tombol naik/turun) dan tampilkan/sembunyikan tiap widget dengan tombol mata.
3. **Reset** untuk kembali ke tata letak default, atau **Save layout** untuk menyimpan.

---

## 6. Tasks (Tugas)

Halaman manajemen tugas dengan pencarian, filter, pin, arsip, dan tugas berulang.

### Membuat tugas
1. Klik **Add task**.
2. Isi: **Judul** (wajib), **Deskripsi**, **Kategori**, **Tenggat (due date)**, **Reminder**, **Ulang (Repeat)**, **Tags** (dipisah koma, maks. 10).
3. Klik **Create**.

### Tugas berulang
- Pilih **Repeat**: Harian / Mingguan / Bulanan / Tahunan.
- Untuk **Mingguan**, pilih hari (Su–Sa); pratinjau "Every Mon, Wed…" muncul otomatis. Tugas berulang akan dibuat ulang otomatis setelah tenggatnya lewat.

### Filter & tampilan
- **Status**: All / To do / Done.
- **Lifecycle**: Active / Archived / Trash (barang di Trash bisa dihapus permanen).
- **Pencarian** teks bebas + filter **Kategori** + filter **Tag** (pills).

### Aksi per tugas
- Lingkaran di kiri → tandai selesai / batalkan.
- Klik judul → edit. Ikon mata → detail. Pin → disematkan di atas. Arsip → pindah ke Archived. Tempat sampah → ke Trash (di Trash = hapus permanen, perlu konfirmasi).

> Tugas terlambat tampil merah dengan label "overdue". Tugas selesai dicoret.

---

## 7. Finance (Keuangan)

Satu halaman berisi saldo, rekening, transaksi, anggaran, dan grafik pengeluaran.

### 7.1 Rekening (Accounts)
- Klik **Add account**.
- Isi: **Nama** (wajib), **Tipe** (Cash / Bank / E-wallet), **Saldo**.
- Logo bank/e-wallet terdeteksi otomatis dari nama (BCA, Mandiri, DANA, GoPay, SeaBank, dll).
- Edit / hapus per rekening (hapus perlu konfirmasi).

### 7.2 Transaksi
1. Klik **Add transaction** (atau tombol +).
2. Pilih tipe: **Income / Expense / Transfer**.
3. Isi **Jumlah** (wajib, > 0), **Deskripsi**.
   - **Transfer**: pilih **Dari rekening** dan **Ke rekening** (harus berbeda).
   - **Income/Expense**: pilih **Kategori** (wajib untuk Expense, memengaruhi progres budget), **Rekening** (mengubah saldo), **Tanggal**, dan **Repeat** (untuk transaksi berulang).
4. Klik **Save**.

**Filter:** tipe (All/Income/Expense/Transfer), rekening, dan kategori.

### 7.3 Anggaran (Budgets)
- Gunakan panah ‹ › untuk pindah bulan.
- Klik **+** untuk menambah anggaran: pilih **Kategori** (atau "Overall" = semua kategori) dan **Jumlah** (wajib). Kategori yang sama tidak boleh dibuat dua kali di bulan yang sama.
- Baris anggaran menampilkan `terpakai / jumlah` dengan progress bar.

### 7.4 Grafik
- **Spending by category** — donat pengeluaran bulan ini per kategori.

---

## 8. Wishlist (Daftar Keinginan)

Grid kartu untuk barang yang sedang kamu tabung.
1. Klik **Add wish**.
2. Isi: **Nama** (wajib), **Harga** (wajib), **Tersimpan (Saved so far)**, **Prioritas** (Low/Medium/High), **Tanggal target**, **Link** (URL), **Tags**.
3. Perbarui **Saved so far** dari waktu ke waktu; progress bar menunjukkan persentase `tersimpan / harga`.
4. Tombol **Purchased** → barang ditandai dibeli (progress = 100%).

**Tampilan:** Active / Archived / Trash; status All / Saving / Purchased; filter tag. Ringkasan "X saved of Y" di atas daftar.

---

## 9. Needs (Kebutuhan Rumah Tangga)

Daftar belanja/perlengkapan rumah dengan jumlah, harga, dan riwayat pembelian.
1. Klik **Add item**.
2. Isi: **Nama** (wajib), **Jumlah**, **Satuan** (kg/pcs/liter), **Harga**, **Kategori** (teks bebas), dan saklar **Add to shopping list**.
3. Centang lingkaran untuk menandai **purchased** (tercoret); centang lagi untuk mengembalikan ke daftar.
4. Baris menampilkan total (`harga × jumlah`) dan riwayat: "Purchased N× · last <tanggal>".

**Tampilan:** All / Shopping list / Purchased dengan penghitung "X of Y purchased".

---

## 10. Calendar (Kalender & Reminder)

Kalender gabungan untuk **tugas, goals, habits, dan reminder** (zona waktu Asia/Jakarta).
- **Tampilan**: Month / Week / Day / Agenda.
- Klik tanggal untuk melihat detail hari itu di panel bawah; tambah reminder langsung dari sana.
- Klik item → modal detail acara. Tugas bisa **Mark complete** langsung dari modal.

### Membuat reminder
1. Klik **New reminder** (default tanggal terpilih pukul 09:00).
2. Isi: **Judul** (wajib), **Tanggal & waktu** (wajib), **Tipe** (Custom/Task/Bill/Shopping/Goal/Wishlist), **Repeat** (Sekali/Harian/Mingguan/Bulanan/Tahunan).

---

## 11. Goals (Tujuan)

Pelacakan target dengan progress bar dan matematika target tabungan.
1. Klik **New goal**.
2. Isi: **Judul** (wajib), **Deskripsi**, **Tipe** (General goal / Savings goal), **Target** (angka; untuk savings = target uang Rp), **Unit** (otomatis "Rp" untuk savings, mis. km/buku/kali untuk umum), **Progress**, **Deadline**, **Tags**.
3. Untuk **Savings goal** muncul kotak khusus: **Remaining** (sisa) dan **Needed/month** (nominal per bulan agar tercapai tepat waktu).
4. **Complete** menandai selesai (progress = target).

**Tampilan:** Active / Archived / Trash; status All / Active / Done; penghitung "X completed".

---

## 12. Habits (Kebiasaan)

Membangun kebiasaan dengan streak dan strip cek 7 hari.
1. Klik **New habit**.
2. Isi: **Nama** (wajib), **Deskripsi**, **Frekuensi** (Daily / Weekly / Monthly).
3. Klik **Mark done** untuk mencatat hari ini; **Undo** untuk membatalkan. Hanya hari ini yang bisa diubah — 6 hari sebelumnya tampil sebagai riwayat.
4. Kartu menampilkan api 🔥 saat selesai hari ini, "Frequency · N day streak", dan strip 7 hari.

**Tampilan:** Active / Archived.

---

## 13. Notes (Catatan)

Dinding catatan bergaya masonry (1/2/3 kolom) dengan pencarian & pin.
1. Klik **New note**.
2. Isi **Judul** (opsional, kosong = "Untitled") dan **Konten**; **Tags** dipisah koma.
3. Klik kartu untuk mengedit. Hover kartu menampilkan aksi: **edit, pin, arsip, hapus**.
4. Catatan yang di-pin tampil di atas dengan latar utama. Urutan: pin dulu, lalu terbaru diubah.

**Tampilan:** Active / Archived / Trash; pencarian mencocokkan judul & isi; filter tag (tersembunyi di Trash).

---

## 14. Pomodoro (Fokus)

Timer 3 mode dengan siklus fokus/istirahat otomatis (berjalan di browser, tidak disimpan).
- **Focus** 25:00, **Short break** 5:00, **Long break** 15:00.
- Klik **Start** untuk mulai / **Pause** untuk jeda; **Reset** mengulang.
- Setelah sesi fokus → otomatis short break; setelah **4 sesi** → long break; istirahat selesai → kembali fokus.
- Penghitung "N focus session(s) completed today" (reset saat halaman dimuat ulang).

---

## 15. Statistics (Statistik)

Analitik produktivitas & keuangan berdasarkan rentang waktu.
1. Pilih rentang: **7 days / 30 days / This month / Last month / This year / All time**.
2. Lihat: **Total tasks**, **Completed tasks**, **Completed this week**, **Completed this month**.
3. **Weekly activity** — grafik garis tugas selesai per hari (7 hari terakhir).
4. **Cash flow** — grafik garis pemasukan − pengeluaran per periode.
5. **Spending by category** — donat pengeluaran per kategori.
6. **Financial insights** — analisis otomatis: belanja akhir pekan vs hari biasa, tingkat tabungan vs bulan lalu, kategori pengeluaran terbesar, perubahan pengeluaran bulanan, kepatuhan budget, dan tren arus kas.
7. **Financial summary** — total pemasukan/pengeluaran, saldo semua rekening, dan persentase penyelesaian tugas.

---

## 16. Weekly Review (Tinjauan Mingguan)

Ringkasan statistik minggu ini + jurnal refleksi pribadi.
- **Produktivitas**: Selesai, Dibuat, Terlambat, % penyelesaian.
- **Habits**: streak terbaik, % penyelesaian rata-rata, jumlah kebiasaan dilacak.
- **Finance**: Pemasukan, Pengeluaran, Ditabung, kategori pengeluaran terbesar.
- **Goals**: tujuan yang berkembang & selesai.
- **Refleksi**: dua kolom teks — "What went well?" dan "What should you improve next week?". Klik **Save review**; tulisan tersimpan per minggu dan dimuat ulang saat dibuka kembali (bersifat pribadi).

---

## 17. Settings (Pengaturan)

- **Appearance**: saklar **Dark mode**, **Theme** (Light/Dark/System), **Language** (English/Bahasa Indonesia/Bahasa Melayu — segera hadir, sementara dinonaktifkan).
- **Keyboard shortcuts**: daftar referensi pintasan.
- **Export data**:
  - **Transactions CSV** → `lifehub-transactions-<waktu>.csv`
  - **Tasks CSV** → `lifehub-tasks-<waktu>.csv`
  - **Export my LifeHub data (JSON)** → `lifehub-data-<waktu>.json` (tidak menyertakan password/rahasia).
- **Notifications**: saklar **Task reminders**, **Bill reminders**, **Habit reminders**, **Email updates** (default: aktif, aktif, aktif, nonaktif).
- Klik **Save changes** untuk menyimpan.

---

## 18. Profile (Profil)

- **Avatar**: klik ikon kamera → **Choose image** (JPG/PNG/WebP/GIF, maks. 3MB) → pratinjau → **Save**. Jika avatar sudah ada, tersedia tombol **Remove**.
- **Personal information**: **Nama lengkap** (wajib; kosong tidak diizinkan) dan **Email** (hanya baca).
- **Change password**: isi **Current password** dan **New password** (min. 6 karakter) → **Update password**.
- Menampilkan **Member since** (tanggal daftar).

---

## 19. Siklus Data yang Perlu Dipahami

- **Arsip vs Sampah**: Arsip menyembunyikan item tanpa menghapusnya; Sampah menyimpan item sebelum dihapus permanen. Keduanya bisa dipulihkan.
- **Transaksi berulang & tugas berulang**: dibuat otomatis sesuai frekuensi; di daftar ada badge "repeat".
- **Avatar/upload** hanya menerima gambar JPG/PNG/WebP/GIF maks 3MB.
- **Zona waktu** sistem: Asia/Jakarta (WIB).

---

## 20. Alur Penggunaan yang Disarankan (Daily Routine)

1. Pagi → buka **Today**: cek tugas & net keuangan hari ini.
2. Selesaikan tugas → centang di **Tasks** atau **Today**.
3. Catat pengeluaran → **Finance** (transaksi) atau Quick Add.
4. Jaga kebiasaan → centang **Habits**.
5. Fokus kerja → **Pomodoro**.
6. Minggu → **Weekly Review** untuk refleksi.
7. Bulan → **Statistics** untuk melihat perkembangan jangka panjang.
