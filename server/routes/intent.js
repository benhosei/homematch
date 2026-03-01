/**
 * Intent Routes
 *
 * POST /api/intent/parse  - Parse natural language into a structured intent
 * POST /api/intent/search - Search listings using a validated intent
 */

const express = require('express');
const router = express.Router();
const { validateIntent } = require('../schemas/intent');
const { MockListingsProvider } = require('../data/mockListings');
const { scoreListing } = require('../utils/intentScoring');

const provider = new MockListingsProvider();

// ---------------------------------------------------------------------------
// Known city/state pairs for location resolution
// ---------------------------------------------------------------------------

const KNOWN_LOCATIONS = [
  { city: 'Indianapolis', state: 'IN', aliases: ['indy', 'indianapolis', 'nap town', 'naptown'] },
  { city: 'Austin', state: 'TX', aliases: ['austin', 'atx'] },
  { city: 'Miami', state: 'FL', aliases: ['miami', 'mia'] },
];

const STATE_MAP = {
  'indiana': 'IN', 'in': 'IN',
  'texas': 'TX', 'tx': 'TX',
  'florida': 'FL', 'fl': 'FL',
  'california': 'CA', 'ca': 'CA',
  'new york': 'NY', 'ny': 'NY',
  'ohio': 'OH', 'oh': 'OH',
  'illinois': 'IL', 'il': 'IL',
  'georgia': 'GA', 'ga': 'GA',
  'north carolina': 'NC', 'nc': 'NC',
  'colorado': 'CO', 'co': 'CO',
  'tennessee': 'TN', 'tn': 'TN',
  'arizona': 'AZ', 'az': 'AZ',
  'michigan': 'MI', 'mi': 'MI',
  'washington': 'WA', 'wa': 'WA',
  'oregon': 'OR', 'or': 'OR',
};

// Reverse lookup: set of valid 2-letter state codes
const VALID_STATE_CODES = new Set(Object.values(STATE_MAP));

// ---------------------------------------------------------------------------
// Rule-Based NLP Parser
// ---------------------------------------------------------------------------

/**
 * Parse location from a location text string.
 */
