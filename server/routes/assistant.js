const express = require('express');
const router = express.Router();

/**
 * AI Home-Finding Assistant
 *
 * Manages a conversation flow to extract home preferences.
 * Works entirely server-side with rule-based logic (no LLM API needed).
 *
 * Conversation steps:
 * 1. Greeting + ask location
 * 2. Ask budget
 * 3. Ask bedrooms/bathrooms
 * 4. Ask property type
 * 5. Ask about must-have features (pool, gym, garage, etc.)
 * 6. Ask about lifestyle preferences
 * 7. Summarize & generate search params
 */

const STEPS = {
  GREETING: 'greeting',
  LOCATION: 'location',
  BUDGET: 'budget',
  ROOMS: 'rooms',
  PROPERTY_TYPE: 'property_type',
  FEATURES: 'features',
  LIFESTYLE: 'lifestyle',
  SUMMARY: 'summary',
};

// Feature keywords to detect in user messages
const FEATURE_KEYWORDS = {
  pool: ['pool', 'swimming', 'swim'],
  garage: ['garage', 'car port', 'carport', 'parking'],
  gym: ['gym', 'home gym', 'workout', 'exercise', 'fitness'],
  yard: ['yard', 'backyard', 'garden', 'lawn', 'outdoor space'],
  basement: ['basement', 'finished basement', 'lower level'],
  fireplace: ['fireplace', 'hearth'],
  updated_kitchen: ['modern kitchen', 'updated kitchen', 'new kitchen', 'renovated kitchen', 'granite', 'stainless'],
  hardwood: ['hardwood', 'wood floors', 'hardwood floors'],
  smart_home: ['smart home', 'smart', 'automation', 'connected'],
  solar: ['solar', 'solar panels', 'energy efficient'],
  office: ['office', 'home office', 'work from home', 'wfh', 'remote work'],
  open_floor: ['open floor', 'open concept', 'open plan', 'open layout'],
  patio: ['patio', 'deck', 'porch', 'balcony', 'outdoor living'],
  walk_in_closet: ['walk-in closet', 'walk in closet', 'walkin closet', 'large closet'],
  laundry: ['laundry room', 'washer', 'dryer', 'in-unit laundry'],
};

// State code lookup
const STATE_LOOKUP = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'dc': 'DC', 'washington dc': 'DC',
  // Common abbreviations
  'indy': 'IN', 'indianapolis': 'IN', 'la': 'CA', 'nyc': 'NY',
  'philly': 'PA', 'chicago': 'IL', 'houston': 'TX', 'dallas': 'TX',
  'austin': 'TX', 'denver': 'CO', 'seattle': 'WA', 'portland': 'OR',
  'miami': 'FL', 'tampa': 'FL', 'orlando': 'FL', 'atlanta': 'GA',
  'phoenix': 'AZ', 'las vegas': 'NV', 'san francisco': 'CA', 'san diego': 'CA',
  'los angeles': 'CA', 'boston': 'MA', 'detroit': 'MI', 'nashville': 'TN',
  'charlotte': 'NC', 'raleigh': 'NC', 'minneapolis': 'MN', 'columbus': 'OH',
  'cleveland': 'OH', 'pittsburgh': 'PA', 'baltimore': 'MD', 'milwaukee': 'WI',
  'kansas city': 'MO', 'st louis': 'MO', 'saint louis': 'MO',
};

// City name extraction for well-known cities
const CITY_NAMES = {
  'indy': 'Indianapolis', 'indianapolis': 'Indianapolis',
  'la': 'Los Angeles', 'los angeles': 'Los Angeles',
  'nyc': 'New York', 'new york': 'New York', 'new york city': 'New York',
  'philly': 'Philadelphia', 'philadelphia': 'Philadelphia',
  'chicago': 'Chicago', 'houston': 'Houston', 'dallas': 'Dallas',
  'austin': 'Austin', 'denver': 'Denver', 'seattle': 'Seattle',
  'portland': 'Portland', 'miami': 'Miami', 'tampa': 'Tampa',
  'orlando': 'Orlando', 'atlanta': 'Atlanta', 'phoenix': 'Phoenix',
  'las vegas': 'Las Vegas', 'san francisco': 'San Francisco',
  'san diego': 'San Diego', 'boston': 'Boston', 'detroit': 'Detroit',
  'nashville': 'Nashville', 'charlotte': 'Charlotte', 'raleigh': 'Raleigh',
  'minneapolis': 'Minneapolis', 'columbus': 'Columbus', 'cleveland': 'Cleveland',
  'pittsburgh': 'Pittsburgh', 'baltimore': 'Baltimore', 'milwaukee': 'Milwaukee',
  'kansas city': 'Kansas City', 'st louis': 'St Louis', 'saint louis': 'St Louis',
};

