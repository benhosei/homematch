const express = require('express');
const router = express.Router();

// In-memory cache
const visionCache = new Map();

// Deterministic mock analysis based on property metadata
function analyzeProperty(propertyId, data) {
  if (visionCache.has(propertyId)) return visionCache.get(propertyId);

  const photos = data.photos || [];
  const photoCount = photos.length || data.photoCount || 0;
  const price = data.price || 0;
  const sqft = data.sqft || 0;
  const beds = data.beds || 0;
  const baths = data.baths || 0;
  const propType = data.prop_type || 'single_family';

  // Generate deterministic tags based on property features
  const tags = [];
  const notes = [];
  const insights = {};

  // Kitchen analysis
  if (price > 300000 || sqft > 1800) {
    tags.push('Updated Kitchen');
    notes.push('Kitchen appears to have modern finishes based on price point and square footage');
    insights.kitchenQuality = 'modern';
  } else {
    tags.push('Standard Kitchen');
    insights.kitchenQuality = 'standard';
  }

  // Bathroom analysis
  if (baths >= 3) {
    tags.push('Multiple Bathrooms');
    notes.push('Multiple bathrooms suggest updated fixtures');
    insights.bathroomCondition = 'updated';
  } else if (baths >= 2) {
    tags.push('Dual Bathrooms');
    insights.bathroomCondition = 'good';
  } else {
    insights.bathroomCondition = 'standard';
  }

  // Space analysis
  if (sqft > 2500) {
    tags.push('Spacious Layout');
    notes.push('Open floor plan likely with generous living areas');
  } else if (sqft > 1500) {
    tags.push('Comfortable Size');
  } else if (sqft > 0) {
    tags.push('Cozy Layout');
  }

  // Outdoor
  if (propType === 'single_family') {
    tags.push('Private Yard');
    notes.push('Single family home with dedicated outdoor space');
    insights.outdoorSpace = 'yard';
  } else if (propType === 'townhomes' || propType === 'townhouse') {
    tags.push('Townhome Living');
    insights.outdoorSpace = 'limited';
  } else {
    insights.outdoorSpace = 'none';
  }

  // Bedrooms
  if (beds >= 4) {
    tags.push('Family-Friendly');
    notes.push(`${beds} bedrooms provide ample space for a growing family`);
  }

  // Photo quality scoring (deterministic based on photo count + price)
  let photoScore = 50;
  if (photoCount >= 20) photoScore += 25;
  else if (photoCount >= 10) photoScore += 15;
  else if (photoCount >= 5) photoScore += 8;

  if (price > 500000) photoScore += 15;
  else if (price > 300000) photoScore += 10;
  else if (price > 150000) photoScore += 5;

  // Price per sqft bonus
  if (sqft > 0 && price / sqft < 200) {
    tags.push('Good Value');
    photoScore += 5;
  }

  photoScore = Math.min(photoScore, 98);

  // Natural light analysis
  if (photoCount > 10) {
    tags.push('Well-Lit Spaces');
    notes.push('Abundant photo documentation suggests well-lit, photogenic spaces');
    insights.naturalLight = 'abundant';
  } else {
    insights.naturalLight = 'standard';
  }

  // Best photos (deterministic selection)
  const bestPhotos = [];
  if (photoCount > 0) {
    bestPhotos.push(0); // First photo usually best
    if (photoCount > 3) bestPhotos.push(2);
    if (photoCount > 6) bestPhotos.push(5);
    if (photoCount > 10) bestPhotos.push(Math.floor(photoCount * 0.7));
  }

  const result = {
    propertyId,
    tags: tags.slice(0, 8),
    notes: notes.slice(0, 5),
    insights,
    bestPhotos,
    overallPhotoScore: photoScore,
    analyzedAt: new Date().toISOString(),
  };

  visionCache.set(propertyId, result);
  return result;
}

// POST /api/vision/analyze-listing
router.post('/analyze-listing', (req, res) => {
  try {
    const { propertyId, photos, photoCount, price, sqft, beds, baths, prop_type } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }

    const result = analyzeProperty(propertyId, {
      photos, photoCount, price, sqft, beds, baths, prop_type
    });

    res.json(result);
  } catch (err) {
    console.error('Vision analysis error:', err);
    res.status(500).json({ error: 'Vision analysis failed' });
  }
});

module.exports = router;
