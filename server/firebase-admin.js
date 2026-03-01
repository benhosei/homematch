const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Supports: FIREBASE_SERVICE_ACCOUNT env var (JSON string) OR serviceAccountKey.json file
// If neither is available, Firebase features are disabled (server still starts).

let firebaseReady = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
    console.log('[FIREBASE] Initialized from FIREBASE_SERVICE_ACCOUNT env var');
  } else {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
    console.log('[FIREBASE] Initialized from serviceAccountKey.json');
  }
} catch (err) {
  console.warn('[FIREBASE] Not configured:', err.message);
  console.warn('[FIREBASE] User data sync disabled. Set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json.');
  // Do NOT call admin.initializeApp() without credentials — it tries Google
  // metadata server which hangs/crashes on non-Google hosts (Railway, Render, etc.)
}

admin._firebaseReady = firebaseReady;
module.exports = admin;