router.post('/chat', (req, res) => {
  const { message, conversationState } = req.body;
  const state = conversationState || { step: STEPS.GREETING, preferences: {}, features: [] };
  const userMsg = (message || '').trim().toLowerCase();

  let reply = '';
  let nextState = { ...state, preferences: { ...state.preferences }, features: [...(state.features || [])] };
  let searchReady = false;
  let searchParams = null;

  switch (state.step) {
    case STEPS.GREETING: {
      reply = `Hey there! I'm your AI home-finding assistant. I'll help you find exactly the right home by asking a few questions about what you're looking for.\n\nLet's start with the basics - **what city and state are you looking to buy in?**\n\nYou can say something like "Indianapolis, Indiana" or just "Austin, TX"`;
      nextState.step = STEPS.LOCATION;
      break;
    }

    case STEPS.LOCATION: {
      const parsed = parseLocation(userMsg);
      if (parsed.city && parsed.state) {
        nextState.preferences.city = parsed.city;
        nextState.preferences.stateCode = parsed.state;
        reply = `Great choice! **${parsed.city}, ${parsed.state}** is a wonderful area.\n\nNow let's talk money - **what's your budget range?**\n\nYou can say something like:\n- "200k to 400k"\n- "Under 500,000"\n- "Around 300k"\n- "No limit"`;
        nextState.step = STEPS.BUDGET;
      } else {
        reply = `I didn't quite catch that. Could you tell me the **city and state** where you'd like to search?\n\nFor example: "Indianapolis, Indiana" or "Austin, TX"`;
      }
      break;
    }

    case STEPS.BUDGET: {
      const budget = parseBudget(userMsg);
      nextState.preferences.priceMin = budget.min;
      nextState.preferences.priceMax = budget.max;

      const budgetStr = budget.max
        ? `$${(budget.min || 0).toLocaleString()} - $${budget.max.toLocaleString()}`
        : 'Flexible budget';

      reply = `Got it! Budget: **${budgetStr}**\n\nHow many **bedrooms** and **bathrooms** do you need?\n\nYou can say things like:\n- "3 bedrooms 2 bathrooms"\n- "4 bed 3 bath"\n- "At least 3 beds"`;
      nextState.step = STEPS.ROOMS;
      break;
    }

    case STEPS.ROOMS: {
      const rooms = parseRooms(userMsg);
      if (rooms.beds) nextState.preferences.beds = rooms.beds;
      if (rooms.baths) nextState.preferences.baths = rooms.baths;

      const roomStr = [
        rooms.beds ? `${rooms.beds} bedrooms` : null,
        rooms.baths ? `${rooms.baths} bathrooms` : null,
      ].filter(Boolean).join(' and ') || 'Flexible';

      reply = `Perfect! **${roomStr}** it is.\n\nWhat **type of property** are you looking for?\n\n- **House** - Single family home\n- **Condo** - Condominium\n- **Townhome** - Townhouse\n- **Any** - Open to all types`;
      nextState.step = STEPS.PROPERTY_TYPE;
      break;
    }

    case STEPS.PROPERTY_TYPE: {
      const propType = parsePropertyType(userMsg);
      nextState.preferences.propType = propType;

      const typeLabel = propType ? propType.charAt(0).toUpperCase() + propType.slice(1) : 'Any type';

      reply = `Nice! **${typeLabel}** works.\n\nNow for the fun part - tell me about your **must-have features**! What's important to you in a home?\n\nFor example:\n- Pool, home gym, big yard\n- Modern kitchen, hardwood floors, fireplace\n- Home office, smart home features\n- Open floor plan, patio, walk-in closets\n\nList as many as you'd like, or say **"skip"** if you don't have specifics.`;
      nextState.step = STEPS.FEATURES;
      break;
    }

    case STEPS.FEATURES: {
      if (userMsg !== 'skip' && userMsg !== 'none' && userMsg !== 'no') {
        const detectedFeatures = detectFeatures(userMsg);
        nextState.features = [...new Set([...nextState.features, ...detectedFeatures])];
      }

      const featureList = nextState.features.length > 0
        ? nextState.features.map(f => f.replace(/_/g, ' ')).join(', ')
        : 'None specified';

      reply = `Got it! Features noted: **${featureList}**\n\nOne last question - what's your **lifestyle priority**? This helps me rank the results better.\n\n- **Family** - Good schools, safe neighborhood, yard space\n- **Professional** - Close to downtown, home office, modern\n- **Active** - Near parks/trails, gym, outdoor space\n- **Entertaining** - Open floor plan, pool, large kitchen\n- **Low maintenance** - Condo/small yard, newer build\n- **Skip** - No particular preference`;
      nextState.step = STEPS.LIFESTYLE;
      break;
    }

    case STEPS.LIFESTYLE: {
      const lifestyle = parseLifestyle(userMsg);
      nextState.preferences.lifestyle = lifestyle;

      // Apply lifestyle-based feature boosts
      if (lifestyle === 'family') {
        nextState.features = [...new Set([...nextState.features, 'yard'])];
      } else if (lifestyle === 'entertaining') {
        nextState.features = [...new Set([...nextState.features, 'open_floor', 'patio'])];
      } else if (lifestyle === 'active') {
        nextState.features = [...new Set([...nextState.features, 'yard', 'gym'])];
      } else if (lifestyle === 'professional') {
        nextState.features = [...new Set([...nextState.features, 'office'])];
      }

      // Build summary
      const p = nextState.preferences;
      const featureList = nextState.features.length > 0
        ? nextState.features.map(f => `  - ${f.replace(/_/g, ' ')}`).join('\n')
        : '  - None specified';

      const budgetStr = p.priceMax
        ? `$${(p.priceMin || 0).toLocaleString()} - $${p.priceMax.toLocaleString()}`
        : 'Flexible';

      reply = `Here's a summary of what you're looking for:\n\n` +
        `**Location:** ${p.city}, ${p.stateCode}\n` +
        `**Budget:** ${budgetStr}\n` +
        `**Bedrooms:** ${p.beds || 'Any'}\n` +
        `**Bathrooms:** ${p.baths || 'Any'}\n` +
        `**Property Type:** ${p.propType || 'Any'}\n` +
        `**Desired Features:**\n${featureList}\n` +
        `**Lifestyle:** ${lifestyle || 'Not specified'}\n\n` +
        `Click **"Search Now"** below and I'll find the best matches for you! You can also type **"change"** to start over.`;

      nextState.step = STEPS.SUMMARY;
      searchReady = true;
      searchParams = {
        city: p.city || '',
        stateCode: p.stateCode || '',
        priceMin: p.priceMin ? String(p.priceMin) : '',
        priceMax: p.priceMax ? String(p.priceMax) : '',
        beds: p.beds ? String(p.beds) : '',
        baths: p.baths ? String(p.baths) : '',
        propType: p.propType || '',
      };
      break;
    }

    case STEPS.SUMMARY: {
      if (userMsg.includes('change') || userMsg.includes('start over') || userMsg.includes('restart')) {
        nextState = { step: STEPS.GREETING, preferences: {}, features: [] };
        reply = `No problem! Let's start fresh.\n\nI'm your AI home-finding assistant. **What city and state are you looking to buy in?**`;
        nextState.step = STEPS.LOCATION;
      } else if (userMsg.includes('search') || userMsg.includes('find') || userMsg.includes('go')) {
        searchReady = true;
        const p = nextState.preferences;
        searchParams = {
          city: p.city || '',
          stateCode: p.stateCode || '',
          priceMin: p.priceMin ? String(p.priceMin) : '',
          priceMax: p.priceMax ? String(p.priceMax) : '',
          beds: p.beds ? String(p.beds) : '',
          baths: p.baths ? String(p.baths) : '',
          propType: p.propType || '',
        };
        reply = `Searching now! I'll find the best matches based on everything you told me.`;
      } else {
        reply = `Click **"Search Now"** to find your matches, or type **"change"** to update your preferences.`;
        searchReady = true;
        const p = nextState.preferences;
        searchParams = {
          city: p.city || '',
          stateCode: p.stateCode || '',
          priceMin: p.priceMin ? String(p.priceMin) : '',
          priceMax: p.priceMax ? String(p.priceMax) : '',
          beds: p.beds ? String(p.beds) : '',
          baths: p.baths ? String(p.baths) : '',
          propType: p.propType || '',
        };
      }
      break;
    }

    default: {
      nextState = { step: STEPS.GREETING, preferences: {}, features: [] };
      reply = `Let's start over! **What city and state are you looking to buy in?**`;
      nextState.step = STEPS.LOCATION;
    }
  }

  res.json({
    reply,
    conversationState: nextState,
    searchReady,
    searchParams,
  });
});