function parseLocation(text) {
  if (!text) return { city: null, state: null, zip: null };

  var lower = text.toLowerCase().trim();

  // Try to match known city aliases
  for (var i = 0; i < KNOWN_LOCATIONS.length; i++) {
    var loc = KNOWN_LOCATIONS[i];
    for (var j = 0; j < loc.aliases.length; j++) {
      if (lower.includes(loc.aliases[j])) {
        return { city: loc.city, state: loc.state, zip: null };
      }
    }
  }

  // Try ZIP code
  var zipMatch = text.match(/\b(\d{5})\b/);
  if (zipMatch) {
    return { city: null, state: null, zip: zipMatch[1] };
  }

  // Try "City, STATE" pattern (e.g. "Fishers, Indiana" or "in Fishers, IN")
  // Use a tighter regex: 1-3 capitalized words immediately before comma + state
  var cityStateComma = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}),\s*([A-Za-z]{2,})\b/);
  if (cityStateComma) {
    var csCity = cityStateComma[1].trim();
    var csStateRaw = cityStateComma[2].trim().toLowerCase();
    var csState = STATE_MAP[csStateRaw] || (csStateRaw.length === 2 && VALID_STATE_CODES.has(csStateRaw.toUpperCase()) ? csStateRaw.toUpperCase() : null);
    if (csState) {
      return { city: csCity, state: csState, zip: null };
    }
  }

  // Try "[City] [StateName]" pattern — with or without "in" prefix
  // e.g. "5 bed house in Fishers Indiana under $500k" or "fishers indiana"
  // Skip negation phrases: "not in", "doesn't have to be in", "don't need to be in", etc.
  var hasNegation = /(?:not|n't|don't|doesn't|never|no need to be|don't have to be|doesn't have to be)\s+(?:.*?\s+)?in\s/i.test(text);

  for (var stateName in STATE_MAP) {
    if (stateName.length >= 3) {
      // Check if this specific state mention is negated (e.g. "doesn't have to be in Indiana")
      var stateNegated = hasNegation && new RegExp('(?:not|n\'t)\\s+(?:.*?\\s+)?(?:in\\s+)?(?:.*?\\s+)?' + escapeRegExp(stateName), 'i').test(text);

      // With "in" prefix: "in Fishers Indiana" (skip if negation detected)
      if (!stateNegated) {
        var inPattern = new RegExp('\\bin\\s+([A-Za-z][A-Za-z\\s]{0,25}?)\\s+' + escapeRegExp(stateName) + '\\b', 'i');
        var inMatch = lower.match(inPattern);
        if (inMatch) {
          var extractedCity = inMatch[1].trim();
          var noiseWords = ['a', 'the', 'an', 'my', 'our', 'any', 'some', 'nice', 'big', 'small', 'new', 'old', 'to', 'be', 'have'];
          extractedCity = extractedCity.split(/\s+/).filter(function(w) { return noiseWords.indexOf(w.toLowerCase()) === -1; }).join(' ');
          if (extractedCity.length > 1) {
            return { city: capitalizeWords(extractedCity), state: STATE_MAP[stateName], zip: null };
          }
        }
      }
      // Without "in" prefix: "fishers indiana" or "Carmel Indiana" — match 1-3 words before state name
      // Also skip if this state is negated
      if (!stateNegated) {
        var barePattern = new RegExp('\\b([A-Za-z][A-Za-z]{1,15}(?:\\s+[A-Za-z]{2,15}){0,2})\\s+' + escapeRegExp(stateName) + '\\b', 'i');
        var bareMatch = lower.match(barePattern);
        if (bareMatch) {
          var bareCity = bareMatch[1].trim();
          // Filter out common non-city words
          var skipWords = ['bed', 'bath', 'bedroom', 'bathroom', 'house', 'home', 'condo', 'townhome', 'under', 'over', 'around', 'about', 'near', 'large', 'small', 'big', 'nice', 'cheap', 'affordable', 'luxury', 'modern', 'new', 'old'];
          var cityWords = bareCity.split(/\s+/).filter(function(w) { return skipWords.indexOf(w.toLowerCase()) === -1; });
          if (cityWords.length > 0 && cityWords.join(' ').length > 1) {
            return { city: capitalizeWords(cityWords.join(' ')), state: STATE_MAP[stateName], zip: null };
          }
        }
      }
    }
  }

  // Try "[City] [StateCode]" at the end or within text (e.g. "house in Fishers IN")
  var cityCodeMatch = lower.match(/\b([a-z][a-z\s]{1,20}?)\s+([a-z]{2})\b/);
  if (cityCodeMatch) {
    var possibleCode = cityCodeMatch[2].toUpperCase();
    if (VALID_STATE_CODES.has(possibleCode) && possibleCode !== 'IN') {  // Skip "in" as it's ambiguous as a word
      return { city: capitalizeWords(cityCodeMatch[1].trim()), state: possibleCode, zip: null };
    }
    // For "IN" specifically, require it to follow a capitalized word to avoid matching "in" the preposition
    if (possibleCode === 'IN') {
      var inCodeMatch = text.match(/\b([A-Z][a-zA-Z\s]{1,20}?)\s+IN\b/);
      if (inCodeMatch) {
        return { city: inCodeMatch[1].trim(), state: 'IN', zip: null };
      }
    }
  }

  // Try standalone state (3+ char names only, to avoid matching "in" as Indiana)
  // Skip states that are mentioned in a negation context
  for (var key in STATE_MAP) {
    if (key.length >= 3 && lower.includes(key)) {
      var stateIsNegated = hasNegation && new RegExp('(?:not|n\'t)\\s+(?:.*?\\s+)?(?:in\\s+)?(?:.*?\\s+)?' + escapeRegExp(key), 'i').test(text);
      if (!stateIsNegated) {
        return { city: null, state: STATE_MAP[key], zip: null };
      }
    }
  }

  // Try 2-letter state codes as standalone (must be uppercase in original to avoid "in", "or", etc.)
  var stateCodeMatch = text.match(/\b([A-Z]{2})\b/);
  if (stateCodeMatch && VALID_STATE_CODES.has(stateCodeMatch[1])) {
    return { city: null, state: stateCodeMatch[1], zip: null };
  }

  // Fallback: treat entire text as city name (only if short)
  if (text.trim().split(/\s+/).length <= 3) {
    return { city: text.trim(), state: null, zip: null };
  }

  return { city: null, state: null, zip: null };
}

