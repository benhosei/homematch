const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function formatCurrency(n) {
  return '$' + n.toLocaleString('en-US');
}

function scaleFactor(price) {
  // Higher-priced homes have proportionally higher reno costs
  if (price >= 800000) return 1.6;
  if (price >= 600000) return 1.35;
  if (price >= 400000) return 1.1;
  if (price >= 250000) return 0.95;
  return 0.8;
}

// ---------------------------------------------------------------------------
// 1. POST /analyze-lifestyle  -  Life-Stage AI Engine
// ---------------------------------------------------------------------------

const LIFESTYLE_KEYWORDS = {
  fitness: [
    'gym', 'lift', 'workout', 'fitness', 'exercise', 'crossfit', 'peloton',
    'yoga', 'garage gym', 'home gym', 'squat', 'rack', 'weights', 'run',
    'marathon',
  ],
  family: [
    'kids', 'children', 'school', 'family', 'baby', 'nursery', 'daycare',
    'playground', 'backyard', 'safe neighborhood', 'cul-de-sac', 'school district',
  ],
  outdoors: [
    'trail', 'hike', 'hiking', 'bike', 'biking', 'nature', 'park',
    'mountain', 'lake', 'outdoor', 'camping', 'kayak', 'fishing', 'garden',
  ],
  career: [
    'commute', 'office', 'remote work', 'home office', 'work from home',
    'downtown', 'tech hub', 'business', 'cowork',
  ],
  investment: [
    'invest', 'rental', 'appreciation', 'equity', 'flip', 'passive income',
    'cash flow', 'roi', 'airbnb', 'duplex', 'multi-family', 'resale',
  ],
  creative: [
    'studio', 'art', 'music', 'workshop', 'craft', 'photography',
    'recording', 'creative space', 'maker',
  ],
  entertainment: [
    'entertain', 'hosting', 'party', 'pool', 'hot tub', 'outdoor kitchen',
    'bar', 'theater', 'media room', 'game room',
  ],
  pets: [
    'dog', 'dogs', 'cat', 'cats', 'pet', 'pets', 'fenced yard',
    'dog park', 'horse', 'barn', 'acreage',
  ],
  sustainability: [
    'solar', 'green', 'sustainable', 'energy efficient', 'ev charger',
    'electric vehicle', 'eco', 'net zero',
  ],
};