/**
 * AI Prompt Parser - Single-shot natural language search
 *
 * Parses a full prompt like "3 bed house in Austin TX with a pool under 500k"
 * and extracts all search params + features at once.
 */
router.post('/parse-prompt', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const text = prompt.trim().toLowerCase();

  // Extract location
  const location = parsePromptLocation(text);

  // Extract rooms first, then strip room numbers before parsing budget
  const rooms = parseRooms(text);

  // Extract acreage / lot size (must happen before budget parsing)
  const acreage = parseAcreage(text);

  // Remove room numbers AND acreage so they don't get counted as prices
  const textForBudget = text
    .replace(/\d+\s*(?:bed|bedroom|br|bd)/gi, '')
    .replace(/[\d.]+\s*(?:bath|bathroom|ba)\b/gi, '')
    .replace(/[\d,.]+\s*(?:acre|acres)\b/gi, '');
  const budget = parseBudget(textForBudget);

  // Extract property type
  const propType = parsePropertyType(text);

  // Extract features
  const features = detectAllFeatures(text);

  // Build AI note about what was understood
  const parts = [];
  if (location.city) parts.push(`searching in ${location.city}, ${location.state}`);
  if (budget.max) parts.push(`budget up to $${budget.max.toLocaleString()}`);
  if (budget.min && !budget.max) parts.push(`budget from $${budget.min.toLocaleString()}+`);
  if (rooms.beds) parts.push(`${rooms.beds}+ bedrooms`);
  if (rooms.baths) parts.push(`${rooms.baths}+ bathrooms`);
  if (acreage) parts.push(`${acreage}+ acres`);
  if (propType) parts.push(`${propType} type`);
  if (features.length > 0) parts.push(`with ${features.length} feature preference${features.length > 1 ? 's' : ''}`);

  const aiNote = parts.length > 0
    ? `Searching for homes: ${parts.join(', ')}.`
    : 'Tell me more about what you\'re looking for — try including a city and state!';

  // Convert acreage to lot_sqft for the API (1 acre = 43,560 sqft)
  const lotSqftMin = acreage ? Math.round(acreage * 43560) : null;

  res.json({
    searchParams: {
      city: location.city || '',
      stateCode: location.state || '',
      priceMin: budget.min ? String(budget.min) : '',
      priceMax: budget.max ? String(budget.max) : '',
      beds: rooms.beds ? String(rooms.beds) : '',
      baths: rooms.baths ? String(rooms.baths) : '',
      propType: propType || '',
      lotSqftMin: lotSqftMin ? String(lotSqftMin) : '',
    },
    features,
    aiNote,
    confidence: location.city ? 'high' : 'low',
  });
});

