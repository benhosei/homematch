/**
 * Move Estimate Utilities
 *
 * Heuristic-based helpers for estimating moving costs, distance buckets,
 * seasonality multipliers, and recommended move types.
 */

// Zip-prefix-to-region mapping (rough US geographic regions)
// 0 = Northeast, 1 = Northeast/Mid-Atlantic, 2 = Mid-Atlantic/Southeast,
// 3 = Southeast, 4 = Midwest-East, 5 = Midwest-Central, 6 = South-Central,
// 7 = South-Central/Mountain, 8 = Mountain/West, 9 = West/Pacific
const ZIP_REGION_MAP = {
  0: 'northeast',
  1: 'northeast',
  2: 'mid_atlantic',
  3: 'southeast',
  4: 'midwest',
  5: 'midwest',
  6: 'south_central',
  7: 'south_central',
  8: 'mountain_west',
  9: 'pacific_west',
};

// Which regions are on which coast (for "same coast" checks)
const EAST_COAST = new Set(['northeast', 'mid_atlantic', 'southeast']);
const WEST_COAST = new Set(['mountain_west', 'pacific_west']);
const CENTRAL = new Set(['midwest', 'south_central']);

/**
 * Determine a rough distance bucket based on state, zip code, and city info.
 *
 * @param {string} originState - Origin state abbreviation (e.g. "CA")
 * @param {string} destState - Destination state abbreviation
 * @param {string} originZip - Origin zip code
 * @param {string} destZip - Destination zip code
 * @returns {"local"|"short"|"medium"|"long_distance"}
 */
function estimateDistance(originState, destState, originZip, destZip) {
  const oZip = String(originZip).trim();
  const dZip = String(destZip).trim();
  const oState = String(originState).trim().toUpperCase();
  const dState = String(destState).trim().toUpperCase();

  // Same state and same first 3 zip digits -> local
  if (oState === dState && oZip.substring(0, 3) === dZip.substring(0, 3)) {
    return 'local';
  }

  // Same state but different 3-digit prefix -> short
  if (oState === dState) {
    return 'short';
  }

  // Different states: use first digit of zip to determine region
  const oRegion = ZIP_REGION_MAP[parseInt(oZip[0], 10)] || 'unknown';
  const dRegion = ZIP_REGION_MAP[parseInt(dZip[0], 10)] || 'unknown';

  // Same region -> short
  if (oRegion === dRegion) {
    return 'short';
  }

  // Adjacent / same-coast regions -> medium
  const oOnEast = EAST_COAST.has(oRegion);
  const dOnEast = EAST_COAST.has(dRegion);
  const oOnWest = WEST_COAST.has(oRegion);
  const dOnWest = WEST_COAST.has(dRegion);
  const oInCentral = CENTRAL.has(oRegion);
  const dInCentral = CENTRAL.has(dRegion);

  // Both on same coast
  if ((oOnEast && dOnEast) || (oOnWest && dOnWest)) {
    return 'medium';
  }

  // One is central, the other is on a coast -> medium
  if ((oInCentral && (dOnEast || dOnWest)) || (dInCentral && (oOnEast || oOnWest))) {
    return 'medium';
  }

  // Both central
  if (oInCentral && dInCentral) {
    return 'medium';
  }

  // Cross country (east <-> west)
  return 'long_distance';
}

/**
 * Return a seasonality cost multiplier based on the move date.
 * Peak season: May-Aug (+20%), December (+10%).
 *
 * @param {string|null} dateString - ISO date string (e.g. "2025-07-15")
 * @returns {number} Multiplier (1.0, 1.1, or 1.2)
 */
function getSeasonalityMultiplier(dateString) {
  if (!dateString) {
    return 1.0;
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 1.0;
  }

  const month = date.getMonth(); // 0-indexed: 0=Jan, 4=May, 7=Aug, 11=Dec

  // May (4) through August (7) -> peak summer
  if (month >= 4 && month <= 7) {
    return 1.2;
  }

  // December (11) -> holiday peak
  if (month === 11) {
    return 1.1;
  }

  return 1.0;
}

/**
 * Calculate a cost range for a move.
 *
 * @param {"local"|"short"|"medium"|"long_distance"} distanceBucket
 * @param {number} bedrooms
 * @param {number} sqft
 * @param {"none"|"some"|"many"} stairs
 * @param {string|null} moveDate - ISO date string
 * @returns {{ low: number, high: number }}
 */
function calculateMoveCost(distanceBucket, bedrooms, sqft, stairs, moveDate) {
  // Base cost ranges by distance bucket
  const baseCosts = {
    local: { low: 800, high: 2500 },
    short: { low: 2000, high: 5000 },
    medium: { low: 3500, high: 8000 },
    long_distance: { low: 5000, high: 15000 },
  };

  const base = baseCosts[distanceBucket] || baseCosts.local;

  // Home size multiplier: bedrooms * 0.3 + sqft / 2000
  const sizeMultiplier = (bedrooms * 0.3) + (sqft / 2000);

  // Stairs multiplier
  let stairsMultiplier = 1.0;
  if (stairs === 'some') {
    stairsMultiplier = 1.15;
  } else if (stairs === 'many') {
    stairsMultiplier = 1.30;
  }

  // Seasonality multiplier
  const seasonMultiplier = getSeasonalityMultiplier(moveDate);

  // Combine multipliers
  const totalMultiplier = sizeMultiplier * stairsMultiplier * seasonMultiplier;

  const low = Math.round(base.low * totalMultiplier);
  const high = Math.round(base.high * totalMultiplier);

  return { low, high };
}

/**
 * Recommend a move type based on distance and home size.
 *
 * @param {"local"|"short"|"medium"|"long_distance"} distanceBucket
 * @param {number} bedrooms
 * @returns {"full_service"|"labor_only"|"pod"|"truck_rental"}
 */
function recommendMoveType(distanceBucket, bedrooms) {
  if (distanceBucket === 'long_distance') {
    return 'full_service';
  }

  if (distanceBucket === 'medium') {
    return 'pod';
  }

  // Local or short distance
  if (bedrooms <= 2) {
    return 'truck_rental';
  }

  return 'labor_only';
}

module.exports = {
  estimateDistance,
  getSeasonalityMultiplier,
  calculateMoveCost,
  recommendMoveType,
};
