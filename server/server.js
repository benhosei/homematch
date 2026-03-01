const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const listingsRouter = require('./routes/listings');
const assistantRouter = require('./routes/assistant');
const locationRouter = require('./routes/location');
const intelligenceRouter = require('./routes/intelligence');
const intentRouter = require('./routes/intent');
const financeRouter = require('./routes/finance');
const moveRouter = require('./routes/move');
const leadsRouter = require('./routes/leads');
const userDataRouter = require('./routes/userData');
const visionRouter = require('./routes/vision');
const agentTrackingRouter = require('./routes/agentTracking');
const notifyRouter = require('./routes/notifications');

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

app.use('/api/listings', listingsRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/location', locationRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/intent', intentRouter);
app.use('/api/finance', financeRouter);
app.use('/api/move', moveRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/user', userDataRouter);
app.use('/api/vision', visionRouter);
app.use('/api/tracking', agentTrackingRouter);
app.use('/api/notify', notifyRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
