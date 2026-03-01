/**
 * Intent Schema - validates parsed AI output
 *
 * Acts as a Zod-like validator for plain JS. Validates, coerces types,
 * and fills in defaults for the buyer intent object.
 *
 * Fields:
 * - location: { city, state, zip }
 * - budget: { min, max }
 * - bedrooms: number
 * - bathrooms: number
 * - propertyType: "house"|"condo"|"townhome"|"multi_family"|"land"|"any"
 * - mustHave: string[]
 * - niceToHave: string[]
 * - constraints: { maxCommuteMinutes, schoolQuality, lotSizeMin, sqftMin }
 * - lifestyleTags: string[]
 * - investmentGoal: "primary_home"|"rental"|"flip"|"airbnb"|"unknown"
 * - riskTolerance: "low"|"medium"|"high"
 * - confidence: number 0-1
 * - clarifyingQuestions: string[]
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PROPERTY_TYPES = [
  'house', 'condo', 'townhome', 'multi_family', 'land', 'any',
];

const VALID_INVESTMENT_GOALS = [
  'primary_home', 'rental', 'flip', 'airbnb', 'unknown',
];

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];

/**
 * Try to coerce a value to a number. Returns null if not possible.
 */
function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    // Strip common currency / formatting chars
    const cleaned = val.replace(/[$,\s]/g, '');
    // Handle shorthand: 300k -> 300000, 1.2m -> 1200000
    const shorthand = cleaned.match(/^(\d+(?:\.\d+)?)\s*(k|m)$/i);
    if (shorthand) {
      const num = parseFloat(shorthand[1]);
      const mult = shorthand[2].toLowerCase() === 'k' ? 1000 : 1000000;
      return num * mult;
    }
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Coerce to array of strings. If already an array, filter non-strings.
 * If a comma-separated string, split.
 */
function toStringArray(val) {
  if (Array.isArray(val)) {
    return val
      .map(function (v) { return typeof v === 'string' ? v.trim() : String(v); })
      .filter(Boolean);
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  return [];
}

/**
 * Coerce to one of allowed enum values. Returns fallback if invalid.
 */
function toEnum(val, allowed, fallback) {
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (allowed.includes(lower)) return lower;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate and clean an intent object.
 *
 * @param {object} obj - raw intent data
 * @returns {{ valid: boolean, data: object, errors: string[] }}
 */
function validateIntent(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, data: null, errors: ['Input must be an object'] };
  }

  // --- location ---
  const rawLoc = obj.location || {};
  const location = {
    city: typeof rawLoc.city === 'string' ? rawLoc.city.trim() : null,
    state: typeof rawLoc.state === 'string' ? rawLoc.state.trim().toUpperCase() : null,
    zip: rawLoc.zip != null ? String(rawLoc.zip).trim() : null,
  };
  if (!location.city && !location.state && !location.zip) {
    errors.push('location requires at least city or state');
  }

  // --- budget ---
  const rawBudget = obj.budget || {};
  const budgetMin = toNumber(rawBudget.min);
  const budgetMax = toNumber(rawBudget.max);
  const budget = {
    min: budgetMin != null ? budgetMin : 0,
    max: budgetMax != null ? budgetMax : 0,
  };
  if (budget.min > budget.max && budget.max > 0) {
    // swap
    const tmp = budget.min;
    budget.min = budget.max;
    budget.max = tmp;
  }

  // --- bedrooms / bathrooms ---
  const bedrooms = toNumber(obj.bedrooms);
  const bathrooms = toNumber(obj.bathrooms);

  // --- propertyType ---
  const propertyType = toEnum(obj.propertyType, VALID_PROPERTY_TYPES, 'any');

  // --- mustHave / niceToHave ---
  const mustHave = toStringArray(obj.mustHave);
  const niceToHave = toStringArray(obj.niceToHave);

  // --- constraints ---
  const rawCon = obj.constraints || {};
  const constraints = {
    maxCommuteMinutes: toNumber(rawCon.maxCommuteMinutes),
    schoolQuality: toNumber(rawCon.schoolQuality),
    lotSizeMin: toNumber(rawCon.lotSizeMin),
    sqftMin: toNumber(rawCon.sqftMin),
  };

  // --- lifestyleTags ---
  const lifestyleTags = toStringArray(obj.lifestyleTags);

  // --- investmentGoal ---
  const investmentGoal = toEnum(obj.investmentGoal, VALID_INVESTMENT_GOALS, 'unknown');

  // --- riskTolerance ---
  const riskTolerance = toEnum(obj.riskTolerance, VALID_RISK_LEVELS, 'medium');

  // --- confidence ---
  let confidence = toNumber(obj.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) {
    confidence = 0.5;
  }

  // --- clarifyingQuestions ---
  const clarifyingQuestions = toStringArray(obj.clarifyingQuestions);

  const data = {
    location,
    budget,
    bedrooms: bedrooms != null ? bedrooms : null,
    bathrooms: bathrooms != null ? bathrooms : null,
    propertyType,
    mustHave,
    niceToHave,
    constraints,
    lifestyleTags,
    investmentGoal,
    riskTolerance,
    confidence,
    clarifyingQuestions,
  };

  return {
    valid: errors.length === 0,
    data,
    errors,
  };
}

module.exports = { validateIntent, VALID_PROPERTY_TYPES, VALID_INVESTMENT_GOALS, VALID_RISK_LEVELS };