/**
 * Enhanced location parser for single-prompt mode.
 * Handles: "in Austin TX", "Austin, Texas", "house in Miami", etc.
 */
function parsePromptLocation(text) {
  let city = null;
  let state = null;

  // Pattern: "in <city>, <state>" or "in <city> <state_code>"
  const inCityStateComma = text.match(/in\s+([a-z\s]+),\s*([a-z\s]+?)(?:\s+with|\s+under|\s+over|\s+around|\s+for|\s+\d|$)/i);
  if (inCityStateComma) {
    const cityPart = inCityStateComma[1].trim();
    const statePart = inCityStateComma[2].trim();
    state = STATE_LOOKUP[statePart] || (statePart.length === 2 ? statePart.toUpperCase() : null);
    if (state && state.length === 2) {
      city = CITY_NAMES[cityPart] || capitalize(cityPart);
    }
  }

  // Pattern: "in <city> <two-letter state code>"
  if (!city) {
    const inCityCode = text.match(/in\s+([a-z\s]+?)\s+([a-z]{2})(?:\s|$|,)/i);
    if (inCityCode) {
      const cityPart = inCityCode[1].trim();
      const codePart = inCityCode[2].toUpperCase();
      // Verify it's a real state code
      const validCodes = Object.values(STATE_LOOKUP);
      if (validCodes.includes(codePart)) {
        state = codePart;
        city = CITY_NAMES[cityPart] || capitalize(cityPart);
      }
    }
  }

  // Check for well-known city names anywhere in text
  if (!city) {
    // Sort by length descending so "san francisco" matches before "san"
    const sortedCities = Object.entries(CITY_NAMES).sort((a, b) => b[0].length - a[0].length);
    for (const [key, name] of sortedCities) {
      if (text.includes(key)) {
        city = name;
        state = STATE_LOOKUP[key];
        break;
      }
    }
  }

  // Fallback: check for "city, state" pattern anywhere
  if (!city) {
    const parsed = parseLocation(text);
    city = parsed.city;
    state = parsed.state;
  }

  return { city, state };
}

