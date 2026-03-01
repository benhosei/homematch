const axios = require('axios');

const RAPIDAPI_KEY = (process.env.RAPIDAPI_KEY || '').trim();
const RAPIDAPI_HOST = (process.env.RAPIDAPI_HOST || '').trim();
const BASE_URL = `https://${RAPIDAPI_HOST}`;

async function searchProperties(params) {
  const {
    city,
    state_code,
    price_min,
    price_max,
    beds_min,
    baths_min,
    prop_type,
    limit = 20,
    offset = 0,
  } = params;

  // Build v3 POST body
  const body = {
    limit,
    offset,
    city,
    state_code,
    status: ['for_sale'],
    sort: { direction: 'desc', field: 'list_date' },
  };

  if (price_min || price_max) {
    body.list_price = {};
    if (price_min) body.list_price.min = price_min;
    if (price_max) body.list_price.max = price_max;
  }
  if (beds_min) body.beds_min = beds_min;
  if (baths_min) body.baths_min = baths_min;
  if (prop_type) body.type = [prop_type];
  if (params.has_pool) body.has_pool = true;
  if (params.has_garage) body.has_garage = true;
  if (params.sqft_min) body.sqft_min = params.sqft_min;
  if (params.sqft_max) body.sqft_max = params.sqft_max;
  if (params.lot_sqft_min) body.lot_sqft_min = params.lot_sqft_min;
  if (params.is_new_construction) body.is_new_construction = true;
  // Deep search: garage minimum, year built minimum, no-HOA filter
  if (params.garage_min) body.garage_min = params.garage_min;
  if (params.year_built_min) body.year_built = { min: params.year_built_min };
  if (params.no_hoa) body.no_hoa_fee = true;

  const response = await axios.post(`${BASE_URL}/properties/v3/list`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
    timeout: 15000,
  });

  const data = response.data;
  const results = data?.data?.home_search?.results || [];

  return {
    properties: results.map(normalizeProperty),
    total: data?.data?.home_search?.total || results.length,
  };
}

/**
 * Fetch full-resolution photos for a property
 */
async function getPropertyPhotos(propertyId) {
  const response = await axios.get(`${BASE_URL}/properties/v3/get-photos`, {
    params: { property_id: propertyId },
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });

  const results = response.data?.data?.home_search?.results || [];
  if (results.length > 0 && results[0].photos) {
    return results[0].photos.map((p) => upscalePhotoUrl(p.href)).filter(Boolean);
  }
  return [];
}

/**
 * Convert small thumbnail URL to large/original resolution.
 * rdcpix.com URLs end with size suffix before .jpg:
 *   s = small, m = medium, l = large, od = original
 * e.g. ...l-m1769044828s.jpg -> ...l-m1769044828od.jpg
 */
function upscalePhotoUrl(url) {
  if (!url) return url;
  // Replace trailing size indicator (s, t, e, etc) before .jpg with 'od' for original
  return url.replace(/([a-z])\.jpg$/i, 'od.jpg');
}

function normalizeProperty(raw) {
  const location = raw.location || {};
  const address = location.address || {};
  const description = raw.description || {};
  const coordinate = address.coordinate || location.coordinate || {};

  return {
    property_id: raw.property_id || raw.listing_id || String(Math.random()),
    listing_id: raw.listing_id || raw.property_id,
    price: raw.list_price || 0,
    address: {
      line: address.line || '',
      city: address.city || '',
      state: address.state_code || address.state || '',
      postal_code: address.postal_code || '',
      full: formatAddress(address),
    },
    lat: coordinate.lat || null,
    lng: coordinate.lon || coordinate.lng || null,
    beds: description.beds || 0,
    baths: description.baths || 0,
    sqft: description.sqft || 0,
    lot_sqft: description.lot_sqft || 0,
    prop_type: description.type || 'unknown',
    prop_sub_type: description.sub_type || null,
    photos: extractPhotos(raw),
    thumbnail: extractThumbnail(raw),
    year_built: description.year_built || null,
    list_date: raw.list_date || null,
    description: description.text || '',
    mls_id: raw.source?.id || null,
    rdc_web_url: raw.href || null,
  };
}

function extractPhotos(raw) {
  if (raw.photos && Array.isArray(raw.photos)) {
    return raw.photos.map((p) => {
      if (typeof p === 'string') return upscalePhotoUrl(p);
      return upscalePhotoUrl(p.href || p.url || '');
    }).filter(Boolean);
  }
  if (raw.primary_photo) {
    const url = raw.primary_photo.href || raw.primary_photo.url;
    return url ? [upscalePhotoUrl(url)] : [];
  }
  return [];
}

function extractThumbnail(raw) {
  if (raw.primary_photo?.href) return upscalePhotoUrl(raw.primary_photo.href);
  if (raw.photos?.[0]?.href) return upscalePhotoUrl(raw.photos[0].href);
  return null;
}

function formatAddress(addr) {
  if (!addr) return 'Address unavailable';
  const parts = [addr.line, addr.city, addr.state_code || addr.state, addr.postal_code];
  return parts.filter(Boolean).join(', ');
}

module.exports = { searchProperties, getPropertyPhotos };