/**
 * Extract budget/price range from query text.
 */
function parseBudget(text) {
  if (!text) return { min: 0, max: 0 };

  var lower = text.toLowerCase();

  // Pattern: "$300k-$500k" or "$300,000-$500,000" or "300k to 500k"
  // Also: "between 300k and 500k", "300-500k"
  // Must NOT match "3-5 bedroom" or "2-3 bath" (those are bed/bath ranges, not prices)
  var rangePatterns = [
    /\$?([\d,.]+)\s*(k|m)?\s*(?:to|-|and)\s*\$?([\d,.]+)\s*(k|m)?(?!\s*(?:bed|bath|br|ba|bedroom|bathroom|acre))/i,
    /between\s*\$?([\d,.]+)\s*(k|m)?\s*(?:and|-)\s*\$?([\d,.]+)\s*(k|m)?(?!\s*(?:bed|bath|br|ba|bedroom|bathroom|acre))/i,
  ];

  for (var i = 0; i < rangePatterns.length; i++) {
    var match = lower.match(rangePatterns[i]);
    if (match) {
      var minVal = parseMoneyStr(match[1], match[2]);
      var maxVal = parseMoneyStr(match[3], match[4]);
      // Skip if both values are tiny and no $ or k/m suffix — likely bed/bath counts, not prices
      if (minVal <= 10000 && maxVal <= 10000 && !match[2] && !match[4] && !/\$/.test(match[0])) continue;
      if (minVal > maxVal) { var tmp = minVal; minVal = maxVal; maxVal = tmp; }
      return { min: minVal, max: maxVal };
    }
  }

  // Pattern: "budget of $1,000,000", "stay within my budget of $500k", "budget is 400k"
  var budgetOfMatch = lower.match(/budget\s+(?:of|is|:)\s*\$?([\d,]+)\s*(k|m)?/i);
  if (budgetOfMatch) {
    return { min: 0, max: parseMoneyStr(budgetOfMatch[1], budgetOfMatch[2]) };
  }

  // Pattern: "under $500k", "below 500k", "max 500k", "within $500k"
  var underMatch = lower.match(/(?:under|below|max|up to|at most|no more than|within)\s*\$?([\d,.]+)\s*(k|m)?/i);
  if (underMatch) {
    return { min: 0, max: parseMoneyStr(underMatch[1], underMatch[2]) };
  }

  // Pattern: "above $300k", "over 300k", "min 300k", "at least 300k"
  var overMatch = lower.match(/(?:above|over|min|at least|starting at|from)\s*\$?([\d,.]+)\s*(k|m)?/i);
  if (overMatch) {
    return { min: parseMoneyStr(overMatch[1], overMatch[2]), max: 0 };
  }

  // Pattern: "around $400k", "about 400k", "$400k"
  var aroundMatch = lower.match(/(?:around|about|approximately|~)?\s*\$?([\d,.]+)\s*(k|m)/i);
  if (aroundMatch) {
    var center = parseMoneyStr(aroundMatch[1], aroundMatch[2]);
    return { min: Math.round(center * 0.85), max: Math.round(center * 1.15) };
  }

  // Standalone dollar amount: "$500,000"
  var standaloneMatch = lower.match(/\$([\d,]+)/);
  if (standaloneMatch) {
    var val = parseFloat(standaloneMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 1000) {
      return { min: Math.round(val * 0.85), max: Math.round(val * 1.15) };
    }
  }

  return { min: 0, max: 0 };
}

function parseMoneyStr(numStr, suffix) {
  var n = parseFloat(numStr.replace(/,/g, ''));
  if (isNaN(n)) return 0;
  if (suffix) {
    var s = suffix.toLowerCase();
    if (s === 'k') return n * 1000;
    if (s === 'm') return n * 1000000;
  }
  // If the number is small (like 300, 500), assume thousands
  if (n > 0 && n < 10000) return n * 1000;
  return n;
}

