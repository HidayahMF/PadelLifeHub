// Seed a fully-populated demo account: demo@gmail.com / 123456
//
// Creates the user plus realistic dummy data for every tab: tasks, calendar,
// finance (accounts/transactions/budgets), wishlist, needs, notes, goals,
// habits, reminders, notifications, weekly review, and settings.
//
// Idempotent: if the demo user already exists, its data is wiped and reseeded.
//
// Run: node scripts/seed-demo-account.cjs

process.env.TZ = process.env.TZ || 'Asia/Jakarta';
require('dotenv').config();

const mongoose = require('mongoose');
const { nextOccurrence } = require('../services/taskScheduler');

const DEMO_EMAIL = 'demo@gmail.com';
const DEMO_PASSWORD = '123456';
const DEMO_NAME = 'Demo User';

// ── date helpers (all in Asia/Jakarta) ──────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const toLocal = (d) => ({
  y: d.getFullYear(),
  m: d.getMonth(),
  d: d.getDate(),
  h: d.getHours(),
  min: d.getMinutes(),
});
const daysAgo = (n, h = 10, min = 0) => {
  const now = new Date();
  const { y, m, d } = toLocal(now);
  const base = new Date(y, m, d - n, h, min, 0, 0);
  return base;
};
const dateStr = (n) => {
  const { y, m, d } = toLocal(daysAgo(n, 0, 0));
  return `${y}-${pad(m + 1)}-${pad(d)}`;
};
const monthStr = (offset = 0) => {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
};
const atTime = (n, h, min) => daysAgo(n, h, min);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log('[seed] connected');

  const User = require('../models/User');
  const Category = require('../models/Category');
  const Account = require('../models/Account');
  const Transaction = require('../models/Transaction');
  const Budget = require('../models/Budget');
  const Task = require('../models/Task');
  const Wishlist = require('../models/Wishlist');
  const Need = require('../models/Need');
  const Note = require('../models/Note');
  const Goal = require('../models/Goal');
  const Habit = require('../models/Habit');
  const Reminder = require('../models/Reminder');
  const Notification = require('../models/Notification');
  const Setting = require('../models/Setting');
  const WeeklyReview = require('../models/WeeklyReview');

  // ── wipe any previous demo account + data ────────────────────────────────
  const existing = await User.findOne({ email: DEMO_EMAIL }).select('_id');
  if (existing) {
    const id = existing._id;
    const models = [
      Category, Account, Transaction, Budget, Task, Wishlist, Need, Note,
      Goal, Habit, Reminder, Notification, Setting, WeeklyReview,
    ];
    for (const model of models) {
      await model.deleteMany({ user: id });
    }
    await User.deleteOne({ _id: id });
    console.log('[seed] removed previous demo account + data');
  }

  // ── user ─────────────────────────────────────────────────────────────────
  const user = await User.create({
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    provider: 'email',
  });
  console.log(`[seed] demo user created (${DEMO_EMAIL})`);

  // ── categories ───────────────────────────────────────────────────────────
  const taskCats = await Category.insertMany([
    { user: user._id, name: 'Pekerjaan', color: '#6366f1', icon: 'briefcase', type: 'task' },
    { user: user._id, name: 'Belajar', color: '#f59e0b', icon: 'book-open', type: 'task' },
    { user: user._id, name: 'Olahraga', color: '#ef4444', icon: 'dumbbell', type: 'task' },
    { user: user._id, name: 'Rumah', color: '#8b5cf6', icon: 'home', type: 'task' },
    { user: user._id, name: 'Personal', color: '#06b6d4', icon: 'user', type: 'task' },
    { user: user._id, name: 'Kesehatan', color: '#10b981', icon: 'heart-pulse', type: 'task' },
  ]);
  const txnCats = await Category.insertMany([
    { user: user._id, name: 'Gaji', color: '#10b981', icon: 'wallet', type: 'transaction' },
    { user: user._id, name: 'Freelance', color: '#22c55e', icon: 'briefcase', type: 'transaction' },
    { user: user._id, name: 'Makanan', color: '#f59e0b', icon: 'utensils', type: 'transaction' },
    { user: user._id, name: 'Transportasi', color: '#3b82f6', icon: 'car', type: 'transaction' },
    { user: user._id, name: 'Hiburan', color: '#ec4899', icon: 'film', type: 'transaction' },
    { user: user._id, name: 'Belanja', color: '#8b5cf6', icon: 'shopping-bag', type: 'transaction' },
    { user: user._id, name: 'Tagihan', color: '#ef4444', icon: 'receipt', type: 'transaction' },
    { user: user._id, name: 'Kesehatan & Obat', color: '#10b981', icon: 'heart-pulse', type: 'transaction' },
  ]);
  const cat = (list, name) => list.find((c) => c.name === name)._id;
  console.log(`[seed] categories: ${taskCats.length + txnCats.length}`);

  // ── accounts ─────────────────────────────────────────────────────────────
  const [cash, bca, gopay] = await Account.insertMany([
    { user: user._id, name: 'Tunai', type: 'cash', balance: 1250000, currency: 'IDR' },
    { user: user._id, name: 'BCA', type: 'bank', balance: 15300000, currency: 'IDR' },
    { user: user._id, name: 'GoPay', type: 'ewallet', balance: 875000, currency: 'IDR' },
  ]);
  console.log('[seed] accounts: 3');

  // ── transactions ─────────────────────────────────────────────────────────
  const txnSeeds = [
    { n: 0,  desc: 'Makan siang',            amt: 45000,   type: 'expense', cat: 'Makanan',       acc: 'Tunai' },
    { n: 0,  desc: 'Kopi & cemilan',          amt: 25000,   type: 'expense', cat: 'Makanan',       acc: 'GoPay' },
    { n: 1,  desc: 'Bensin',                  amt: 100000,  type: 'expense', cat: 'Transportasi',  acc: 'Tunai' },
    { n: 1,  desc: 'Grab ke kantor',          amt: 35000,   type: 'expense', cat: 'Transportasi',  acc: 'GoPay' },
    { n: 2,  desc: 'Gaji bulanan',            amt: 5000000, type: 'income',  cat: 'Gaji',          acc: 'BCA', recurring: 'monthly' },
    { n: 2,  desc: 'Belanja mingguan',        amt: 350000,  type: 'expense', cat: 'Belanja',       acc: 'BCA' },
    { n: 3,  desc: 'Nonton film',             amt: 120000,  type: 'expense', cat: 'Hiburan',       acc: 'BCA' },
    { n: 4,  desc: 'Makan bersama teman',     amt: 180000,  type: 'expense', cat: 'Makanan',       acc: 'GoPay' },
    { n: 5,  desc: 'Pindah dana ke BCA',      amt: 500000,  type: 'transfer', acc: 'GoPay', toAcc: 'BCA' },
    { n: 6,  desc: 'Token listrik',           amt: 200000,  type: 'expense', cat: 'Tagihan',       acc: 'GoPay' },
    { n: 7,  desc: 'Internet bulanan',        amt: 450000,  type: 'expense', cat: 'Tagihan',       acc: 'BCA' },
    { n: 9,  desc: 'Vitamin & obat',          amt: 85000,   type: 'expense', cat: 'Kesehatan & Obat', acc: 'Tunai' },
    { n: 11, desc: 'Belanja baju',            amt: 400000,  type: 'expense', cat: 'Belanja',       acc: 'BCA' },
    { n: 12, desc: 'Freelance desain logo',   amt: 750000,  type: 'income',  cat: 'Freelance',     acc: 'BCA' },
    { n: 13, desc: 'Makan siang',             amt: 50000,   type: 'expense', cat: 'Makanan',       acc: 'Tunai' },
    { n: 15, desc: 'Transport busway',        amt: 20000,   type: 'expense', cat: 'Transportasi',  acc: 'Tunai' },
    { n: 16, desc: 'Kopi',                    amt: 25000,   type: 'expense', cat: 'Makanan',       acc: 'GoPay' },
    { n: 18, desc: 'Main bowling',            amt: 150000,  type: 'expense', cat: 'Hiburan',       acc: 'BCA' },
    { n: 20, desc: 'Sembako',                 amt: 280000,  type: 'expense', cat: 'Belanja',       acc: 'BCA' },
    { n: 22, desc: 'Listrik',                 amt: 200000,  type: 'expense', cat: 'Tagihan',       acc: 'GoPay' },
    { n: 24, desc: 'Makan mie ayam',          amt: 30000,   type: 'expense', cat: 'Makanan',       acc: 'Tunai' },
    { n: 26, desc: 'Ojek online',             amt: 50000,   type: 'expense', cat: 'Transportasi',  acc: 'GoPay' },
    { n: 28, desc: 'Gaji bulan lalu',         amt: 5000000, type: 'income',  cat: 'Gaji',          acc: 'BCA', recurring: 'monthly' },
    { n: 29, desc: 'Belanja alat tulis',      amt: 75000,   type: 'expense', cat: 'Belanja',       acc: 'Tunai' },
    { n: 31, desc: 'Nonton konser',           amt: 250000,  type: 'expense', cat: 'Hiburan',       acc: 'BCA' },
    { n: 34, desc: 'Makanan kucing',          amt: 95000,   type: 'expense', cat: 'Belanja',       acc: 'BCA' },
    { n: 36, desc: 'Bensin',                  amt: 100000,  type: 'expense', cat: 'Transportasi',  acc: 'Tunai' },
    { n: 38, desc: 'Kopi',                    amt: 25000,   type: 'expense', cat: 'Makanan',       acc: 'GoPay' },
    { n: 40, desc: 'Freelance website',       amt: 1200000, type: 'income',  cat: 'Freelance',     acc: 'BCA' },
    { n: 41, desc: 'Sembako',                 amt: 300000,  type: 'expense', cat: 'Belanja',       acc: 'BCA' },
    { n: 44, desc: 'Internet bulan lalu',     amt: 450000,  type: 'expense', cat: 'Tagihan',       acc: 'BCA' },
    { n: 45, desc: 'Makan siang',             amt: 45000,   type: 'expense', cat: 'Makanan',       acc: 'Tunai' },
  ];
  for (const s of txnSeeds) {
    const doc = {
      user: user._id,
      type: s.type,
      amount: s.amt,
      description: s.desc,
      date: daysAgo(s.n),
    };
    if (s.type === 'transfer') {
      doc.fromAccount = (s.acc === 'GoPay' ? gopay : bca)._id;
      doc.toAccount = (s.toAcc === 'BCA' ? bca : gopay)._id;
    } else {
      doc.category = s.cat ? cat(txnCats, s.cat) : null;
      doc.account = (s.acc === 'Tunai' ? cash : s.acc === 'BCA' ? bca : gopay)._id;
      if (s.recurring) {
        doc.recurring = { isRecurring: true, frequency: s.recurring };
        const next = new Date();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1, 1);
        next.setHours(0, 0, 0, 0);
        doc.nextRunAt = next;
      }
    }
    await Transaction.create(doc);
  }
  console.log(`[seed] transactions: ${txnSeeds.length}`);

  // ── budgets (this month) ─────────────────────────────────────────────────
  await Budget.insertMany([
    { user: user._id, category: cat(txnCats, 'Makanan'), amount: 1000000, month: monthStr() },
    { user: user._id, category: cat(txnCats, 'Transportasi'), amount: 500000, month: monthStr() },
    { user: user._id, category: cat(txnCats, 'Hiburan'), amount: 500000, month: monthStr() },
    { user: user._id, category: cat(txnCats, 'Belanja'), amount: 1500000, month: monthStr() },
    { user: user._id, category: cat(txnCats, 'Tagihan'), amount: 1200000, month: monthStr() },
    { user: user._id, category: cat(txnCats, 'Kesehatan & Obat'), amount: 300000, month: monthStr() },
  ]);
  console.log('[seed] budgets: 6');

  // ── tasks ────────────────────────────────────────────────────────────────
  const mkRecurring = (frequency, dueDate, daysOfWeek = []) => {
    const recurring = { isRecurring: true, frequency, daysOfWeek };
    return { recurring, nextOccurrence: nextOccurrence(dueDate, frequency, daysOfWeek) };
  };
  const today = new Date();
  const taskSeeds = [
    { title: 'Menyelesaikan laporan proyek', desc: 'Revisi final sebelum deadline', priority: 'high', status: 'in-progress', due: 0, rem: 0, cat: 'Pekerjaan', pinned: true, tags: ['kerja', 'penting'] },
    { title: 'Meeting tim mingguan', desc: '', priority: 'medium', status: 'todo', due: 0, cat: 'Pekerjaan', tags: ['kerja'] },
    { title: 'Olahraga pagi', desc: 'Lari 3km di taman', priority: 'medium', status: 'completed', due: 0, cat: 'Olahraga', completed: true },
    { title: 'Belajar TypeScript lanjutan', desc: 'Bab generics & utility types', priority: 'medium', status: 'todo', due: 1, cat: 'Belajar', tags: ['belajar'] },
    { title: 'Belanja kebutuhan mingguan', desc: 'Sayur, buah, lauk', priority: 'low', status: 'todo', due: 2, cat: 'Rumah' },
    { title: 'Renovasi kamar', desc: 'Cat ulang + tambah lampu', priority: 'low', status: 'todo', due: 5, cat: 'Rumah' },
    { title: 'Bayar tagihan listrik', desc: 'Bulanan', priority: 'high', status: 'todo', due: 7, cat: 'Rumah' },
    { title: 'Ganti oli motor', desc: '', priority: 'medium', status: 'todo', due: 3, rem: 3, cat: 'Personal' },
    { title: 'Membaca buku 20 halaman', desc: 'Atomic Habits', priority: 'low', status: 'completed', due: 1, cat: 'Personal', completed: true },
    { title: 'Kontrol rutin kesehatan', desc: 'Cek tensi & lab tahunan', priority: 'high', status: 'todo', due: 14, cat: 'Kesehatan' },
    { title: 'Stretching harian', desc: 'Pemanasan ringan', priority: 'low', status: 'in-progress', due: 0, cat: 'Olahraga', recurring: 'daily' },
  ];
  for (const s of taskSeeds) {
    const dueDate = daysAgo(s.due);
    const doc = {
      user: user._id,
      title: s.title,
      description: s.desc || '',
      priority: s.priority,
      status: s.status,
      dueDate,
      category: s.cat ? cat(taskCats, s.cat) : null,
      pinned: !!s.pinned,
      tags: s.tags || [],
      reminder: s.rem !== undefined ? atTime(s.rem, 9, 0) : null,
      reminderSentAt: null,
      completedAt: s.completed ? new Date() : null,
    };
    if (s.recurring) Object.assign(doc, mkRecurring(s.recurring, dueDate));
    await Task.create(doc);
  }
  await Task.create({ user: user._id, title: 'Proyek lama (selesai)', description: '', priority: 'low', status: 'completed', dueDate: daysAgo(20), category: cat(taskCats, 'Pekerjaan'), completedAt: daysAgo(19), trashed: true });
  console.log(`[seed] tasks: ${taskSeeds.length + 1}`);

  // ── wishlist ─────────────────────────────────────────────────────────────
  const in4Months = new Date(); in4Months.setMonth(in4Months.getMonth() + 4);
  const in2Months = new Date(); in2Months.setMonth(in2Months.getMonth() + 2);
  await Wishlist.insertMany([
    { user: user._id, name: 'Laptop MacBook Air', price: 18000000, priority: 'high', savingProgress: 5000000, targetDate: in4Months, status: 'in-progress', tags: ['tech', 'kerja'], link: '' },
    { user: user._id, name: 'Kamera Sony', price: 9500000, priority: 'medium', savingProgress: 1200000, targetDate: in4Months, status: 'in-progress', tags: ['hobi'] },
    { user: user._id, name: 'Headphone ANC', price: 3000000, priority: 'low', savingProgress: 0, status: 'saved', tags: ['tech'] },
    { user: user._id, name: 'Kulkas baru', price: 5500000, priority: 'high', savingProgress: 5500000, status: 'purchased', tags: ['rumah'] },
  ]);
  console.log('[seed] wishlist: 4');

  // ── needs ────────────────────────────────────────────────────────────────
  await Need.insertMany([
    { user: user._id, name: 'Beras 5kg', quantity: 2, unit: 'kg', price: 60000, category: 'Sembako', onShoppingList: true, purchased: false },
    { user: user._id, name: 'Minyak goreng 1L', quantity: 3, unit: 'pcs', price: 17000, category: 'Sembako', onShoppingList: true, purchased: false },
    { user: user._id, name: 'Shampoo', quantity: 1, unit: 'pcs', price: 25000, category: 'Perawatan', onShoppingList: true, purchased: false },
    { user: user._id, name: 'Pasta gigi', quantity: 1, unit: 'pcs', price: 18000, category: 'Perawatan', onShoppingList: false, purchased: true, purchaseHistory: [{ date: daysAgo(6), quantity: 1, price: 18000 }] },
    { user: user._id, name: 'Kantong belanja', quantity: 4, unit: 'pcs', price: 5000, category: 'Rumah', onShoppingList: true, purchased: false },
  ]);
  console.log('[seed] needs: 5');

  // ── notes ────────────────────────────────────────────────────────────────
  await Note.insertMany([
    { user: user._id, title: 'Ide aplikasi baru', content: 'Fitur kolaborasi tim untuk LifeHub — shared task list dengan notifikasi.', pinned: true, tags: ['ide', 'produk'] },
    { user: user._id, title: 'Catatan rapat mingguan', content: 'Sprint berikutnya fokus ke optimasi performa dashboard dan dark mode.', tags: ['kerja'] },
    { user: user._id, title: 'Resep nasi goreng', content: 'Bawang merah, bawang putih, telur, kecap, ayam suwir, cabai.', tags: ['memasak'] },
    { user: user._id, title: 'Draft lama', content: 'Tidak dipakai.', trashed: true },
  ]);
  console.log('[seed] notes: 4');

  // ── goals ────────────────────────────────────────────────────────────────
  const goalDeadline = new Date(); goalDeadline.setMonth(goalDeadline.getMonth() + 3);
  await Goal.insertMany([
    { user: user._id, title: 'Belajar Machine Learning', description: 'Selesaikan course dasar + 1 mini project', kind: 'general', target: 100, unit: '%', progress: 40, deadline: goalDeadline, tags: ['belajar'] },
    { user: user._id, title: 'Dana Darurat 10 juta', description: 'Tabungan untuk 3 bulan pengeluaran', kind: 'savings', target: 10000000, unit: 'IDR', progress: 4500000, deadline: in4Months, tags: ['finansial'] },
    { user: user._id, title: 'Lulus ujian sertifikasi', description: '', kind: 'general', target: 100, unit: '%', progress: 100, completed: true, deadline: daysAgo(10), tags: ['belajar'] },
  ]);
  console.log('[seed] goals: 3');

  // ── habits ───────────────────────────────────────────────────────────────
  const lastNDates = (n, skip = []) => {
    const out = [];
    for (let i = 0; i < n; i++) if (!skip.includes(i)) out.push(dateStr(i));
    return out;
  };
  await Habit.insertMany([
    { user: user._id, name: 'Minum air 8 gelas', description: 'Hidrasi harian', frequency: 'daily', completedDates: lastNDates(7), streak: 7, bestStreak: 12 },
    { user: user._id, name: 'Olahraga 30 menit', description: '', frequency: 'daily', completedDates: lastNDates(6, [1]), streak: 5, bestStreak: 9 },
    { user: user._id, name: 'Baca buku 20 halaman', description: '', frequency: 'daily', completedDates: lastNDates(3), streak: 3, bestStreak: 6 },
    { user: user._id, name: 'Menabung mingguan', description: '', frequency: 'weekly', completedDates: [dateStr(7), dateStr(14), dateStr(21), dateStr(28)], streak: 4, bestStreak: 5 },
  ]);
  console.log('[seed] habits: 4');

  // ── reminders ────────────────────────────────────────────────────────────
  await Reminder.insertMany([
    { user: user._id, title: 'Bayar listrik', datetime: atTime(1, 10, 0), type: 'bill', recurring: { isRecurring: true, frequency: 'monthly' }, sent: false },
    { user: user._id, title: 'Minum obat', datetime: atTime(0, 12, 30), type: 'custom', sent: false },
    { user: user._id, title: 'Ganti oli motor', datetime: atTime(3, 9, 0), type: 'custom', sent: false },
    { user: user._id, title: 'Review mingguan', datetime: atTime(1, 18, 0), type: 'task', sent: true },
  ]);
  console.log('[seed] reminders: 4');

  // ── notifications ─────────────────────────────────────────────────────────
  await Notification.insertMany([
    { user: user._id, title: 'Tugas selesai', message: 'Olahraga pagi ditandai selesai.', type: 'task', read: false },
    { user: user._id, title: 'Pengingat', message: 'Minum obat jam 12:30.', type: 'reminder', read: false },
    { user: user._id, title: 'Tagihan jatuh tempo', message: 'Internet bulanan belum dibayar.', type: 'bill', read: true },
    { user: user._id, title: 'Streak baru!', message: 'Minum air: 7 hari berturut-turut.', type: 'habit', read: false },
  ]);
  console.log('[seed] notifications: 4');

  // ── weekly review (this week) ────────────────────────────────────────────
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 0, 0, 0, 0);
  await WeeklyReview.create({
    user: user._id,
    weekStart: monday,
    wentWell: 'Menyelesaikan laporan proyek dan rutin olahraga 5 hari.',
    improve: 'Kurangi jajan kopi, lebih hemat.',
  });
  console.log('[seed] weekly review: 1');

  // ── settings ─────────────────────────────────────────────────────────────
  await Setting.create({
    user: user._id,
    theme: 'default',
    darkMode: false,
    language: 'id',
    notifications: { taskReminders: true, billReminders: true, habitReminders: true, emailUpdates: false },
    hideBalance: false,
    onboarding: { status: 'completed', completedAt: new Date() },
  });
  console.log('[seed] settings: 1');

  // ── verify login works ───────────────────────────────────────────────────
  const created = await User.findOne({ email: DEMO_EMAIL }).select('+password');
  const ok = created ? await created.matchPassword(DEMO_PASSWORD) : false;
  if (!ok) throw new Error('password verification failed');

  await mongoose.disconnect();
  console.log('\n[seed] DONE — login with demo@gmail.com / 123456');
  console.log('[seed] all tabs populated (tasks, calendar, finance, wishlist, needs, notes, goals, habits, reminders, notifications, weekly review, settings)');
}

run().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
