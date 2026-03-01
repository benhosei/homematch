const express = require('express');
const router = express.Router();
const {
  estimateDistance,
  calculateMoveCost,
  getSeasonalityMultiplier,
  recommendMoveType,
} = require('../utils/moveEstimate');
const { generateMovePlan } = require('../utils/movePlan');

// In-memory store for mover requests (lead capture)
const moverRequests = [];

// ---------------------------------------------------------------------------
// POST /api/move/estimate
// ---------------------------------------------------------------------------
router.post('/estimate', (req, res) => {
  try {
    const { origin, destination, homeSize, stairs, date } = req.body;

    // --- Validate required fields ---
    if (!origin || typeof origin !== 'object') {
      return res.status(400).json({
        error: 'origin is required and must be an object with zip, city, and state.',
      });
    }
    if (!origin.zip || !origin.city || !origin.state) {
      return res.status(400).json({
        error: 'origin must include zip, city, and state.',
      });
    }

    if (!destination || typeof destination !== 'object') {
      return res.status(400).json({
        error: 'destination is required and must be an object with zip, city, and state.',
      });
    }
    if (!destination.zip || !destination.city || !destination.state) {
      return res.status(400).json({
        error: 'destination must include zip, city, and state.',
      });
    }

    if (!homeSize || typeof homeSize !== 'object') {
      return res.status(400).json({
        error: 'homeSize is required and must be an object with bedrooms and sqft.',
      });
    }
    if (
      typeof homeSize.bedrooms !== 'number' ||
      homeSize.bedrooms < 0 ||
      typeof homeSize.sqft !== 'number' ||
      homeSize.sqft <= 0
    ) {
      return res.status(400).json({
        error: 'homeSize.bedrooms must be a non-negative number and homeSize.sqft must be a positive number.',
      });
    }

    const validStairs = ['none', 'some', 'many'];
    const stairsValue = stairs || 'none';
    if (!validStairs.includes(stairsValue)) {
      return res.status(400).json({
        error: 'stairs must be one of: "none", "some", "many".',
      });
    }

    if (date && isNaN(new Date(date).getTime())) {
      return res.status(400).json({
        error: 'date must be a valid ISO date string.',
      });
    }

    // --- Compute estimate ---
    const distanceBucket = estimateDistance(
      origin.state,
      destination.state,
      origin.zip,
      destination.zip
    );

    const estimatedCostRange = calculateMoveCost(
      distanceBucket,
      homeSize.bedrooms,
      homeSize.sqft,
      stairsValue,
      date || null
    );

    const recommendedMoveType = recommendMoveType(distanceBucket, homeSize.bedrooms);

    // Build assumptions list
    const assumptions = [];
    assumptions.push('Distance estimated from zip code regions (no GPS/routing used).');

    const distanceLabels = {
      local: '0-50 miles',
      short: '50-200 miles',
      medium: '200-1000 miles',
      long_distance: '1000+ miles',
    };
    assumptions.push('Estimated distance: ' + distanceLabels[distanceBucket] + ' (' + distanceBucket + ').');

    assumptions.push(
      'Home size factor: ' + homeSize.bedrooms + ' bedroom(s), ' + homeSize.sqft + ' sqft.'
    );

    if (stairsValue !== 'none') {
      const pct = stairsValue === 'some' ? '15%' : '30%';
      assumptions.push('Stairs adjustment: +' + pct + ' (' + stairsValue + ').');
    }

    const seasonMultiplier = getSeasonalityMultiplier(date || null);
    if (seasonMultiplier > 1.0) {
      const seasonPct = Math.round((seasonMultiplier - 1.0) * 100);
      assumptions.push('Peak season surcharge: +' + seasonPct + '%.');
    } else {
      assumptions.push('No peak season surcharge applied.');
    }

    assumptions.push('Prices are rough estimates and do not include packing materials, insurance, or specialty item fees.');

    res.json({
      estimatedCostRange,
      assumptions,
      recommendedMoveType,
      distanceBucket,
    });
  } catch (err) {
    console.error('Estimate error:', err.message);
    res.status(500).json({ error: 'Failed to compute estimate. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/move/plan
// ---------------------------------------------------------------------------
router.post('/plan', (req, res) => {
  try {
    const { moveDate, householdSize, pets, specialItems } = req.body;

    // Defaults
    const defaultMoveDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const moveDateValue = moveDate || defaultMoveDate;
    const householdSizeValue = householdSize || 'medium';
    const petsValue = typeof pets === 'boolean' ? pets : false;
    const specialItemsValue = Array.isArray(specialItems) ? specialItems : [];

    // Validate
    if (moveDateValue && isNaN(new Date(moveDateValue).getTime())) {
      return res.status(400).json({
        error: 'moveDate must be a valid ISO date string.',
      });
    }

    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(householdSizeValue)) {
      return res.status(400).json({
        error: 'householdSize must be one of: "small", "medium", "large".',
      });
    }

    if (specialItems !== undefined && !Array.isArray(specialItems)) {
      return res.status(400).json({
        error: 'specialItems must be an array of strings.',
      });
    }

    const plan = generateMovePlan(
      moveDateValue,
      householdSizeValue,
      petsValue,
      specialItemsValue
    );

    res.json(plan);
  } catch (err) {
    console.error('Plan error:', err.message);
    res.status(500).json({ error: 'Failed to generate move plan. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/move/find-movers
// ---------------------------------------------------------------------------
router.post('/find-movers', (req, res) => {
  try {
    const { origin, destination, date, contact, notes } = req.body;

    // --- Validate required fields ---
    if (!origin || typeof origin !== 'object') {
      return res.status(400).json({
        error: 'origin is required and must be an object with zip, city, and state.',
      });
    }
    if (!origin.zip || !origin.city || !origin.state) {
      return res.status(400).json({
        error: 'origin must include zip, city, and state.',
      });
    }

    if (!destination || typeof destination !== 'object') {
      return res.status(400).json({
        error: 'destination is required and must be an object with zip, city, and state.',
      });
    }
    if (!destination.zip || !destination.city || !destination.state) {
      return res.status(400).json({
        error: 'destination must include zip, city, and state.',
      });
    }

    if (!date) {
      return res.status(400).json({ error: 'date is required.' });
    }
    if (isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'date must be a valid ISO date string.' });
    }

    if (!contact || typeof contact !== 'object') {
      return res.status(400).json({
        error: 'contact is required and must be an object with name, email, and phone.',
      });
    }
    if (!contact.name || !contact.email || !contact.phone) {
      return res.status(400).json({
        error: 'contact must include name, email, and phone.',
      });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      return res.status(400).json({ error: 'contact.email must be a valid email address.' });
    }

    // Generate request ID (timestamp + random suffix)
    const requestId =
      'MR-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const request = {
      requestId,
      origin,
      destination,
      date,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    // Store in memory
    moverRequests.push(request);

    console.log('[Move] New mover request stored:', requestId, '| Contact:', contact.name, contact.email);

    res.json({
      status: 'ok',
      message:
        "We've received your request! Local movers will contact you within 24-48 hours with quotes.",
      requestId,
    });
  } catch (err) {
    console.error('Find-movers error:', err.message);
    res.status(500).json({ error: 'Failed to submit request. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/move/requests  (admin / debug)
// ---------------------------------------------------------------------------
router.get('/requests', (req, res) => {
  res.json({
    total: moverRequests.length,
    requests: moverRequests,
  });
});

module.exports = router;
