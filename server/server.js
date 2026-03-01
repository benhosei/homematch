const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Core routes (always available) ────────────────────────────────
const listingsRouter = require('./routes/listings');
const assistantRouter = require('./routes/assistant');
const locationRouter = require('./routes/location');
const intelligenceRouter = require('./routes/intelligence');
const intentRouter = require('./routes/intent');
const financeRouter = require('./routes/finance');
const moveRouter = require('./routes/move');
const leadsRouter = require('./routes/leads');
const visionRouter = require('./routes/vision');
const agentTrackingRouter = require('./routes/agentTracking');

// ─── Optional routes (depend on Firebase / Stripe) ─────────────────
let userDataRouter = null;
let notifyRouter = null;

try {
  userDataRouter = require('./routes/userData');
} catch (err) {
  console.warn('[BOOT] userData routes disabled:', err.message);
}

try {
  notifyRouter = require('./routes/notifications');
} catch (err) {
  console.warn('[BOOT] notification routes disabled:', err.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow frontend origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://homematch.app',
    'https://www.homematch.app',
    /\.netlify\.app$/,
  ],
  credentials: true,
}));
app.use(express.json());

// ─── Mount routes ──────────────────────────────────────────────────
app.use('/api/listings', listingsRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/location', locationRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/intent', intentRouter);
app.use('/api/finance', financeRouter);
app.use('/api/move', moveRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/vision', visionRouter);
app.use('/api/tracking', agentTrackingRouter);

if (userDataRouter) app.use('/api/user', userDataRouter);
if (notifyRouter) app.use('/api/notify', notifyRouter);

// ─── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env_check: {
      has_rapidapi_key: !!process.env.RAPIDAPI_KEY,
      has_rapidapi_host: !!process.env.RAPIDAPI_HOST,
      node_env: process.env.NODE_ENV || 'NOT SET',
      firebase: !!userDataRouter,
      notifications: !!notifyRouter,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