/**
 * Extract bed/bath counts from query text.
 * Handles ranges like "3-5 bedroom" → extract minimum (3).
 */
function parseBedsAndBaths(text) {
  if (!text) return { beds: null, baths: null };

  var lower = text.toLowerCase();
  var beds = null;
  var baths = null;

  // Beds: check for range first ("3-5 bedroom" → min=3), then single number
  var bedRange = lower.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:bed(?:room)?s?|br)\b/i);
  if (bedRange) {
    beds = parseInt(bedRange[1], 10); // use the minimum
  } else {
    var bedPatterns = [
      /(\d+)\+?\s*[-]?\s*(?:bed(?:room)?s?|br)\b/i,
      /(?:bed(?:room)?s?|br)\s*[:=]?\s*(\d+)/i,
    ];
    for (var i = 0; i < bedPatterns.length; i++) {
      var m = lower.match(bedPatterns[i]);
      if (m) { beds = parseInt(m[1], 10); break; }
    }
  }

  // Baths: check for range first ("3-5 bathrooms" → min=3), then single number
  var bathRange = lower.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)\b/i);
  if (bathRange) {
    baths = parseFloat(bathRange[1]); // use the minimum
  } else {
    var bathPatterns = [
      /(\d+(?:\.\d+)?)\+?\s*[-]?\s*(?:bath(?:room)?s?|ba)\b/i,
      /(?:bath(?:room)?s?|ba)\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
    ];
    for (var j = 0; j < bathPatterns.length; j++) {
      var n = lower.match(bathPatterns[j]);
      if (n) { baths = parseFloat(n[1]); break; }
    }
  }

  return { beds: beds, baths: baths };
}

/**
 * Extract property type from query text.
 */
function parsePropertyType(text) {
  if (!text) return 'any';
  var lower = text.toLowerCase();

  if (/\b(?:single[- ]?family|house|home|detached)\b/.test(lower)) return 'house';
  if (/\b(?:condo(?:minium)?|apartment)\b/.test(lower)) return 'condo';
  if (/\b(?:townho(?:me|use)|row[- ]?house)\b/.test(lower)) return 'townhome';
  if (/\b(?:multi[- ]?family|duplex|triplex|fourplex)\b/.test(lower)) return 'multi_family';
  if (/\b(?:land|lot|acreage)\b/.test(lower)) return 'land';
  return 'any';
}

/**
 * Extract must-haves and nice-to-haves from query text.
 */
