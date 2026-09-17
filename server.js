require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const securityRoutes = require('./routes/securityRoutes');
const gatePassRoutes = require('./routes/gatePassRoutes');
const masterRoutes = require('./routes/masterRoutes');
const delegateRoutes = require('./routes/delegateRoutes');

const app = express();

// ---------- Core middleware ----------
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for simple static frontend; tighten in production
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// API responses reflect live DB state and must never be cached by the
// browser or an intermediate proxy — otherwise a status change (e.g. an
// approved HOD request) can appear "stuck" for someone else until a cache
// entry expires, even after they refresh.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/gatepass', gatePassRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/delegate-updation', delegateRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'VMS API is running', time: new Date().toISOString() });
});

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, 'public')));

// SPA-style fallback for direct navigation to frontend pages (not /api/*)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Error handling (must be last) ----------
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🏭 ${process.env.APP_NAME || 'VMS'} running at http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

start();

module.exports = app;
