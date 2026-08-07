require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

connectDB();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`LifeHub API running on port ${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