function parseMustHaveAndNiceToHave(text) {
  if (!text) return { mustHave: [], niceToHave: [] };

  var lower = text.toLowerCase();
  var mustHave = [];
  var niceToHave = [];

  // Must-have patterns: "must have X", "need X", "require X", "has to have X"
  var mustPatterns = [
    /(?:must\s+have|need|require|needs?\s+to\s+have|has?\s+to\s+have|gotta\s+have)\s+(?:a\s+)?([^,.;]+)/gi,
  ];
  for (var i = 0; i < mustPatterns.length; i++) {
    var match;
    while ((match = mustPatterns[i].exec(lower)) !== null) {
      var items = match[1].split(/\s+and\s+/);
      items.forEach(function (item) {
        var cleaned = item.trim().replace(/^(?:a|an|the)\s+/i, '');
        if (cleaned.length > 1 && cleaned.length < 50) {
          mustHave.push(cleaned);
        }
      });
    }
  }

  // Nice-to-have patterns: "would like X", "prefer X", "nice to have X", "ideally X"
  var nicePatterns = [
    /(?:would\s+(?:like|love|prefer)|nice\s+to\s+have|prefer(?:ably)?|ideally|bonus\s+if)\s+(?:a\s+)?([^,.;]+)/gi,
  ];
  for (var j = 0; j < nicePatterns.length; j++) {
    var nMatch;
    while ((nMatch = nicePatterns[j].exec(lower)) !== null) {
      var nItems = nMatch[1].split(/\s+and\s+/);
      nItems.forEach(function (item) {
        var cleaned = item.trim().replace(/^(?:a|an|the)\s+/i, '');
        if (cleaned.length > 1 && cleaned.length < 50) {
          niceToHave.push(cleaned);
        }
      });
    }
  }

  // Also detect feature keywords that are strong indicators as must-haves
  var featureKeywords = [
    'pool', 'garage', 'home gym', 'home office', 'basement', 'fireplace',
    'solar panels', 'smart home', 'backyard', 'fenced yard', 'patio',
    'workshop', 'ev charger',
  ];

  featureKeywords.forEach(function (kw) {
    // Only add if mentioned but not already captured by must/nice patterns
    if (lower.includes(kw)) {
      var alreadyMust = mustHave.some(function (m) { return m.includes(kw); });
      var alreadyNice = niceToHave.some(function (n) { return n.includes(kw); });
      if (!alreadyMust && !alreadyNice) {
        // Check if preceded by "must" / "need" in context
        var mustContext = new RegExp('(?:must|need|require)\\s+(?:a\\s+)?' + escapeRegExp(kw), 'i');
        var niceContext = new RegExp('(?:would like|prefer|nice)\\s+(?:a\\s+)?' + escapeRegExp(kw), 'i');
        if (mustContext.test(lower)) {
          mustHave.push(kw);
        } else if (niceContext.test(lower)) {
          niceToHave.push(kw);
        }
        // If standalone mention, treat as nice-to-have
        // (only if it appears as a clear feature request, not inside another phrase)
      }
    }
  });

  return { mustHave: mustHave, niceToHave: niceToHave };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect lifestyle tags from query text.
 */
function parseLifestyleTags(text) {
  if (!text) return [];
  var lower = text.toLowerCase();
  var tags = [];

  var LIFESTYLE_KEYWORDS = {
    fitness_focused: [
      'gym', 'lift', 'workout', 'fitness', 'exercise', 'crossfit', 'peloton',
      'yoga', 'garage gym', 'home gym', 'squat', 'rack', 'weights',
    ],
    family: [
      'kids', 'children', 'school', 'family', 'baby', 'nursery', 'daycare',
      'playground', 'backyard', 'safe neighborhood', 'school district',
    ],
    remote_work: [
      'remote work', 'work from home', 'home office', 'wfh', 'remote',
    ],
    investor: [
      'invest', 'rental', 'rental income', 'cash flow', 'roi', 'flip',
      'passive income', 'airbnb', 'duplex', 'multi-family',
    ],
    luxury: [
      'luxury', 'upscale', 'premium', 'high-end', 'executive', 'estate',
      'waterfront', 'ocean view',
    ],
    starter_home: [
      'first home', 'starter', 'first-time', 'first time buyer', 'affordable',
      'entry level',
    ],
    outdoors: [
      'trail', 'hike', 'hiking', 'bike', 'biking', 'nature', 'park',
      'outdoor', 'garden',
    ],
    entertainment: [
      'entertain', 'hosting', 'party', 'pool party', 'media room',
      'game room', 'outdoor kitchen',
    ],
    sustainability: [
      'solar', 'green', 'sustainable', 'energy efficient', 'ev charger',
      'eco', 'net zero',
    ],
  };

  for (var tag in LIFESTYLE_KEYWORDS) {
    var keywords = LIFESTYLE_KEYWORDS[tag];
    for (var i = 0; i < keywords.length; i++) {
      if (lower.includes(keywords[i])) {
        tags.push(tag);
        break; // only add tag once
      }
    }
  }

  return tags;
}

/**
 * Detect investment goal from query text.
 */
function parseInvestmentGoal(text) {
  if (!text) return 'unknown';
  var lower = text.toLowerCase();

  if (/\b(?:airbnb|short[- ]?term\s+rental|vacation\s+rental|str)\b/.test(lower)) return 'airbnb';
  if (/\b(?:flip(?:ping)?|fixer[- ]?upper|rehab)\b/.test(lower)) return 'flip';
  if (/\b(?:rental|rent\s+out|tenant|landlord|income\s+property|cash\s+flow)\b/.test(lower)) return 'rental';
  if (/\b(?:invest(?:ment)?|portfolio|roi|cap\s+rate)\b/.test(lower)) return 'rental';
  if (/\b(?:primary|live\s+in|move\s+in|my\s+home|our\s+home|first\s+home)\b/.test(lower)) return 'primary_home';

  return 'unknown';
}

/**
 * Extract sqft minimum from query text.
 */
function parseSqft(text) {
  if (!text) return null;
  var lower = text.toLowerCase();

  // "at least 2000 sqft", "min 2000 sq ft", "2000+ sqft", "2,000 square feet"
  var patterns = [
    /(?:at\s+least|min(?:imum)?|over)\s*([\d,]+)\s*(?:sq\s*ft|square\s*feet|sqft)/i,
    /([\d,]+)\+?\s*(?:sq\s*ft|square\s*feet|sqft)/i,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = lower.match(patterns[i]);
    if (m) {
      return parseInt(m[1].replace(/,/g, ''), 10);
    }
  }
  return null;
}

/**
 * Extract lot size in sqft from query text (handles acres).
 * "at least 1 acre" → 43560 sqft, "0.5 acres" → 21780 sqft
 */
function parseLotSize(text) {
  if (!text) return null;
  var lower = text.toLowerCase();

  // Acre patterns: "at least 1 acre", "1+ acres", "min 2 acres", "half acre"
  var acrePatterns = [
    /(?:at\s+least|min(?:imum)?|over)\s+([\d,.]+)\s*(?:acres?|ac)\b/i,
    /([\d,.]+)\+?\s*(?:acres?|ac)\b/i,
    /(?:half|½)\s*(?:an?\s+)?acre/i,
  ];

  for (var i = 0; i < acrePatterns.length; i++) {
    var m = lower.match(acrePatterns[i]);
    if (m) {
      if (acrePatterns[i].source.includes('half')) {
        return Math.round(0.5 * 43560); // half acre in sqft
      }
      var acres = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(acres) && acres > 0) {
        return Math.round(acres * 43560); // convert acres to sqft
      }
    }
  }

  // Also check for lot sqft directly: "lot size 5000 sqft"
  var lotSqft = lower.match(/lot\s+(?:size\s+)?(?:at\s+least\s+)?([\d,]+)\s*(?:sq\s*ft|square\s*feet|sqft)/i);
  if (lotSqft) {
    return parseInt(lotSqft[1].replace(/,/g, ''), 10);
  }

  return null;
}