/**
 * Enhanced feature detection for single-prompt mode.
 * Includes additional keywords for natural language descriptions.
 */
function detectAllFeatures(text) {
  const EXTENDED_FEATURES = {
    ...FEATURE_KEYWORDS,
    heated_floors: ['heated floor', 'radiant floor', 'radiant heat', 'floor heating'],
    ev_charger: ['ev charger', 'ev charging', 'electric vehicle', 'tesla charger', 'charger'],
    waterfront: ['waterfront', 'water front', 'lakefront', 'ocean view', 'ocean front', 'beachfront', 'lake view', 'river view', 'bay view'],
    barn: ['barn', 'horse barn', 'stable', 'stables', 'equestrian'],
    workshop: ['workshop', 'shop building', 'outbuilding'],
    acreage: ['acre', 'acres', 'acreage', 'land', 'large lot'],
    farm: ['farm', 'farmhouse', 'ranch', 'homestead', 'agricultural'],
    fenced: ['fenced', 'fencing', 'fence', 'fenced yard', 'fenced property'],
  };

  const found = [];
  for (const [feature, keywords] of Object.entries(EXTENDED_FEATURES)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        found.push(feature);
        break;
      }
    }
  }
  return [...new Set(found)];
}

// --- Parsing helpers ---

function parseLocation(text) {
  let city = null;
  let state = null;

  // Check for "city, state" pattern
  const commaMatch = text.match(/([a-z\s]+),\s*([a-z\s]+)/);
  if (commaMatch) {
    const cityPart = commaMatch[1].trim();
    const statePart = commaMatch[2].trim();

    // Try state part as state code or name
    state = STATE_LOOKUP[statePart] || statePart.toUpperCase();
    if (state.length !== 2) state = null;

    city = CITY_NAMES[cityPart] || capitalize(cityPart);
  }

  // Check for known city names
  if (!city) {
    for (const [key, name] of Object.entries(CITY_NAMES)) {
      if (text.includes(key)) {
        city = name;
        state = STATE_LOOKUP[key];
        break;
      }
    }
  }

  // Try "city state" without comma
  if (!city) {
    for (const [stateName, code] of Object.entries(STATE_LOOKUP)) {
      if (text.includes(stateName)) {
        state = code;
        const remaining = text.replace(stateName, '').trim();
        if (remaining) {
          city = CITY_NAMES[remaining] || capitalize(remaining);
        }
        break;
      }
    }
  }

  return { city, state };
}

