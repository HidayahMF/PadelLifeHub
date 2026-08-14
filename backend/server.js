// Force the application timezone to Asia/Jakarta (UTC+7) BEFORE anything else
// so every `new Date()` local-time operation uses WIB consistently.
process.env.TZ = process.env.TZ || 'Asia/Jakarta';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { startReminderScheduler } = require('./services/reminderScheduler');
const { startRecurringScheduler } = require('./services/recurringScheduler');
const { startTaskScheduler } = require('./services/taskScheduler');

const app = express();

// Ensure the avatar upload directory exists before multer tries to write files.
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

connectDB().then(() => {
  // Schedulers run only after the database is reachable.
  startReminderScheduler();
  startRecurringScheduler();
  startTaskScheduler();
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (avatars) from the uploads directory.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({
    name: 'LifeHub API',
    version: '1.0.0',
    status: 'running',
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/needs', require('./routes/needRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/goals', require('./routes/goalRoutes'));
app.use('/api/habits', require('./routes/habitRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/today', require('./routes/todayRoutes'));
app.use('/api/insights', require('./routes/insightsRoutes'));
app.use('/api/weekly-review', require('./routes/weeklyReviewRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`LifeHub API running on port ${PORT} (TZ: ${process.env.TZ})`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