/**
 * Detect risk tolerance from text.
 */
function parseRiskTolerance(text) {
  if (!text) return 'medium';
  var lower = text.toLowerCase();

  if (/\b(?:safe|conservative|low\s+risk|no\s+risk|secure|stable)\b/.test(lower)) return 'low';
  if (/\b(?:aggressive|high\s+risk|speculative|gamble|risky)\b/.test(lower)) return 'high';
  return 'medium';
}

/**
 * Generate clarifying questions based on what was NOT provided.
 */
function generateClarifyingQuestions(intent) {
  var questions = [];

  if (!intent.location.city && !intent.location.state && !intent.location.zip) {
    questions.push('What city or area are you looking in?');
  }
  if (intent.budget.min === 0 && intent.budget.max === 0) {
    questions.push('What is your budget range?');
  }
  if (intent.bedrooms == null) {
    questions.push('How many bedrooms do you need?');
  }
  if (intent.propertyType === 'any') {
    questions.push('Are you looking for a house, condo, townhome, or something else?');
  }
  if (intent.investmentGoal === 'unknown') {
    questions.push('Is this for your primary home, rental investment, or something else?');
  }
  if (intent.lifestyleTags.length === 0) {
    questions.push('Any lifestyle priorities? (e.g., fitness space, good schools, remote work)');
  }

  return questions.slice(0, 3);
}

/**
 * Calculate confidence based on how much info was extracted.
 */
function calcConfidence(intent) {
  var score = 0;
  var factors = 0;

  factors++;
  if (intent.location.city || intent.location.state) score++;

  factors++;
  if (intent.budget.min > 0 || intent.budget.max > 0) score++;

  factors++;
  if (intent.bedrooms != null) score++;

  factors++;
  if (intent.propertyType !== 'any') score += 0.7;
  else score += 0.3;

  factors++;
  if (intent.mustHave.length > 0 || intent.niceToHave.length > 0) score++;

  factors++;
  if (intent.lifestyleTags.length > 0) score += 0.8;
  else score += 0.2;

  factors++;
  if (intent.investmentGoal !== 'unknown') score++;

  return Math.round((score / factors) * 100) / 100;
}

