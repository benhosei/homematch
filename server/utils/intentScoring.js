/**
 * Intent Scoring Engine
 *
 * Scores a listing against a validated buyer intent object.
 * Returns a detailed breakdown with total, lifestyle, investment,
 * and risk scores plus human-readable reasons.
 */

// ---------------------------------------------------------------------------
// Configurable weights  (tune these to adjust scoring emphasis)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  // Hard-match categories
  mustHavePenalty: -15,         // per missing must-have
  bedsMatch: 20,               // max points for bed match
  bathsMatch: 10,              // max points for bath match
  budgetFit: 20,               // max points for budget fit
  propertyTypeMatch: 10,       // exact type match bonus
  sqftMatch: 10,               // max points for sqft match

  // Lifestyle tag bonuses
  lifestyle: {
    fitness_focused: {
      garage: 10,
      basementFinished: 8,
      ceilingHeight9Plus: 5,
      sqft2200Plus: 5,
    },
    family: {
      schoolRating7Plus: 10,
      beds3Plus: 5,
      yardFeature: 5,
    },
    remote_work: {
      officeFeature: 8,
      sqft1800Plus: 5,
    },
    investor: {
      lowPricePerSqft: 10,     // < $150/sqft
      highDaysOnMarket: 5,     // > 60 days
      highHoaPenalty: -5,      // hoa > 300
    },
    luxury: {
      poolFeature: 10,
      sqft3000Plus: 5,
      smartHomeFeature: 5,
    },
    starter_home: {
      priceSub300k: 10,
      beds2Plus: 5,
    },
  },

  // Investment score weights (internal)
  investment: {
    lowPricePerSqft: 25,       // < $150
    medPricePerSqft: 15,       // $150-$200
    highDaysOnMarket: 15,      // > 60
    medDaysOnMarket: 8,        // 30-60
    lowHoa: 10,                // hoa <= 100
    goodSchool: 10,            // schoolRating >= 7
    multiFamily: 15,           // multi_family prop type
  },

  // Risk score weights (higher = lower risk = better)
  risk: {
    newBuild: 15,              // yearBuilt >= 2010
    modernBuild: 10,           // yearBuilt 2000-2009
    midBuild: 5,               // yearBuilt 1980-1999
    oldBuild: -10,             // yearBuilt < 1960
    lowHoa: 10,                // hoa <= 100
    highHoa: -10,              // hoa > 400
    normalDom: 10,             // 10-60
    veryHighDom: -5,           // > 120
    veryLowDom: -3,            // < 5
    goodSchool: 10,            // >= 7
    poorSchool: -5,            // <= 3
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Check if a listing's features array contains a keyword (case-insensitive, partial match).
 */
function hasFeature(listing, keyword) {
  if (!listing.features || !Array.isArray(listing.features)) return false;
  var kw = keyword.toLowerCase();
  return listing.features.some(function (f) {
    return f.toLowerCase().includes(kw);
  });
}

/**
 * Check if a listing's features contain any of the given keywords.
 */
function hasAnyFeature(listing, keywords) {
  return keywords.some(function (kw) { return hasFeature(listing, kw); });
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score a single listing against a buyer intent.
 *
 * @param {object} intent - validated intent object (from validateIntent)
 * @param {object} listing - a listing object from MockListingsProvider
 * @returns {{
 *   totalScore: number,
 *   lifestyleScore: number,
 *   investmentScore: number,
 *   riskScore: number,
 *   reasons: string[],
 *   matched: { mustHave: string[], niceToHave: string[] },
 *   missing: { mustHave: string[] }
 * }}
 */
function scoreListing(intent, listing) {
  var points = 0;
  var maxPossible = 0;
  var reasons = [];

  // Track must-have / nice-to-have matches
  var matchedMustHave = [];
  var missingMustHave = [];
  var matchedNiceToHave = [];

  // -----------------------------------------------------------------------
  // 1. Must-haves
  // -----------------------------------------------------------------------
  if (intent.mustHave && intent.mustHave.length > 0) {
    intent.mustHave.forEach(function (item) {
      if (hasFeature(listing, item)) {
        matchedMustHave.push(item);
        reasons.push(capitalize(item) + ' is a must-have \u2713');
      } else {
        missingMustHave.push(item);
        points += WEIGHTS.mustHavePenalty;
        reasons.push('Missing: ' + item);
      }
    });
  }

  // -----------------------------------------------------------------------
  // 2. Beds match (up to 20 pts)
  // -----------------------------------------------------------------------
  maxPossible += WEIGHTS.bedsMatch;
  if (intent.bedrooms != null && listing.beds != null) {
    var bedDiff = Math.abs(listing.beds - intent.bedrooms);
    if (bedDiff === 0) {
      points += WEIGHTS.bedsMatch;
      reasons.push(listing.beds + ' bedrooms match your request');
    } else if (bedDiff === 1) {
      points += Math.round(WEIGHTS.bedsMatch * 0.6);
      reasons.push(listing.beds + ' bedrooms (you want ' + intent.bedrooms + ')');
    } else {
      points += Math.max(0, Math.round(WEIGHTS.bedsMatch * (1 - bedDiff * 0.3)));
    }
  } else {
    points += Math.round(WEIGHTS.bedsMatch * 0.5);
  }

  // -----------------------------------------------------------------------
  // 3. Baths match (up to 10 pts)
  // -----------------------------------------------------------------------
  maxPossible += WEIGHTS.bathsMatch;
  if (intent.bathrooms != null && listing.baths != null) {
    var bathDiff = Math.abs(listing.baths - intent.bathrooms);
    if (bathDiff <= 0.5) {
      points += WEIGHTS.bathsMatch;
    } else if (bathDiff <= 1) {
      points += Math.round(WEIGHTS.bathsMatch * 0.7);
    } else {
      points += Math.max(0, Math.round(WEIGHTS.bathsMatch * (1 - bathDiff * 0.25)));
    }
  } else {
    points += Math.round(WEIGHTS.bathsMatch * 0.5);
  }

  // -----------------------------------------------------------------------
  // 4. Budget fit (up to 20 pts)
  // -----------------------------------------------------------------------
  maxPossible += WEIGHTS.budgetFit;
  if (intent.budget && (intent.budget.min > 0 || intent.budget.max > 0)) {
    var bMin = intent.budget.min || 0;
    var bMax = intent.budget.max || Infinity;
    if (listing.price >= bMin && listing.price <= bMax) {
      // In range - full points, slight bonus for being in the middle
      points += WEIGHTS.budgetFit;
      reasons.push('Price $' + listing.price.toLocaleString() + ' is within your budget');
    } else if (listing.price < bMin) {
      // Below budget - partial credit
      var underPct = (bMin - listing.price) / (bMin || 1);
      points += Math.round(WEIGHTS.budgetFit * Math.max(0.3, 1 - underPct));
      reasons.push('Price $' + listing.price.toLocaleString() + ' is under your budget');
    } else {
      // Over budget
      var overPct = (listing.price - bMax) / (bMax || 1);
      var budgetPts = Math.round(WEIGHTS.budgetFit * Math.max(0, 1 - overPct * 2));
      points += budgetPts;
      if (budgetPts < WEIGHTS.budgetFit * 0.5) {
        reasons.push('Price $' + listing.price.toLocaleString() + ' exceeds your budget');
      }
    }
  } else {
    points += Math.round(WEIGHTS.budgetFit * 0.5);
  }

  // -----------------------------------------------------------------------
  // 5. Property type match (10 pts)
  // -----------------------------------------------------------------------
  maxPossible += WEIGHTS.propertyTypeMatch;
  if (intent.propertyType && intent.propertyType !== 'any') {
    var typeMap = {
      house: 'single_family',
      condo: 'condo',
      townhome: 'townhome',
      multi_family: 'multi_family',
      land: 'land',
    };
    var target = typeMap[intent.propertyType] || intent.propertyType;
    if (listing.prop_type === target) {
      points += WEIGHTS.propertyTypeMatch;
      reasons.push('Property type matches: ' + intent.propertyType);
    }
  } else {
    points += Math.round(WEIGHTS.propertyTypeMatch * 0.5);
  }

  // -----------------------------------------------------------------------
  // 6. Sqft match (up to 10 pts)
  // -----------------------------------------------------------------------
  maxPossible += WEIGHTS.sqftMatch;
  var sqftMin = (intent.constraints && intent.constraints.sqftMin) ? intent.constraints.sqftMin : null;
  if (sqftMin != null && listing.sqft != null) {
    if (listing.sqft >= sqftMin) {
      points += WEIGHTS.sqftMatch;
      reasons.push(listing.sqft + ' sqft meets your minimum of ' + sqftMin);
    } else {
      var sqftRatio = listing.sqft / sqftMin;
      points += Math.round(WEIGHTS.sqftMatch * Math.max(0, sqftRatio));
    }
  } else {
    points += Math.round(WEIGHTS.sqftMatch * 0.5);
  }

  // -----------------------------------------------------------------------
  // 7. Nice-to-haves (bonus, not penalized)
  // -----------------------------------------------------------------------
  if (intent.niceToHave && intent.niceToHave.length > 0) {
    intent.niceToHave.forEach(function (item) {
      if (hasFeature(listing, item)) {
        matchedNiceToHave.push(item);
        points += 3; // small bonus per nice-to-have
        reasons.push('Nice-to-have: ' + item + ' \u2713');
      }
    });
  }

  // -----------------------------------------------------------------------
  // 8. Lifestyle tags scoring
  // -----------------------------------------------------------------------
  var lifestylePoints = 0;
  var lifestyleMaxPossible = 0;

  if (intent.lifestyleTags && intent.lifestyleTags.length > 0) {
    intent.lifestyleTags.forEach(function (tag) {
      var tagLower = tag.toLowerCase().replace(/[\s-]+/g, '_');

      if (tagLower === 'fitness_focused' || tagLower === 'fitness') {
        lifestyleMaxPossible += 28;
        if (listing.garage) {
          lifestylePoints += WEIGHTS.lifestyle.fitness_focused.garage;
          reasons.push('Garage available for home gym setup');
        }
        if (listing.basement === 'finished') {
          lifestylePoints += WEIGHTS.lifestyle.fitness_focused.basementFinished;
          reasons.push('Finished basement for workout space');
        }
        if (listing.ceilingHeight >= 9) {
          lifestylePoints += WEIGHTS.lifestyle.fitness_focused.ceilingHeight9Plus;
          reasons.push('High ceilings (' + listing.ceilingHeight + "') for fitness equipment");
        }
        if (listing.sqft >= 2200) {
          lifestylePoints += WEIGHTS.lifestyle.fitness_focused.sqft2200Plus;
          reasons.push('Spacious layout (' + listing.sqft + ' sqft) for dedicated gym area');
        }
      }

      if (tagLower === 'family') {
        lifestyleMaxPossible += 20;
        if (listing.schoolRating >= 7) {
          lifestylePoints += WEIGHTS.lifestyle.family.schoolRating7Plus;
          reasons.push('School rating ' + listing.schoolRating + '/10 - great for families');
        }
        if (listing.beds >= 3) {
          lifestylePoints += WEIGHTS.lifestyle.family.beds3Plus;
        }
        if (hasAnyFeature(listing, ['yard', 'backyard', 'fenced yard'])) {
          lifestylePoints += WEIGHTS.lifestyle.family.yardFeature;
          reasons.push('Yard space for kids');
        }
      }

      if (tagLower === 'remote_work') {
        lifestyleMaxPossible += 13;
        if (hasAnyFeature(listing, ['home office', 'office'])) {
          lifestylePoints += WEIGHTS.lifestyle.remote_work.officeFeature;
          reasons.push('Dedicated home office space');
        }
        if (listing.sqft >= 1800) {
          lifestylePoints += WEIGHTS.lifestyle.remote_work.sqft1800Plus;
        }
      }

      if (tagLower === 'investor' || tagLower === 'investment') {
        lifestyleMaxPossible += 20;
        var pricePerSqft = listing.sqft > 0 ? listing.price / listing.sqft : 999;
        if (pricePerSqft < 150) {
          lifestylePoints += WEIGHTS.lifestyle.investor.lowPricePerSqft;
          reasons.push('Low price/sqft ($' + Math.round(pricePerSqft) + ') - good investment value');
        }
        if (listing.daysOnMarket > 60) {
          lifestylePoints += WEIGHTS.lifestyle.investor.highDaysOnMarket;
          reasons.push(listing.daysOnMarket + ' days on market - negotiation leverage');
        }
        if (listing.hoa > 300) {
          lifestylePoints += WEIGHTS.lifestyle.investor.highHoaPenalty;
          reasons.push('High HOA ($' + listing.hoa + '/mo) cuts into returns');
        }
      }

      if (tagLower === 'luxury') {
        lifestyleMaxPossible += 20;
        if (hasFeature(listing, 'pool')) {
          lifestylePoints += WEIGHTS.lifestyle.luxury.poolFeature;
          reasons.push('Pool adds luxury appeal');
        }
        if (listing.sqft >= 3000) {
          lifestylePoints += WEIGHTS.lifestyle.luxury.sqft3000Plus;
          reasons.push('Spacious ' + listing.sqft + ' sqft layout');
        }
        if (hasFeature(listing, 'smart home')) {
          lifestylePoints += WEIGHTS.lifestyle.luxury.smartHomeFeature;
          reasons.push('Smart home technology included');
        }
      }

      if (tagLower === 'starter_home' || tagLower === 'starter') {
        lifestyleMaxPossible += 15;
        if (listing.price < 300000) {
          lifestylePoints += WEIGHTS.lifestyle.starter_home.priceSub300k;
          reasons.push('Price under $300k - great starter home value');
        }
        if (listing.beds >= 2) {
          lifestylePoints += WEIGHTS.lifestyle.starter_home.beds2Plus;
        }
      }
    });
  }

  // -----------------------------------------------------------------------
  // 9. Investment score
  // -----------------------------------------------------------------------
  var investmentPoints = 50; // baseline
  var pricePerSqft = listing.sqft > 0 ? listing.price / listing.sqft : 999;

  if (pricePerSqft < 150) {
    investmentPoints += WEIGHTS.investment.lowPricePerSqft;
  } else if (pricePerSqft < 200) {
    investmentPoints += WEIGHTS.investment.medPricePerSqft;
  }

  if (listing.daysOnMarket > 60) {
    investmentPoints += WEIGHTS.investment.highDaysOnMarket;
  } else if (listing.daysOnMarket > 30) {
    investmentPoints += WEIGHTS.investment.medDaysOnMarket;
  }

  if (listing.hoa <= 100) {
    investmentPoints += WEIGHTS.investment.lowHoa;
  }

  if (listing.schoolRating >= 7) {
    investmentPoints += WEIGHTS.investment.goodSchool;
  }

  if (listing.prop_type === 'multi_family') {
    investmentPoints += WEIGHTS.investment.multiFamily;
  }

  var investmentScore = clamp(investmentPoints, 0, 100);

  // -----------------------------------------------------------------------
  // 10. Risk score (higher = lower risk = better)
  // -----------------------------------------------------------------------
  var riskPoints = 50; // baseline
  var currentYear = new Date().getFullYear();
  var age = currentYear - (listing.yearBuilt || 2000);

  if (listing.yearBuilt >= 2010) {
    riskPoints += WEIGHTS.risk.newBuild;
  } else if (listing.yearBuilt >= 2000) {
    riskPoints += WEIGHTS.risk.modernBuild;
  } else if (listing.yearBuilt >= 1980) {
    riskPoints += WEIGHTS.risk.midBuild;
  } else if (listing.yearBuilt < 1960) {
    riskPoints += WEIGHTS.risk.oldBuild;
  }

  if (listing.hoa <= 100) {
    riskPoints += WEIGHTS.risk.lowHoa;
  } else if (listing.hoa > 400) {
    riskPoints += WEIGHTS.risk.highHoa;
  }

  if (listing.daysOnMarket >= 10 && listing.daysOnMarket <= 60) {
    riskPoints += WEIGHTS.risk.normalDom;
  } else if (listing.daysOnMarket > 120) {
    riskPoints += WEIGHTS.risk.veryHighDom;
  } else if (listing.daysOnMarket < 5) {
    riskPoints += WEIGHTS.risk.veryLowDom;
  }

  if (listing.schoolRating >= 7) {
    riskPoints += WEIGHTS.risk.goodSchool;
  } else if (listing.schoolRating <= 3) {
    riskPoints += WEIGHTS.risk.poorSchool;
  }

  var riskScore = clamp(riskPoints, 0, 100);

  // -----------------------------------------------------------------------
  // 11. Compute lifestyle score (normalize to 0-100)
  // -----------------------------------------------------------------------
  var lifestyleScore;
  if (lifestyleMaxPossible > 0) {
    lifestyleScore = clamp(Math.round((lifestylePoints / lifestyleMaxPossible) * 100), 0, 100);
  } else {
    lifestyleScore = 50; // neutral if no lifestyle tags
  }

  // -----------------------------------------------------------------------
  // 12. Compute total score
  // -----------------------------------------------------------------------
  // Base = hard-match points (beds + baths + budget + type + sqft + must-haves)
  // We normalize the base to a 0-70 range, then blend with lifestyle (up to 30 bonus)
  var baseMax = WEIGHTS.bedsMatch + WEIGHTS.bathsMatch + WEIGHTS.budgetFit
    + WEIGHTS.propertyTypeMatch + WEIGHTS.sqftMatch;
  // points can go negative from must-have penalties, but we floor at 0 for ratio
  var baseRatio = clamp(points / baseMax, 0, 1);
  var baseScore = Math.round(baseRatio * 70);

  // Lifestyle bonus (up to 30 pts)
  var lifestyleBonus = Math.round((lifestyleScore / 100) * 30);

  var totalScore = clamp(baseScore + lifestyleBonus, 0, 100);

  // If there are missing must-haves, cap the total score
  if (missingMustHave.length > 0) {
    totalScore = Math.min(totalScore, Math.max(20, 70 - missingMustHave.length * 12));
  }

  // De-duplicate reasons
  var uniqueReasons = [];
  var seenReasons = {};
  reasons.forEach(function (r) {
    if (!seenReasons[r]) {
      seenReasons[r] = true;
      uniqueReasons.push(r);
    }
  });

  return {
    totalScore: totalScore,
    lifestyleScore: lifestyleScore,
    investmentScore: investmentScore,
    riskScore: riskScore,
    reasons: uniqueReasons.slice(0, 8),
    matched: {
      mustHave: matchedMustHave,
      niceToHave: matchedNiceToHave,
    },
    missing: {
      mustHave: missingMustHave,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { scoreListing, WEIGHTS };
