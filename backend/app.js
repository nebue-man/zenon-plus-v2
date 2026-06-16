require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const transactionsRouter = require('./routes/transactions');
const commissionsRouter = require('./routes/commissions');
const hierarchyRouter = require('./routes/hierarchy');
const adminRouter = require('./routes/admin');
const bankSlipsRouter = require('./routes/bankSlips');
const { scheduleMontlyReset } = require('./cron/monthlyReset');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Request logging (skip in test environments)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for local ID photo uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global rate limit: 200 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Tight rate limit for login: 10 req/min per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait a minute.' },
});
app.use('/api/v1/auth/login', loginLimiter);

// Health check — no auth, no rate limit
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/transactions', transactionsRouter);
app.use('/api/v1/commissions', commissionsRouter);
app.use('/api/v1/hierarchy', hierarchyRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/bank-slips', bankSlipsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    code: err.code || 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
  });
});

const PORT = parseInt(process.env.PORT || 3001, 10);

app.listen(PORT, () => {
  console.log(`Zenon Plus API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  scheduleMontlyReset();
});

module.exports = app;