/**
 * Generate UI chips from the parsed intent.
 */
function generateChips(intent) {
  var chips = [];

  if (intent.location.city) {
    chips.push({ label: 'Location', value: intent.location.city + (intent.location.state ? ', ' + intent.location.state : '') });
  } else if (intent.location.state) {
    chips.push({ label: 'State', value: intent.location.state });
  }

  if (intent.budget.min > 0 || intent.budget.max > 0) {
    var budgetStr = '';
    if (intent.budget.min > 0 && intent.budget.max > 0) {
      budgetStr = formatShortPrice(intent.budget.min) + '-' + formatShortPrice(intent.budget.max);
    } else if (intent.budget.max > 0) {
      budgetStr = 'Up to ' + formatShortPrice(intent.budget.max);
    } else {
      budgetStr = formatShortPrice(intent.budget.min) + '+';
    }
    chips.push({ label: 'Budget', value: budgetStr });
  }

  if (intent.bedrooms != null) {
    chips.push({ label: 'Beds', value: intent.bedrooms + '+' });
  }

  if (intent.bathrooms != null) {
    chips.push({ label: 'Baths', value: intent.bathrooms + '+' });
  }

  if (intent.propertyType !== 'any') {
    var typeLabels = {
      house: 'House',
      condo: 'Condo',
      townhome: 'Townhome',
      multi_family: 'Multi-Family',
      land: 'Land',
    };
    chips.push({ label: 'Type', value: typeLabels[intent.propertyType] || intent.propertyType });
  }

  intent.mustHave.forEach(function (item) {
    chips.push({ label: 'Must Have', value: capitalizeWords(item) });
  });

  intent.lifestyleTags.forEach(function (tag) {
    var tagLabels = {
      fitness_focused: 'Fitness Focused',
      family: 'Family',
      remote_work: 'Remote Work',
      investor: 'Investor',
      luxury: 'Luxury',
      starter_home: 'Starter Home',
      outdoors: 'Outdoors',
      entertainment: 'Entertainment',
      sustainability: 'Sustainability',
    };
    chips.push({ label: 'Lifestyle', value: tagLabels[tag] || tag });
  });

  if (intent.investmentGoal !== 'unknown') {
    var goalLabels = {
      primary_home: 'Primary Home',
      rental: 'Rental',
      flip: 'Flip',
      airbnb: 'Airbnb',
    };
    chips.push({ label: 'Goal', value: goalLabels[intent.investmentGoal] || intent.investmentGoal });
  }

  if (intent.constraints.sqftMin) {
    chips.push({ label: 'Min Sqft', value: intent.constraints.sqftMin.toLocaleString() });
  }

  if (intent.constraints.lotSizeMin) {
    var acres = intent.constraints.lotSizeMin / 43560;
    var lotLabel = acres >= 1 ? acres.toFixed(1).replace(/\.0$/, '') + ' acre' + (acres !== 1 ? 's' : '') : (acres * 43560).toLocaleString() + ' sqft lot';
    chips.push({ label: 'Min Lot', value: lotLabel });
  }

  return chips;
}

function formatShortPrice(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + n;
}

