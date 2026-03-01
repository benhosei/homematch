/**
 * AI Explanations Service
 * Deterministic "AI-like" match explanations, badges, and offer strength scoring.
 * All logic is pure math — no external API calls.
 */

/**
 * Generate a match explanation for a property vs user preferences.
 *
 * @param {Object} listing - Property listing data
 * @param {Object} prefs   - User preferences { priceMax, beds, baths, sqft, propType, city }
 * @returns {{ score: number, headline: string, reasons: string[], concerns: string[] }}
 */
export function generateMatchExplanation(listing, prefs = {}) {
  const reasons = [];
  const concerns = [];
  let score = 50; // baseline

  // Price match
  if (prefs.priceMax) {
    const priceRatio = listing.price / prefs.priceMax;
    if (priceRatio <= 0.75) {
      score += 12;
      reasons.push(`Well under budget at ${Math.round((1 - priceRatio) * 100)}% below your max`);
    } else if (priceRatio <= 0.9) {
      score += 8;
      reasons.push('Priced comfortably within your budget');
    } else if (priceRatio <= 1.0) {
      score += 3;
      reasons.push('Within budget, but near your upper limit');
    } else if (priceRatio <= 1.1) {
      score -= 5;
      concerns.push(`${Math.round((priceRatio - 1) * 100)}% over your budget — may need negotiation`);
    } else {
      score -= 15;
      concerns.push(`Significantly over budget by ${Math.round((priceRatio - 1) * 100)}%`);
    }
  }

  // Bedroom match
  if (prefs.beds) {
    const bedDiff = (listing.beds || 0) - prefs.beds;
    if (bedDiff === 0) {
      score += 10;
      reasons.push(`Exact bedroom match (${listing.beds} bed)`);
    } else if (bedDiff === 1) {
      score += 7;
      reasons.push('Has an extra bedroom — great for office or guests');
    } else if (bedDiff > 1) {
      score += 4;
      reasons.push(`${bedDiff} extra bedrooms for flexibility`);
    } else if (bedDiff === -1) {
      score -= 3;
      concerns.push('One fewer bedroom than preferred');
    } else {
      score -= 8;
      concerns.push(`${Math.abs(bedDiff)} fewer bedrooms than you wanted`);
    }
  }

  // Bathroom match
  if (prefs.baths) {
    const bathDiff = (listing.baths || 0) - prefs.baths;
    if (bathDiff >= 0) {
      score += 5;
      if (bathDiff > 0) reasons.push(`${bathDiff} extra bathroom${bathDiff > 1 ? 's' : ''}`);
    } else {
      score -= 4;
      concerns.push('Fewer bathrooms than preferred');
    }
  }

  // Square footage
  if (prefs.sqft && listing.sqft) {
    const sqftRatio = listing.sqft / prefs.sqft;
    if (sqftRatio >= 1.1) {
      score += 6;
      reasons.push(`${Math.round((sqftRatio - 1) * 100)}% more space than your minimum`);
    } else if (sqftRatio >= 0.95) {
      score += 3;
    } else if (sqftRatio >= 0.8) {
      score -= 3;
      concerns.push('Slightly smaller than preferred');
    } else {
      score -= 8;
      concerns.push(`Only ${listing.sqft.toLocaleString()} sqft — ${Math.round((1 - sqftRatio) * 100)}% smaller than preferred`);
    }
  }

  // Property type match
  if (prefs.propType && listing.property_type) {
    const listingType = (listing.property_type || '').toLowerCase();
    const prefType = prefs.propType.toLowerCase();
    if (listingType.includes(prefType) || prefType.includes(listingType)) {
      score += 5;
      reasons.push('Matches your preferred property type');
    }
  }

  // Location match
  if (prefs.city && listing.city) {
    if (listing.city.toLowerCase() === prefs.city.toLowerCase()) {
      score += 8;
      reasons.push(`Located in your preferred city: ${listing.city}`);
    }
  }

  // Bonus for listing photos
  if (listing.photos && listing.photos.length >= 10) {
    score += 2;
  }

  // Clamp score
  score = Math.min(99, Math.max(10, score));

  // Generate headline
  let headline;
  if (score >= 85) headline = 'Excellent match for your criteria';
  else if (score >= 70) headline = 'Strong match — worth a closer look';
  else if (score >= 55) headline = 'Decent match with some trade-offs';
  else if (score >= 40) headline = 'Partial match — review the details';
  else headline = 'Below your ideal criteria';

  return { score, headline, reasons, concerns };
}

/**
 * Generate smart badges for a listing.
 * Returns an array of { label, type, tooltip }
 */