function parseBudget(text) {
  let min = null;
  let max = null;

  // "no limit", "any", "flexible"
  if (/no limit|any|flexible|doesn't matter|dont care/i.test(text)) {
    return { min: null, max: null };
  }

  // Extract numbers (handle k = 1000, m = 1000000)
  const numbers = [];
  const numPattern = /\$?([\d,]+\.?\d*)\s*(k|m|thousand|million)?/gi;
  let match;
  while ((match = numPattern.exec(text)) !== null) {
    let val = parseFloat(match[1].replace(/,/g, ''));
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k' || suffix === 'thousand') val *= 1000;
    if (suffix === 'm' || suffix === 'million') val *= 1000000;
    numbers.push(val);
  }

  if (numbers.length >= 2) {
    min = Math.min(...numbers);
    max = Math.max(...numbers);
  } else if (numbers.length === 1) {
    const val = numbers[0];
    if (/under|below|less|max|up to|at most/i.test(text)) {
      max = val;
    } else if (/over|above|more|min|at least/i.test(text)) {
      min = val;
    } else if (/around|about|approximately|roughly/i.test(text)) {
      min = Math.round(val * 0.8);
      max = Math.round(val * 1.2);
    } else {
      // Default: treat single number as max
      max = val;
    }
  }

  return { min, max };
}

function parseRooms(text) {
  let beds = null;
  let baths = null;

  // "3 bed" "4 bedroom" "3 br"
  const bedMatch = text.match(/(\d+)\s*(?:bed|bedroom|br|bd)/i);
  if (bedMatch) beds = parseInt(bedMatch[1]);

  // "2 bath" "2.5 bathroom" "2 ba"
  const bathMatch = text.match(/([\d.]+)\s*(?:bath|bathroom|ba)/i);
  if (bathMatch) baths = parseFloat(bathMatch[1]);

  // "at least 3 beds" - only match if qualifier word is nearby
  if (!beds && !baths) {
    const atLeastMatch = text.match(/(?:at least|minimum|min)\s+(\d+)\s*(?:bed|room|br)?/i);
    if (atLeastMatch) beds = parseInt(atLeastMatch[1]);
  }

  return { beds, baths };
}

function parsePropertyType(text) {
  // Check townhome/townhouse BEFORE house/home to avoid false match
  if (/townhome|townhouse|town home|town house|rowhouse/i.test(text)) return 'townhome';
  if (/condo|condominium|apt\b|apartment/i.test(text)) return 'condo';
  if (/\bfarm\b|farmhouse|farm house|ranch\b|homestead/i.test(text)) return 'house';
  if (/\bhouse\b|single family|\bhome\b|sfh/i.test(text)) return 'house';
  if (/\bland\b|\blot\b|acreage/i.test(text)) return 'land';
  if (/any|all|open|don't care|doesn't matter|no preference/i.test(text)) return '';
  return '';
}

/**
 * Parse acreage / lot size from text.
 * Handles: "5 acre", "5acre", "10 acres", "2.5 acres", "half acre"
 * Returns the number of acres (float) or null.
 */
function parseAcreage(text) {
  // "half acre"
  if (/half\s*acre/i.test(text)) return 0.5;
  // "quarter acre"
  if (/quarter\s*acre/i.test(text)) return 0.25;

  // "5acre", "5 acre", "10 acres", "2.5 acres"
  const acreMatch = text.match(/([\d,.]+)\s*(?:acre|acres)\b/i);
  if (acreMatch) {
    const val = parseFloat(acreMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

function detectFeatures(text) {
  const found = [];
  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        found.push(feature);
        break;
      }
    }
  }
  return found;
}

function parseLifestyle(text) {
  if (/family|kid|children|school|safe/i.test(text)) return 'family';
  if (/professional|work|career|downtown|commut/i.test(text)) return 'professional';
  if (/active|sport|fitness|trail|park|hik/i.test(text)) return 'active';
  if (/entertain|host|party|cook|chef/i.test(text)) return 'entertaining';
  if (/low maintenance|easy|minimal|small|condo life/i.test(text)) return 'low maintenance';
  return null;
}

function capitalize(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = router;