function capitalizeWords(s) {
  return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

// ---------------------------------------------------------------------------
// POST /api/intent/parse
// ---------------------------------------------------------------------------

router.post('/parse', async function (req, res) {
  try {
    var locationText = req.body.locationText || '';
    var queryText = req.body.queryText || '';

    if (!locationText && !queryText) {
      return res.status(400).json({ error: 'locationText or queryText is required' });
    }

    // Combine texts for feature extraction (some people put everything in one field)
    var combinedText = (locationText + ' ' + queryText).trim();

    // Parse individual components
    var location = parseLocation(locationText || queryText);
    var budget = parseBudget(queryText);
    var bedsAndBaths = parseBedsAndBaths(queryText);
    var propertyType = parsePropertyType(queryText);
    var mustAndNice = parseMustHaveAndNiceToHave(queryText);
    var lifestyleTags = parseLifestyleTags(combinedText);
    var investmentGoal = parseInvestmentGoal(queryText);
    var sqftMin = parseSqft(queryText);
    var lotSizeMin = parseLotSize(queryText);
    var riskTolerance = parseRiskTolerance(queryText);

    // Build raw intent object
    var rawIntent = {
      location: location,
      budget: budget,
      bedrooms: bedsAndBaths.beds,
      bathrooms: bedsAndBaths.baths,
      propertyType: propertyType,
      mustHave: mustAndNice.mustHave,
      niceToHave: mustAndNice.niceToHave,
      constraints: {
        maxCommuteMinutes: null,
        schoolQuality: null,
        lotSizeMin: lotSizeMin,
        sqftMin: sqftMin,
      },
      lifestyleTags: lifestyleTags,
      investmentGoal: investmentGoal,
      riskTolerance: riskTolerance,
      confidence: 0,
      clarifyingQuestions: [],
    };

    // Validate and clean
    var validation = validateIntent(rawIntent);
    var intent = validation.data;

    // Compute confidence and clarifying questions
    intent.confidence = calcConfidence(intent);
    intent.clarifyingQuestions = generateClarifyingQuestions(intent);

    // Generate chips
    var chips = generateChips(intent);

    res.json({
      intent: intent,
      chips: chips,
      confidence: intent.confidence,
      validationErrors: validation.errors,
    });
  } catch (err) {
    console.error('intent/parse error:', err);
    res.status(500).json({ error: 'Failed to parse intent' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/intent/search
// ---------------------------------------------------------------------------

router.post('/search', async function (req, res) {
  try {
    var rawIntent = req.body.intent;

    if (!rawIntent) {
      return res.status(400).json({ error: 'intent object is required' });
    }

    // Validate intent
    var validation = validateIntent(rawIntent);
    if (!validation.valid && !validation.data) {
      return res.status(400).json({ error: 'Invalid intent', details: validation.errors });
    }
    var intent = validation.data;

    // Build location and filters for the provider
    var location = {};
    if (intent.location.city) location.city = intent.location.city;
    if (intent.location.state) location.state = intent.location.state;
    if (intent.location.zip) location.zip = intent.location.zip;

    var filters = {};
    if (intent.budget.min > 0) filters.priceMin = intent.budget.min;
    if (intent.budget.max > 0) filters.priceMax = intent.budget.max;
    if (intent.bedrooms != null) filters.bedsMin = intent.bedrooms;
    if (intent.bathrooms != null) filters.bathsMin = intent.bathrooms;
    if (intent.constraints.sqftMin) filters.sqftMin = intent.constraints.sqftMin;
    if (intent.propertyType && intent.propertyType !== 'any') {
      filters.propType = intent.propertyType;
    }

    // Fetch listings - use a larger limit to score and rank
    filters.limit = 50;
    filters.offset = 0;

    var result = await provider.search(location, filters);
    var fetchedListings = result.listings;

    // Score each listing
    var scored = fetchedListings.map(function (listing) {
      var scoreBreakdown = scoreListing(intent, listing);
      return {
        listing: listing,
        scoreBreakdown: scoreBreakdown,
      };
    });

    // Sort by total score descending
    scored.sort(function (a, b) {
      return b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore;
    });

    // Build filters_applied summary
    var filtersApplied = [];
    if (location.city) filtersApplied.push('city: ' + location.city);
    if (location.state) filtersApplied.push('state: ' + location.state);
    if (filters.priceMin) filtersApplied.push('price >= $' + filters.priceMin.toLocaleString());
    if (filters.priceMax) filtersApplied.push('price <= $' + filters.priceMax.toLocaleString());
    if (filters.bedsMin) filtersApplied.push('beds >= ' + filters.bedsMin);
    if (filters.bathsMin) filtersApplied.push('baths >= ' + filters.bathsMin);
    if (filters.sqftMin) filtersApplied.push('sqft >= ' + filters.sqftMin);
    if (filters.propType) filtersApplied.push('type: ' + filters.propType);

    res.json({
      results: scored,
      total: scored.length,
      filters_applied: filtersApplied,
    });
  } catch (err) {
    console.error('intent/search error:', err);
    res.status(500).json({ error: 'Failed to search listings' });
  }
});

module.exports = router;