export function generateBadges(listing, allListings = []) {
  const badges = [];

  // Price-related badges
  if (allListings.length > 0) {
    const avgPrice = allListings.reduce((s, l) => s + (l.price || 0), 0) / allListings.length;
    const priceDiff = ((listing.price - avgPrice) / avgPrice) * 100;

    if (priceDiff <= -15) {
      badges.push({ label: 'Great Deal', type: 'success', tooltip: `${Math.abs(Math.round(priceDiff))}% below area average` });
    } else if (priceDiff <= -5) {
      badges.push({ label: 'Below Avg Price', type: 'success', tooltip: `${Math.abs(Math.round(priceDiff))}% below average` });
    } else if (priceDiff >= 15) {
      badges.push({ label: 'Premium Price', type: 'warning', tooltip: `${Math.round(priceDiff)}% above area average` });
    }
  }

  // Price per sqft
  if (listing.price && listing.sqft && listing.sqft > 0) {
    const ppsf = listing.price / listing.sqft;
    if (ppsf < 150) {
      badges.push({ label: 'Great $/sqft', type: 'success', tooltip: `$${Math.round(ppsf)}/sqft` });
    } else if (ppsf > 400) {
      badges.push({ label: 'High $/sqft', type: 'warning', tooltip: `$${Math.round(ppsf)}/sqft` });
    }
  }

  // Days on market
  if (listing.days_on_market != null) {
    if (listing.days_on_market <= 3) {
      badges.push({ label: 'Just Listed', type: 'accent', tooltip: `${listing.days_on_market} days on market` });
    } else if (listing.days_on_market <= 7) {
      badges.push({ label: 'New Listing', type: 'accent', tooltip: `${listing.days_on_market} days on market` });
    } else if (listing.days_on_market > 60) {
      badges.push({ label: 'Price Negotiable', type: 'success', tooltip: `${listing.days_on_market} days — seller may be flexible` });
    }
  }

  // Property features
  if (listing.beds >= 4 && listing.baths >= 3) {
    badges.push({ label: 'Family Home', type: 'primary', tooltip: `${listing.beds} bed / ${listing.baths} bath` });
  }

  if (listing.sqft >= 3000) {
    badges.push({ label: 'Spacious', type: 'primary', tooltip: `${listing.sqft.toLocaleString()} sqft` });
  }

  // Status
  if (listing.status) {
    const status = listing.status.toLowerCase();
    if (status.includes('pending')) {
      badges.push({ label: 'Pending', type: 'warning', tooltip: 'Offer accepted — may still fall through' });
    } else if (status.includes('contingent')) {
      badges.push({ label: 'Contingent', type: 'warning', tooltip: 'Under contract with contingencies' });
    }
  }

  // Limit to 4 badges
  return badges.slice(0, 4);
}

/**
 * Check if a property appears overpriced based on area comparables.
 *
 * @param {Object} listing     - The listing to check
 * @param {Object[]} comparables - Other listings in the area
 * @returns {{ overpriced: boolean, confidence: string, reasoning: string, priceDiffPercent: number }}
 */
export function checkOverpriced(listing, comparables = []) {
  if (comparables.length < 3) {
    return { overpriced: false, confidence: 'low', reasoning: 'Not enough comparable listings to assess.', priceDiffPercent: 0 };
  }

  // Filter to similar bed/bath count
  const similar = comparables.filter(c =>
    c.property_id !== listing.property_id &&
    Math.abs((c.beds || 0) - (listing.beds || 0)) <= 1 &&
    Math.abs((c.baths || 0) - (listing.baths || 0)) <= 1
  );

  if (similar.length < 2) {
    return { overpriced: false, confidence: 'low', reasoning: 'Few similar properties to compare against.', priceDiffPercent: 0 };
  }

  const avgPrice = similar.reduce((s, c) => s + c.price, 0) / similar.length;
  const priceDiffPercent = ((listing.price - avgPrice) / avgPrice) * 100;

  let overpriced = false;
  let confidence = 'low';
  let reasoning = '';

  if (priceDiffPercent > 20) {
    overpriced = true;
    confidence = 'high';
    reasoning = `Priced ${Math.round(priceDiffPercent)}% above similar homes in the area. Consider negotiating or asking for justification.`;
  } else if (priceDiffPercent > 10) {
    overpriced = true;
    confidence = 'medium';
    reasoning = `${Math.round(priceDiffPercent)}% above comparable listings. May be justified by upgrades or location premium.`;
  } else if (priceDiffPercent > 5) {
    overpriced = false;
    confidence = 'medium';
    reasoning = 'Slightly above average but within normal range for the area.';
  } else if (priceDiffPercent < -10) {
    overpriced = false;
    confidence = 'high';
    reasoning = `Priced ${Math.abs(Math.round(priceDiffPercent))}% below similar homes — could be a good deal or need investigation.`;
  } else {
    overpriced = false;
    confidence = 'high';
    reasoning = 'Competitively priced relative to similar properties.';
  }

  return { overpriced, confidence, reasoning, priceDiffPercent: Math.round(priceDiffPercent * 10) / 10 };
}

