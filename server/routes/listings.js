const express = require('express');
const router = express.Router();
const { searchProperties, getPropertyPhotos } = require('../services/realtyApi');
const { scoreAndSort } = require('../utils/scoring');

router.get('/search', async (req, res) => {
  try {
    const {
      city,
      state_code,
      price_min,
      price_max,
      beds,
      baths,
      prop_type,
      limit,
      offset,
      sort,
      has_pool,
      has_garage,
      sqft_min,
      sqft_max,
      lot_sqft_min,
    } = req.query;

    if (!city || !state_code) {
      return res.status(400).json({
        error: 'city and state_code are required',
      });
    }

    const propTypeMap = {
      house: 'single_family',
      condo: 'condo',
      townhome: 'townhouse',
      multi_family: 'multi_family',
    };

    const apiParams = {
      city,
      state_code,
      price_min: price_min ? Number(price_min) : undefined,
      price_max: price_max ? Number(price_max) : undefined,
      beds_min: beds ? Number(beds) : undefined,
      baths_min: baths ? Number(baths) : undefined,
      prop_type: propTypeMap[prop_type] || prop_type || undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      sort: sort || 'relevance',
      has_pool: has_pool === 'true' ? true : undefined,
      has_garage: has_garage === 'true' ? true : undefined,
      sqft_min: sqft_min ? Number(sqft_min) : undefined,
      sqft_max: sqft_max ? Number(sqft_max) : undefined,
      lot_sqft_min: lot_sqft_min ? Number(lot_sqft_min) : undefined,
    };

    const { properties, total } = await searchProperties(apiParams);

    const prefs = {
      priceMin: price_min ? Number(price_min) : null,
      priceMax: price_max ? Number(price_max) : null,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      propType: prop_type || null,
    };

    const scored = scoreAndSort(properties, prefs);

    res.json({
      results: scored,
      total,
      offset: apiParams.offset,
      limit: apiParams.limit,
    });
  } catch (err) {
    console.error('Search error:', { query: req.query, error: err.response?.data || err.message });

    if (err.response?.status === 429) {
      return res.status(429).json({
        error: 'API rate limit exceeded. Please try again later.',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch listings. Please try again.',
    });
  }
});

// Multi-city search — calls RealtyAPI once per city, merges results
router.post('/search-multi', async (req, res) => {
  try {
    const { cities, state_code, filters = {} } = req.body;

    if (!cities || !Array.isArray(cities) || cities.length === 0 || !state_code) {
      return res.status(400).json({ error: 'cities (array) and state_code are required' });
    }

    // Cap at 5 cities to limit API usage
    const cityList = cities.slice(0, 5);

    const propTypeMap = {
      house: 'single_family',
      condo: 'condo',
      townhome: 'townhouse',
      multi_family: 'multi_family',
      new_construction: 'single_family', // new construction defaults to single-family
    };

    const baseParams = {
      state_code,
      price_min: filters.price_min ? Number(filters.price_min) : undefined,
      price_max: filters.price_max ? Number(filters.price_max) : undefined,
      beds_min: filters.beds ? Number(filters.beds) : undefined,
      baths_min: filters.baths ? Number(filters.baths) : undefined,
      prop_type: propTypeMap[filters.prop_type] || filters.prop_type || undefined,
      limit: Math.min(Math.floor(42 / cityList.length), 20),
      offset: 0,
      sort: filters.sort || 'relevance',
      has_pool: filters.has_pool === 'true' ? true : undefined,
      has_garage: filters.has_garage === 'true' || filters.garage_min ? true : undefined,
      sqft_min: filters.sqft_min ? Number(filters.sqft_min) : undefined,
      sqft_max: filters.sqft_max ? Number(filters.sqft_max) : undefined,
      lot_sqft_min: filters.lot_sqft_min ? Number(filters.lot_sqft_min) : undefined,
      is_new_construction: filters.prop_type === 'new_construction' ? true : undefined,
      // Deep search filters
      garage_min: filters.garage_min ? Number(filters.garage_min) : undefined,
      year_built_min: filters.year_built_min ? Number(filters.year_built_min) : undefined,
      no_hoa: filters.no_hoa ? true : undefined,
    };

    // Search each city in parallel
    const results = await Promise.all(
      cityList.map(async (cityName) => {
        try {
          const { properties } = await searchProperties({ ...baseParams, city: cityName });
          return properties;
        } catch (err) {
          console.warn(`Search failed for ${cityName}, ${state_code}:`, err.message);
          return [];
        }
      })
    );

    // Flatten and deduplicate by property_id
    const seen = new Set();
    const allProperties = [];
    for (const batch of results) {
      for (const prop of batch) {
        if (!seen.has(prop.property_id)) {
          seen.add(prop.property_id);
          allProperties.push(prop);
        }
      }
    }

    const prefs = {
      priceMin: filters.price_min ? Number(filters.price_min) : null,
      priceMax: filters.price_max ? Number(filters.price_max) : null,
      beds: filters.beds ? Number(filters.beds) : null,
      baths: filters.baths ? Number(filters.baths) : null,
      propType: filters.prop_type || null,
    };

    const scored = scoreAndSort(allProperties, prefs);

    res.json({
      results: scored,
      total: scored.length,
      cities: cityList,
      state_code,
    });
  } catch (err) {
    console.error('Multi-city search error:', err.message);

    if (err.response?.status === 429) {
      return res.status(429).json({
        error: 'API rate limit exceeded. Please try again later.',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch listings. Please try again.',
    });
  }
});

// Get full photos for a property
router.get('/photos/:propertyId', async (req, res) => {
  try {
    const photos = await getPropertyPhotos(req.params.propertyId);
    res.json({ photos });
  } catch (err) {
    console.error('Photos error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch photos.', photos: [] });
  }
});

module.exports = router;
