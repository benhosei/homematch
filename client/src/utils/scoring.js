const WEIGHTS = {
  price: 0.35,
  beds: 0.25,
  baths: 0.15,
  propType: 0.25,
};

export function scoreListing(listing, prefs) {
  const breakdown = {};

  if (prefs.priceMin != null && prefs.priceMax != null && listing.price) {
    const mid = (prefs.priceMin + prefs.priceMax) / 2;
    const range = prefs.priceMax - prefs.priceMin;
    const halfRange = range / 2 || 1;

    if (listing.price >= prefs.priceMin && listing.price <= prefs.priceMax) {
      const distFromMid = Math.abs(listing.price - mid);
      breakdown.price = 100 - (distFromMid / halfRange) * 20;
    } else {
      const overshoot =
        listing.price > prefs.priceMax
          ? listing.price - prefs.priceMax
          : prefs.priceMin - listing.price;
      const penaltyRatio = Math.min(overshoot / halfRange, 1);
      breakdown.price = Math.max(0, 70 * (1 - penaltyRatio));
    }
  } else {
    breakdown.price = 50;
  }

  if (prefs.beds != null && listing.beds != null) {
    const diff = Math.abs(listing.beds - prefs.beds);
    if (diff === 0) breakdown.beds = 100;
    else if (diff === 1) breakdown.beds = 70;
    else if (diff === 2) breakdown.beds = 40;
    else breakdown.beds = 10;
  } else {
    breakdown.beds = 50;
  }

  if (prefs.baths != null && listing.baths != null) {
    const diff = Math.abs(listing.baths - prefs.baths);
    if (diff === 0) breakdown.baths = 100;
    else if (diff <= 0.5) breakdown.baths = 85;
    else if (diff <= 1) breakdown.baths = 65;
    else if (diff <= 2) breakdown.baths = 35;
    else breakdown.baths = 10;
  } else {
    breakdown.baths = 50;
  }

  if (prefs.propType && listing.prop_type) {
    const typeMap = {
      house: ['single_family'],
      condo: ['condo', 'cond_op', 'co_op', 'condos'],
      townhome: ['townhouse', 'townhomes'],
      multi_family: ['multi_family'],
    };

    const acceptableTypes = typeMap[prefs.propType] || [prefs.propType];
    const listingType = listing.prop_type.toLowerCase();
    const listingSubType = (listing.prop_sub_type || '').toLowerCase();

    if (
      acceptableTypes.includes(listingType) ||
      acceptableTypes.includes(listingSubType)
    ) {
      breakdown.propType = 100;
    } else {
      breakdown.propType = 20;
    }
  } else {
    breakdown.propType = 50;
  }

  const score = Math.round(
    breakdown.price * WEIGHTS.price +
      breakdown.beds * WEIGHTS.beds +
      breakdown.baths * WEIGHTS.baths +
      breakdown.propType * WEIGHTS.propType
  );

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}
