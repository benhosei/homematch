const express = require('express');
const router = express.Router();
const admin = require('../firebase-admin');
const requireAuth = require('../middleware/requireAuth');

if (!admin._firebaseReady) {
  throw new Error('Firebase not configured — userData routes disabled');
}

const db = admin.firestore();

// GET /api/user/data — Load all user data
router.get('/data', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.uid).get();
    if (!doc.exists) {
      return res.json({
        favorites: [],
        preferences: null,
        savedSearches: [],
        clickHistory: [],
      });
    }
    res.json(doc.data());
  } catch (err) {
    console.error('Load user data error:', err);
    res.status(500).json({ error: 'Failed to load user data' });
  }
});

// PUT /api/user/data — Save all user data (full replace, used for merge-on-login)
router.put('/data', requireAuth, async (req, res) => {
  try {
    const { favorites, preferences, savedSearches, clickHistory } = req.body;
    await db.collection('users').doc(req.uid).set(
      {
        favorites: favorites || [],
        preferences: preferences || null,
        savedSearches: savedSearches || [],
        clickHistory: clickHistory || [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Save user data error:', err);
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

// PATCH /api/user/favorites — Update just favorites
router.patch('/favorites', requireAuth, async (req, res) => {
  try {
    const { favorites } = req.body;
    await db.collection('users').doc(req.uid).set(
      { favorites, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update favorites error:', err);
    res.status(500).json({ error: 'Failed to update favorites' });
  }
});

// PATCH /api/user/preferences — Update just preferences
router.patch('/preferences', requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body;
    await db.collection('users').doc(req.uid).set(
      { preferences, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// PATCH /api/user/saved-searches — Update just saved searches
router.patch('/saved-searches', requireAuth, async (req, res) => {
  try {
    const { savedSearches } = req.body;
    await db.collection('users').doc(req.uid).set(
      { savedSearches, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update saved searches error:', err);
    res.status(500).json({ error: 'Failed to update saved searches' });
  }
});

// PATCH /api/user/click-history — Update just click history
router.patch('/click-history', requireAuth, async (req, res) => {
  try {
    const { clickHistory } = req.body;
    await db.collection('users').doc(req.uid).set(
      { clickHistory, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update click history error:', err);
    res.status(500).json({ error: 'Failed to update click history' });
  }
});

module.exports = router;