function parseLifestyleSignals(prompt) {
  const lower = prompt.toLowerCase();
  const scores = {};

  for (const [category, keywords] of Object.entries(LIFESTYLE_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    // Scale: each hit is worth ~30 points, cap at 100
    scores[category] = clamp(hits * 30, 0, 100);
  }

  return scores;
}

function detectLifeStage(prompt, age, income, goals) {
  const lower = prompt.toLowerCase();
  const parsedAge = age ? Number(age) : null;

  const stageScores = {
    young_professional: 0,
    growing_family: 0,
    established: 0,
    downsizer: 0,
    investor: 0,
    entrepreneur: 0,
  };

  // Age signals
  if (parsedAge) {
    if (parsedAge < 30) stageScores.young_professional += 3;
    if (parsedAge >= 28 && parsedAge <= 42) stageScores.growing_family += 2;
    if (parsedAge >= 40 && parsedAge <= 60) stageScores.established += 2;
    if (parsedAge >= 55) stageScores.downsizer += 3;
  }

  // Income signals
  const parsedIncome = income ? Number(income) : null;
  if (parsedIncome) {
    if (parsedIncome >= 200000) stageScores.investor += 2;
    if (parsedIncome >= 150000) stageScores.established += 1;
    if (parsedIncome >= 100000) stageScores.entrepreneur += 1;
  }

  // Keyword signals
  const keywords = {
    young_professional: [
      'first home', 'starter', 'single', 'young', 'apartment', 'condo',
      'nightlife', 'downtown',
    ],
    growing_family: [
      'kids', 'children', 'school', 'baby', 'family', 'backyard', 'safe',
      'nursery', 'playground', 'good schools', 'school district',
    ],
    established: [
      'upgrade', 'luxury', 'executive', 'premium', 'upscale', 'custom',
      'estate', 'established',
    ],
    downsizer: [
      'downsize', 'retire', 'retirement', 'senior', 'smaller',
      'single story', 'low maintenance', 'one level', '55+',
    ],
    investor: [
      'invest', 'rental', 'flip', 'cash flow', 'passive', 'roi', 'airbnb',
      'duplex', 'multi-family', 'portfolio',
    ],
    entrepreneur: [
      'business', 'home office', 'startup', 'zoning', 'commercial',
      'mixed use', 'workshop',
    ],
  };

  for (const [stage, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      if (lower.includes(kw)) stageScores[stage] += 2;
    }
  }

  // Goals
  if (goals) {
    const goalLower = (Array.isArray(goals) ? goals.join(' ') : String(goals)).toLowerCase();
    for (const [stage, kws] of Object.entries(keywords)) {
      for (const kw of kws) {
        if (goalLower.includes(kw)) stageScores[stage] += 1;
      }
    }
  }

  // Find winner
  let best = 'young_professional';
  let bestScore = -1;
  for (const [stage, score] of Object.entries(stageScores)) {
    if (score > bestScore) {
      bestScore = score;
      best = stage;
    }
  }

  return best;
}

function predictFutureNeeds(lifeStage, lifestyleProfile) {
  const needs = {
    young_professional: [
      'Will likely need extra bedrooms for a partner or family in 3-5 years',
      'Property should have strong resale value for eventual upgrade',
      'Proximity to career centers will remain important',
      'Consider neighborhoods trending upward for equity growth',
    ],
    growing_family: [
      'School quality will become the dominant factor within 2-3 years',
      'Will need dedicated play areas and a fenced yard',
      'Storage needs will increase significantly - look for attic/basement potential',
      'A minivan-friendly driveway and garage matter more than you think',
    ],
    established: [
      'May want a home office or multi-function flex room',
      'Aging-in-place features (main floor bedroom, wide doorways) add long-term value',
      'Entertaining spaces become more important at this stage',
      'Consider properties that can support aging parents or boomerang kids',
    ],
    downsizer: [
      'Single-level living will be essential within 5 years',
      'Low-maintenance exteriors save money and hassle',
      'Proximity to healthcare facilities becomes a priority',
      'Guest bedroom for family visits is still important',
    ],
    investor: [
      'Local rental regulations may tighten - verify short-term rental laws',
      'Properties near universities or hospitals have steady tenant demand',
      'Multi-unit potential (ADU, duplex conversion) maximizes cash flow',
      'Cap rates in this area may compress as prices rise',
    ],
    entrepreneur: [
      'Zoning flexibility allows for home-based business growth',
      'Dedicated workspace with separate entrance adds functionality',
      'Fast internet infrastructure is non-negotiable',
      'Consider properties with space for future team expansion',
    ],
  };

  const base = needs[lifeStage] || needs.young_professional;

  // Add lifestyle-specific predictions
  const extras = [];
  if (lifestyleProfile.fitness >= 60) {
    extras.push('Will need dedicated fitness space - garage gym or basement conversion');
  }
  if (lifestyleProfile.pets >= 60) {
    extras.push('Fenced yard and pet-friendly flooring will be essential');
  }
  if (lifestyleProfile.sustainability >= 50) {
    extras.push('Solar panel readiness and EV charging will increase in value');
  }

  return [...base.slice(0, 2), ...extras].slice(0, 4);
}

function generateSearchBoosts(lifeStage, lifestyleProfile) {
  const boosts = {};

  const stageBoosts = {
    young_professional: { beds_min: 2, garage: false, yard: false },
    growing_family: { beds_min: 3, garage: true, yard: true, pool: false },
    established: { beds_min: 4, garage: true, yard: true },
    downsizer: { beds_min: 2, single_story: true, garage: true },
    investor: { beds_min: 2, multi_unit: true },
    entrepreneur: { beds_min: 3, home_office: true, garage: true },
  };

  Object.assign(boosts, stageBoosts[lifeStage] || stageBoosts.young_professional);

  // Lifestyle overrides
  if (lifestyleProfile.fitness >= 60) {
    boosts.garage = true;
    boosts.beds_min = Math.max(boosts.beds_min || 0, 3);
  }
  if (lifestyleProfile.family >= 50) {
    boosts.beds_min = Math.max(boosts.beds_min || 0, 3);
    boosts.yard = true;
    boosts.good_schools = true;
  }
  if (lifestyleProfile.outdoors >= 50) {
    boosts.near_trails = true;
    boosts.yard = true;
  }
  if (lifestyleProfile.entertainment >= 50) {
    boosts.pool = true;
    boosts.sqft_min = 2000;
  }
  if (lifestyleProfile.pets >= 50) {
    boosts.yard = true;
    boosts.fenced = true;
  }
  if (lifestyleProfile.investment >= 50) {
    boosts.multi_unit = true;
    boosts.adu_potential = true;
  }

  return boosts;
}

function generateNicheTips(lifestyleProfile, lifeStage) {
  const tips = [];

  if (lifestyleProfile.fitness >= 60) {
    tips.push({
      icon: '\uD83D\uDCAA',
      title: 'Garage Gym Check',
      detail: 'Look for 2+ car garage with 9-10ft ceilings. Min 20x20ft for a full rack setup. Rubber mats + stall mat flooring runs ~$300.',
    });
  }

  if (lifestyleProfile.family >= 50) {
    tips.push({
      icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67',
      title: 'Family-Ready Layout',
      detail: 'Open floor plan lets you watch kids from the kitchen. Main-floor bedroom is a bonus for a nursery or guest room.',
    });
  }

  if (lifestyleProfile.outdoors >= 50) {
    tips.push({
      icon: '\uD83C\uDFDE\uFE0F',
      title: 'Trail Access Premium',
      detail: 'Homes within 0.5 miles of trails sell for 5-10% more. Check AllTrails for proximity before touring.',
    });
  }

  if (lifestyleProfile.investment >= 40) {
    tips.push({
      icon: '\uD83D\uDCC8',
      title: 'Growth Play',
      detail: '3+ bed gives you room for a family down the road without moving, and better resale value.',
    });
  }

  if (lifestyleProfile.career >= 50) {
    tips.push({
      icon: '\uD83D\uDCBB',
      title: 'Remote Work Setup',
      detail: 'Dedicated home office with a door adds $10-20K in perceived value. Check for fiber internet availability.',
    });
  }

  if (lifestyleProfile.entertainment >= 50) {
    tips.push({
      icon: '\uD83C\uDF89',
      title: 'Entertainment Ready',
      detail: 'Look for open-concept main floor, outdoor patio, and at least 2 full baths for hosting.',
    });
  }

  if (lifestyleProfile.pets >= 50) {
    tips.push({
      icon: '\uD83D\uDC36',
      title: 'Pet-Friendly Must-Haves',
      detail: 'Fully fenced yard (6ft for large breeds), no busy roads nearby, and check HOA pet restrictions.',
    });
  }

  if (lifestyleProfile.sustainability >= 50) {
    tips.push({
      icon: '\u2600\uFE0F',
      title: 'Green Home Bonus',
      detail: 'South-facing roof = best solar potential. EV charger adds ~$1,500 but $5K+ in perceived value.',
    });
  }

  if (lifestyleProfile.creative >= 50) {
    tips.push({
      icon: '\uD83C\uDFA8',
      title: 'Creative Space',
      detail: 'Bonus room, finished basement, or detached garage can be converted to a studio. Check noise ordinances.',
    });
  }

  // If we have few tips, add a universal one based on life stage
  if (tips.length < 2) {
    const universalTips = {
      young_professional: {
        icon: '\uD83D\uDE80',
        title: 'First Home Strategy',
        detail: 'Buy slightly under budget. The leftover funds for improvements will increase value faster than a pricier home.',
      },
      growing_family: {
        icon: '\uD83C\uDFE0',
        title: 'Neighborhood Over House',
        detail: 'A smaller home in a great school district beats a bigger home in an average one. Kids make friends, you build community.',
      },
      established: {
        icon: '\uD83D\uDC8E',
        title: 'Quality Over Quantity',
        detail: 'At this stage, focus on finishes and layout over raw square footage. A well-designed 2,500 sqft beats a sloppy 3,500.',
      },
      downsizer: {
        icon: '\uD83C\uDF3F',
        title: 'Less Is More',
        detail: 'Smaller footprint = lower taxes, insurance, and maintenance. Redirect savings into travel or investments.',
      },
      investor: {
        icon: '\uD83D\uDCB0',
        title: 'Cash Flow First',
        detail: 'Appreciation is a bonus. Run the numbers on rental income vs. mortgage + expenses before falling in love.',
      },
      entrepreneur: {
        icon: '\uD83D\uDCA1',
        title: 'Zoning Matters',
        detail: 'Verify home business is allowed. Some HOAs and municipalities restrict signage, client visits, or commercial activity.',
      },
    };
    const tip = universalTips[lifeStage] || universalTips.young_professional;
    tips.push(tip);
  }

  return tips.slice(0, 5);
}

function generatePersonalInsight(lifeStage, lifestyleProfile) {
  const parts = [];

  const stageIntro = {
    young_professional: "You're building a foundation.",
    growing_family: "You're nesting - and that's smart.",
    established: 'You know what you want.',
    downsizer: 'Simplifying is a power move.',
    investor: "You're thinking like a portfolio manager.",
    entrepreneur: 'Your home is also your HQ.',
  };

  parts.push(stageIntro[lifeStage] || stageIntro.young_professional);

  if (lifestyleProfile.fitness >= 60) {
    parts.push("Look for homes with garage gym potential (10'+ ceilings, 2+ car) and room to grow.");
  }
  if (lifestyleProfile.outdoors >= 50) {
    parts.push('Properties near trails hold value and match your active lifestyle.');
  }
  if (lifestyleProfile.family >= 50) {
    parts.push('Prioritize school districts and safe streets - these are the hardest things to change later.');
  }
  if (lifestyleProfile.investment >= 40) {
    parts.push('Look for below-market price/sqft in up-and-coming areas for the best equity play.');
  }
  if (lifestyleProfile.career >= 50) {
    parts.push('A dedicated home office with solid internet will pay for itself in productivity.');
  }

  if (parts.length === 1) {
    parts.push('Focus on location and layout - those are the two things you can never renovate.');
  }

  return parts.join(' ');
}

router.post('/analyze-lifestyle', async (req, res) => {
  try {
    const { prompt, age, income, goals } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const lifestyleProfile = parseLifestyleSignals(prompt);
    const lifeStage = detectLifeStage(prompt, age, income, goals);
    const futureNeeds = predictFutureNeeds(lifeStage, lifestyleProfile);
    const searchBoosts = generateSearchBoosts(lifeStage, lifestyleProfile);
    const nicheTips = generateNicheTips(lifestyleProfile, lifeStage);
    const personalInsight = generatePersonalInsight(lifeStage, lifestyleProfile);

    res.json({
      lifeStage,
      lifestyleProfile,
      futureNeeds,
      searchBoosts,
      personalInsight,
      nicheTips,
    });
  } catch (err) {
    console.error('analyze-lifestyle error:', err);
    res.status(500).json({ error: 'Failed to analyze lifestyle' });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /property-intelligence  -  Future Value & Investment Intelligence
// ---------------------------------------------------------------------------

function calcAppreciation(listing) {
  const price = Number(listing.price) || 0;
  const sqft = Number(listing.sqft) || 1;
  const lotSqft = Number(listing.lot_sqft) || 0;
  const yearBuilt = Number(listing.year_built) || 2000;
  const beds = Number(listing.beds) || 2;
  const pricePerSqft = price / sqft;
  const currentYear = new Date().getFullYear();
  const age = currentYear - yearBuilt;

  let score = 50; // baseline

  // Price/sqft below 200 is generally a good sign in most markets
  if (pricePerSqft < 150) score += 15;
  else if (pricePerSqft < 200) score += 10;
  else if (pricePerSqft < 250) score += 5;
  else if (pricePerSqft > 350) score -= 10;

  // Newer homes tend to appreciate differently
  if (age < 5) score += 8;
  else if (age < 15) score += 5;
  else if (age > 50) score -= 5;

  // Larger lots appreciate better in most markets
  if (lotSqft > 20000) score += 10;
  else if (lotSqft > 10000) score += 6;
  else if (lotSqft > 5000) score += 3;

  // More bedrooms = broader buyer pool
  if (beds >= 4) score += 5;
  else if (beds >= 3) score += 3;
  else if (beds <= 1) score -= 5;

  // Property type
  const propType = (listing.prop_type || '').toLowerCase();
  if (propType.includes('single_family') || propType.includes('house')) score += 5;
  else if (propType.includes('condo')) score -= 3;
  else if (propType.includes('multi')) score += 3;

  score = clamp(score, 20, 98);

  // Five-year estimate: 3-6% annual appreciation depending on score
  const annualRate = 0.02 + (score / 100) * 0.05;
  const fiveYearLow = Math.round(price * Math.pow(1 + annualRate * 0.7, 5));
  const fiveYearHigh = Math.round(price * Math.pow(1 + annualRate * 1.1, 5));

  let label;
  if (score >= 80) label = 'Strong';
  else if (score >= 65) label = 'Above Average';
  else if (score >= 45) label = 'Average';
  else label = 'Below Average';

  const reasons = [];
  if (pricePerSqft < 200) reasons.push('Below median price/sqft for most markets suggests room for growth');
  if (lotSqft > 10000) reasons.push('Larger lot size provides development flexibility and scarcity value');
  if (age < 10) reasons.push('Newer construction requires less deferred maintenance');
  if (age > 40) reasons.push('Older home in established neighborhood with mature trees and character');
  if (beds >= 4) reasons.push('4+ bedrooms appeal to the largest buyer demographic');
  if (reasons.length === 0) reasons.push('Solid fundamentals for steady appreciation');

  return {
    score,
    label,
    fiveYearEstimate: formatCurrency(fiveYearLow) + ' - ' + formatCurrency(fiveYearHigh),
    reasoning: reasons[0],
  };
}

function calcInvestmentMetrics(listing) {
  const price = Number(listing.price) || 0;
  const sqft = Number(listing.sqft) || 1;
  const pricePerSqft = Math.round(price / sqft);

  // Rental estimate: 0.5-0.8% of price/month, inversely scaled with price
  let rentalPct;
  if (price < 200000) rentalPct = 0.008;
  else if (price < 350000) rentalPct = 0.007;
  else if (price < 500000) rentalPct = 0.006;
  else if (price < 750000) rentalPct = 0.0055;
  else rentalPct = 0.005;

  const estMonthlyRent = Math.round(price * rentalPct);
  const annualRent = estMonthlyRent * 12;
  const grossYield = Number(((annualRent / price) * 100).toFixed(1));

  // Cap rate: gross yield minus ~1-1.5% for expenses
  const expenseRatio = price > 500000 ? 1.2 : 1.0;
  const capRateEstimate = Number((grossYield - expenseRatio).toFixed(1));

  return {
    pricePerSqft,
    estMonthlyRent,
    grossYield,
    capRateEstimate: Math.max(capRateEstimate, 1.5),
  };
}

function calcRenovationPotential(listing) {
  const price = Number(listing.price) || 0;
  const yearBuilt = Number(listing.year_built) || 2000;
  const sqft = Number(listing.sqft) || 1500;
  const propType = (listing.prop_type || '').toLowerCase();
  const currentYear = new Date().getFullYear();
  const age = currentYear - yearBuilt;
  const sf = scaleFactor(price);

  let score = 50;

  // Older homes have more renovation potential
  if (age > 30) score += 20;
  else if (age > 20) score += 15;
  else if (age > 10) score += 8;
  else score -= 5;

  // Single family homes have the most potential
  if (propType.includes('single_family') || propType.includes('house')) score += 10;
  else if (propType.includes('condo')) score -= 15;

  // Larger homes have more room for remodeling
  if (sqft > 2500) score += 5;
  else if (sqft < 1200) score -= 5;

  score = clamp(score, 15, 95);

  const suggestions = [];

  if (age > 10) {
    suggestions.push({
      project: 'Kitchen Remodel',
      cost: formatCurrency(Math.round(25000 * sf)) + ' - ' + formatCurrency(Math.round(40000 * sf)),
      valueAdd: formatCurrency(Math.round(35000 * sf)) + ' - ' + formatCurrency(Math.round(55000 * sf)),
      roi: Math.round((45000 * sf) / (32500 * sf) * 100) + '%',
    });
  }

  if (age > 15 && sqft > 1400) {
    suggestions.push({
      project: 'Bathroom Remodel',
      cost: formatCurrency(Math.round(15000 * sf)) + ' - ' + formatCurrency(Math.round(28000 * sf)),
      valueAdd: formatCurrency(Math.round(18000 * sf)) + ' - ' + formatCurrency(Math.round(35000 * sf)),
      roi: Math.round((26500 * sf) / (21500 * sf) * 100) + '%',
    });
  }

  if (!propType.includes('condo') && sqft > 1500) {
    suggestions.push({
      project: 'Finish Basement',
      cost: formatCurrency(Math.round(20000 * sf)) + ' - ' + formatCurrency(Math.round(35000 * sf)),
      valueAdd: formatCurrency(Math.round(30000 * sf)) + ' - ' + formatCurrency(Math.round(50000 * sf)),
      roi: Math.round((40000 * sf) / (27500 * sf) * 100) + '%',
    });
  }

  if (!propType.includes('condo')) {
    suggestions.push({
      project: 'Deck / Patio Addition',
      cost: formatCurrency(Math.round(8000 * sf)) + ' - ' + formatCurrency(Math.round(18000 * sf)),
      valueAdd: formatCurrency(Math.round(10000 * sf)) + ' - ' + formatCurrency(Math.round(22000 * sf)),
      roi: Math.round((16000 * sf) / (13000 * sf) * 100) + '%',
    });
  }

  if (!propType.includes('condo') && price > 300000) {
    suggestions.push({
      project: 'Add Pool',
      cost: formatCurrency(Math.round(35000 * sf)) + ' - ' + formatCurrency(Math.round(65000 * sf)),
      valueAdd: formatCurrency(Math.round(20000 * sf)) + ' - ' + formatCurrency(Math.round(40000 * sf)),
      roi: Math.round((30000 * sf) / (50000 * sf) * 100) + '%',
    });
  }

  return {
    score,
    suggestions: suggestions.slice(0, 4),
  };
}

function generateAreaInsights(listing, city, stateCode) {
  const beds = Number(listing.beds) || 2;
  const yearBuilt = Number(listing.year_built) || 2000;
  const price = Number(listing.price) || 0;
  const lotSqft = Number(listing.lot_sqft) || 0;
  const insights = [];

  if (beds >= 3) {
    insights.push('Family-sized homes in this range attract strong buyer competition');
  }
  if (yearBuilt > 2015) {
    insights.push('Newer construction in the area signals active development and growth');
  } else if (yearBuilt < 1980) {
    insights.push('Established neighborhood with mature landscaping and character homes');
  }
  if (price < 350000) {
    insights.push('Price point attracts first-time buyers - strong demand segment');
  } else if (price > 700000) {
    insights.push('Luxury segment tends to have longer days on market but stronger appreciation');
  }
  if (lotSqft > 15000) {
    insights.push('Larger lots are becoming scarce - this adds long-term scarcity value');
  }
  if (city) {
    insights.push(city + ', ' + (stateCode || '') + ' market fundamentals remain solid for residential real estate');
  }

  return insights.slice(0, 4);
}

function calcSmartScore(appreciation, investment, renovationPotential) {
  // Weighted blend: 40% appreciation, 35% investment yield, 25% renovation upside
  const investScore = clamp(investment.grossYield * 12, 20, 100);
  const smartScore = Math.round(
    appreciation.score * 0.4 +
    investScore * 0.35 +
    renovationPotential.score * 0.25
  );
  return clamp(smartScore, 15, 98);
}

router.post('/property-intelligence', async (req, res) => {
  try {
    const { listing, city, stateCode } = req.body;

    if (!listing) {
      return res.status(400).json({ error: 'listing object is required' });
    }

    const appreciation = calcAppreciation(listing);
    const investment = calcInvestmentMetrics(listing);
    const renovationPotential = calcRenovationPotential(listing);
    const areaInsights = generateAreaInsights(listing, city, stateCode);
    const smartScore = calcSmartScore(appreciation, investment, renovationPotential);

    res.json({
      appreciation,
      investment,
      renovationPotential,
      areaInsights,
      smartScore,
    });
  } catch (err) {
    console.error('property-intelligence error:', err);
    res.status(500).json({ error: 'Failed to generate property intelligence' });
  }
});

// ---------------------------------------------------------------------------
// 3. POST /offer-strategy  -  AI Negotiation Assistant
// ---------------------------------------------------------------------------

router.post('/offer-strategy', async (req, res) => {
  try {
    const { listing, daysOnMarket } = req.body;

    if (!listing) {
      return res.status(400).json({ error: 'listing object is required' });
    }

    const price = Number(listing.price) || 0;
    const dom = Number(daysOnMarket) || 0;
    const sqft = Number(listing.sqft) || 1;
    const beds = Number(listing.beds) || 2;
    const propType = (listing.prop_type || '').toLowerCase();
    const pricePerSqft = price / sqft;

    // Determine market position
    let marketPosition = 'fairly_priced';

    // Heuristic: beds-based expected price/sqft for a generic property
    const expectedPerSqft = beds >= 4 ? 210 : beds >= 3 ? 190 : 170;
    if (pricePerSqft > expectedPerSqft * 1.15) {
      marketPosition = 'overpriced';
    } else if (pricePerSqft > expectedPerSqft * 1.05) {
      marketPosition = 'slightly_overpriced';
    } else if (pricePerSqft < expectedPerSqft * 0.9) {
      marketPosition = 'underpriced';
    } else if (pricePerSqft < expectedPerSqft * 0.95) {
      marketPosition = 'slightly_underpriced';
    }

    // Seller motivation
    let motivationLevel = 'low';
    const motivationSignals = [];

    if (dom > 90) {
      motivationLevel = 'high';
      motivationSignals.push('Listed ' + dom + ' days ago - well above market average');
      motivationSignals.push('Extended time on market suggests willingness to negotiate');
    } else if (dom > 45) {
      motivationLevel = 'moderate';
      motivationSignals.push('Listed ' + dom + ' days ago');
      motivationSignals.push('Approaching the point where sellers reconsider pricing');
    } else if (dom > 14) {
      motivationLevel = 'low';
      motivationSignals.push('Listed ' + dom + ' days ago - still relatively fresh');
    } else {
      motivationLevel = 'low';
      motivationSignals.push('Fresh listing at ' + dom + ' days - seller has leverage');
      motivationSignals.push('Expect competing offers in a normal market');
    }

    if (marketPosition === 'overpriced' || marketPosition === 'slightly_overpriced') {
      motivationSignals.push('Price slightly above market average for comparable properties');
    }

    // Calculate offer price
    let offerPct;
    if (dom <= 7) offerPct = 0.99;
    else if (dom <= 14) offerPct = 0.98;
    else if (dom <= 30) offerPct = 0.97;
    else if (dom <= 60) offerPct = 0.955;
    else if (dom <= 90) offerPct = 0.94;
    else offerPct = 0.92;

    // Adjust for market position
    if (marketPosition === 'overpriced') offerPct -= 0.02;
    else if (marketPosition === 'slightly_overpriced') offerPct -= 0.01;
    else if (marketPosition === 'underpriced') offerPct += 0.015;

    offerPct = clamp(offerPct, 0.88, 1.0);

    const suggestedOffer = Math.round(price * offerPct / 500) * 500;
    const lowOffer = Math.round(price * (offerPct - 0.02) / 500) * 500;
    const fairOffer = Math.round(price * (offerPct + 0.01) / 500) * 500;
    const aggressiveOffer = Math.round(price * clamp(offerPct + 0.025, 0.95, 1.02) / 500) * 500;

    // Escalation clause
    const useEscalation = dom < 30 && marketPosition !== 'overpriced';
    const escalationCap = Math.round(price * clamp(offerPct + 0.03, 0.96, 1.03) / 500) * 500;
    const escalationIncrement = price >= 500000 ? 5000 : price >= 300000 ? 2500 : 1000;

    // Tips
    const tips = [];

    if (offerPct < 0.97) {
      tips.push('Start at ' + Math.round(offerPct * 100) + '% of asking - there\'s room to negotiate');
    } else {
      tips.push('Market is competitive at this price point - avoid lowballing');
    }

    if (dom > 30) {
      tips.push('Request seller cover closing costs instead of lowering price - easier for them to accept');
    }

    if (dom > 60) {
      tips.push('Ask for a home warranty to be included - sellers are more flexible at this stage');
    }

    if (propType.includes('condo')) {
      tips.push('Request HOA financials and meeting minutes - leverage any issues in negotiation');
    } else {
      tips.push('Get a pre-inspection before offering - knowledge is leverage');
    }

    if (marketPosition === 'underpriced') {
      tips.push('This property may be priced to attract multiple offers - be prepared to compete');
    }

    if (beds >= 4 && price < 400000) {
      tips.push('Larger homes at this price are rare - seller knows demand is strong');
    }

    tips.push('Include a personal letter to the seller - it still works, especially in competitive situations');

    res.json({
      suggestedOffer,
      offerRange: {
        low: lowOffer,
        fair: fairOffer,
        aggressive: aggressiveOffer,
      },
      escalationClause: {
        suggested: useEscalation,
        cap: escalationCap,
        increment: escalationIncrement,
      },
      sellerMotivation: {
        level: motivationLevel,
        signals: motivationSignals.slice(0, 3),
      },
      tips: tips.slice(0, 4),
      marketPosition,
    });
  } catch (err) {
    console.error('offer-strategy error:', err);
    res.status(500).json({ error: 'Failed to generate offer strategy' });
  }
});

// ---------------------------------------------------------------------------
// 4. POST /what-if  -  Renovation "What If" Simulator
// ---------------------------------------------------------------------------

const RENOVATION_CATALOG = {
  pool: {
    label: 'Add Pool',
    icon: '\uD83C\uDFCA',
    baseCostLow: 35000,
    baseCostHigh: 65000,
    baseValueLow: 20000,
    baseValueHigh: 40000,
    timeWeeks: '8-12',
  },
  kitchen: {
    label: 'Kitchen Remodel',
    icon: '\uD83C\uDF73',
    baseCostLow: 25000,
    baseCostHigh: 45000,
    baseValueLow: 35000,
    baseValueHigh: 60000,
    timeWeeks: '4-8',
  },
  basement: {
    label: 'Finish Basement',
    icon: '\uD83C\uDFD7\uFE0F',
    baseCostLow: 20000,
    baseCostHigh: 35000,
    baseValueLow: 30000,
    baseValueHigh: 50000,
    timeWeeks: '6-10',
  },
  bathroom: {
    label: 'Bathroom Remodel',
    icon: '\uD83D\uDEC1',
    baseCostLow: 12000,
    baseCostHigh: 25000,
    baseValueLow: 15000,
    baseValueHigh: 32000,
    timeWeeks: '3-6',
  },
  master_suite: {
    label: 'Master Suite Addition',
    icon: '\uD83D\uDECF\uFE0F',
    baseCostLow: 45000,
    baseCostHigh: 80000,
    baseValueLow: 50000,
    baseValueHigh: 90000,
    timeWeeks: '8-14',
  },
  garage_gym: {
    label: 'Garage Gym Conversion',
    icon: '\uD83C\uDFCB\uFE0F',
    baseCostLow: 5000,
    baseCostHigh: 15000,
    baseValueLow: 3000,
    baseValueHigh: 10000,
    timeWeeks: '1-3',
  },
  solar: {
    label: 'Solar Panel Installation',
    icon: '\u2600\uFE0F',
    baseCostLow: 15000,
    baseCostHigh: 30000,
    baseValueLow: 12000,
    baseValueHigh: 25000,
    timeWeeks: '2-4',
  },
  deck_patio: {
    label: 'Deck / Patio',
    icon: '\uD83C\uDF3F',
    baseCostLow: 8000,
    baseCostHigh: 20000,
    baseValueLow: 10000,
    baseValueHigh: 24000,
    timeWeeks: '2-5',
  },
  landscaping: {
    label: 'Professional Landscaping',
    icon: '\uD83C\uDF33',
    baseCostLow: 5000,
    baseCostHigh: 15000,
    baseValueLow: 8000,
    baseValueHigh: 20000,
    timeWeeks: '2-4',
  },
  smart_home: {
    label: 'Smart Home Package',
    icon: '\uD83E\uDD16',
    baseCostLow: 3000,
    baseCostHigh: 10000,
    baseValueLow: 4000,
    baseValueHigh: 12000,
    timeWeeks: '1-2',
  },
  new_roof: {
    label: 'New Roof',
    icon: '\uD83C\uDFE0',
    baseCostLow: 8000,
    baseCostHigh: 18000,
    baseValueLow: 10000,
    baseValueHigh: 20000,
    timeWeeks: '1-3',
  },
  flooring: {
    label: 'New Flooring Throughout',
    icon: '\uD83E\uDDF1',
    baseCostLow: 6000,
    baseCostHigh: 18000,
    baseValueLow: 8000,
    baseValueHigh: 22000,
    timeWeeks: '1-3',
  },
  paint_exterior: {
    label: 'Exterior Paint',
    icon: '\uD83C\uDFA8',
    baseCostLow: 3000,
    baseCostHigh: 8000,
    baseValueLow: 5000,
    baseValueHigh: 12000,
    timeWeeks: '1-2',
  },
  fence: {
    label: 'New Fence',
    icon: '\uD83E\uDDF1',
    baseCostLow: 3000,
    baseCostHigh: 10000,
    baseValueLow: 4000,
    baseValueHigh: 12000,
    timeWeeks: '1-2',
  },
  adu: {
    label: 'Accessory Dwelling Unit (ADU)',
    icon: '\uD83C\uDFE1',
    baseCostLow: 80000,
    baseCostHigh: 160000,
    baseValueLow: 100000,
    baseValueHigh: 200000,
    timeWeeks: '16-28',
  },
};

router.post('/what-if', async (req, res) => {
  try {
    const { listing, renovations } = req.body;

    if (!listing || !renovations || !Array.isArray(renovations)) {
      return res.status(400).json({ error: 'listing and renovations array are required' });
    }

    const price = Number(listing.price) || 0;
    const sf = scaleFactor(price);

    const results = [];
    let totalCostLow = 0;
    let totalCostHigh = 0;
    let totalValueLow = 0;
    let totalValueHigh = 0;

    for (const renoId of renovations) {
      const template = RENOVATION_CATALOG[renoId];
      if (!template) continue;

      const costLow = Math.round(template.baseCostLow * sf / 500) * 500;
      const costHigh = Math.round(template.baseCostHigh * sf / 500) * 500;
      const valueAddLow = Math.round(template.baseValueLow * sf / 500) * 500;
      const valueAddHigh = Math.round(template.baseValueHigh * sf / 500) * 500;

      totalCostLow += costLow;
      totalCostHigh += costHigh;
      totalValueLow += valueAddLow;
      totalValueHigh += valueAddHigh;

      results.push({
        id: renoId,
        label: template.label,
        icon: template.icon,
        costLow,
        costHigh,
        valueAddLow,
        valueAddHigh,
        timeWeeks: template.timeWeeks,
      });
    }

    const newValueLow = price + totalValueLow;
    const newValueHigh = price + totalValueHigh;

    // ROI = avg value added / avg cost
    const avgCost = (totalCostLow + totalCostHigh) / 2;
    const avgValue = (totalValueLow + totalValueHigh) / 2;
    const totalROI = avgCost > 0 ? Math.round((avgValue / avgCost) * 100) + '%' : 'N/A';

    // AI advice: rank renovations by ROI and give a recommendation
    const ranked = results
      .map(function (r) {
        return {
          id: r.id,
          label: r.label,
          avgROI: ((r.valueAddLow + r.valueAddHigh) / 2) / ((r.costLow + r.costHigh) / 2),
        };
      })
      .sort(function (a, b) { return b.avgROI - a.avgROI; });

    let aiAdvice = '';
    if (ranked.length >= 2) {
      const best = ranked[0];
      const second = ranked[1];
      aiAdvice = best.label + ' offers the best ROI at ~' + Math.round(best.avgROI * 100) + '%. ';
      if (best.avgROI > 1.2) {
        aiAdvice += 'Consider doing ' + best.label.toLowerCase() + ' first, then ' + second.label.toLowerCase() + ' after equity builds.';
      } else {
        aiAdvice += 'Pair it with ' + second.label.toLowerCase() + ' for maximum impact on home value.';
      }
    } else if (ranked.length === 1) {
      const best = ranked[0];
      aiAdvice = best.label + ' is a solid choice with an estimated ROI of ~' + Math.round(best.avgROI * 100) + '%. ';
      aiAdvice += 'Consider phasing the work to manage cash flow.';
    } else {
      aiAdvice = 'Select renovations to see projected ROI and value impact.';
    }

    // Add price-tier-specific advice
    if (price > 600000 && results.some(function (r) { return r.id === 'pool'; })) {
      aiAdvice += ' In this price range, a pool is expected by buyers - good investment.';
    } else if (price < 300000 && results.some(function (r) { return r.id === 'pool'; })) {
      aiAdvice += ' At this price point, a pool may over-improve the home for the neighborhood.';
    }

    if (results.some(function (r) { return r.id === 'adu'; })) {
      aiAdvice += ' ADU adds rental income potential - check local regulations for permitting requirements.';
    }

    res.json({
      currentValue: price,
      renovations: results,
      totalCostRange: {
        low: totalCostLow,
        high: totalCostHigh,
      },
      newValueEstimate: {
        low: newValueLow,
        high: newValueHigh,
      },
      totalROI,
      aiAdvice,
    });
  } catch (err) {
    console.error('what-if error:', err);
    res.status(500).json({ error: 'Failed to run renovation simulation' });
  }
});

module.exports = router;
