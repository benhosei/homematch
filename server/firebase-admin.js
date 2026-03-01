const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Expects GOOGLE_APPLICATION_CREDENTIALS env var pointing to serviceAccountKey.json
// OR you can directly pass the service account key:
//   admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Parse from env var (useful for deployment)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Use service account key file
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (err) {
  console.warn('Firebase Admin SDK init failed:', err.message);
  console.warn('User data sync will not work until Firebase is configured.');
  console.warn('Place your serviceAccountKey.json in the server/ directory.');
  // Initialize without credentials so the server still starts
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

module.exports = admin;