/**
 * Generate an offer strength score for a property.
 * Helps buyers understand how competitive their potential offer would be.
 *
 * Accepts two calling conventions:
 *   1. StartWizard: { listingPrice, maxBudget, downPaymentPercent, creditRange, preapproved, timeline }
 *   2. Direct:      { listPrice, offerPrice, daysOnMarket, isPreApproved, ... }
 *
 * @param {Object} params
 * @returns {{ score: number, level: string, label: string, tips: string[] }}
 */
export function generateOfferStrength({
  listPrice = 0,
  listingPrice = 0,
  offerPrice = 0,
  maxBudget = 0,
  daysOnMarket = 30,
  isPreApproved = false,
  preapproved = false,
  waiveInspection = false,
  flexibleClosing = false,
  cashOffer = false,
  escalationClause = false,
  downPaymentPercent = 0,
  creditRange,
  timeline,
}) {
  let score = 50;
  const tips = [];

  // Normalize inputs (support both calling conventions)
  const lp = listPrice || listingPrice || 0;
  const op = offerPrice || maxBudget || 0;
  const preApproved = isPreApproved || preapproved;

  // Offer vs list price
  if (lp > 0 && op > 0) {
    const ratio = op / lp;
    if (ratio >= 1.05) {
      score += 15;
      tips.push('Budget well above asking shows strong buying power');
    } else if (ratio >= 1.0) {
      score += 8;
      tips.push('Budget meets or exceeds asking price');
    } else if (ratio >= 0.95) {
      score += 2;
      tips.push('Budget is close to asking — competitive in a balanced market');
    } else if (ratio >= 0.85) {
      score -= 3;
      tips.push('Budget is slightly below asking — negotiation may be needed');
    } else {
      score -= 10;
      tips.push('Budget is significantly below asking — may not be competitive');
    }
  }

  // Down payment strength
  if (downPaymentPercent >= 20) {
    score += 10;
    tips.push('20%+ down payment eliminates PMI and strengthens your offer');
  } else if (downPaymentPercent >= 10) {
    score += 5;
    tips.push('Solid down payment — increasing to 20% would strengthen your offer further');
  } else if (downPaymentPercent > 0) {
    score += 1;
    tips.push('Low down payment — consider saving more to strengthen your position');
  }

  // Credit strength
  if (creditRange === 'excellent') {
    score += 10;
    tips.push('Excellent credit qualifies you for the best rates');
  } else if (creditRange === 'good') {
    score += 6;
    tips.push('Good credit — competitive for most loan programs');
  } else if (creditRange === 'fair') {
    score += 2;
    tips.push('Fair credit may limit your rate options');
  } else if (creditRange === 'poor') {
    score -= 5;
    tips.push('Improving credit score would significantly strengthen your offer');
  }

  // Market conditions (approximated by days on market)
  if (daysOnMarket <= 7) {
    score -= 5;
    tips.push('Very new listing — expect competing offers');
  } else if (daysOnMarket > 45) {
    score += 8;
    tips.push('Listing has been on market a while — seller may be motivated');
  }

  // Buyer advantages
  if (preApproved) {
    score += 10;
    tips.push('Pre-approval letter strengthens your offer');
  } else {
    tips.push('Get pre-approved to make your offer more competitive');
  }

  if (cashOffer) {
    score += 15;
    tips.push('Cash offers are highly preferred by sellers');
  }

  if (flexibleClosing) {
    score += 5;
    tips.push('Flexible closing date is attractive to sellers');
  }

  if (escalationClause) {
    score += 7;
    tips.push('Escalation clause protects you in bidding wars');
  }

  if (waiveInspection) {
    score += 5;
    tips.push('Waiving inspection is risky — consider an inspection for informational purposes only');
  }

  // Timeline bonus
  if (timeline === 'asap') {
    score += 3;
    tips.push('Quick timeline is attractive to motivated sellers');
  }

  score = Math.min(99, Math.max(10, score));

  let level;
  if (score >= 80) level = 'Strong';
  else if (score >= 65) level = 'Competitive';
  else if (score >= 50) level = 'Moderate';
  else if (score >= 35) level = 'Weak';
  else level = 'Needs Work';

  return { score, level, label: level, tips };
}

/**
 * Generate a simple monthly payment estimate string for a listing card
 */
export function estimateMonthlyPayment(price, downPaymentPercent = 20, rate = 6.5, years = 30) {
  const dp = price * (downPaymentPercent / 100);
  const loan = price - dp;
  const r = rate / 100 / 12;
  const n = years * 12;
  if (r === 0) return Math.round(loan / n);
  const payment = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  // Add estimated taxes + insurance (~1.5% of home value / 12)
  const extras = (price * 0.015) / 12;
  return Math.round(payment + extras);
}
