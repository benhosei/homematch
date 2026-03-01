'use strict';

const express = require('express');
const router = express.Router();

const {
  calculateMonthlyPI,
  calculatePMI,
  getStateTaxRate,
  estimateInsurance,
  describePMIRule,
  NATIONAL_AVG_TAX_RATE,
} = require('../utils/amortization');

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/finance/payment
// Deterministic mortgage-payment calculator (no AI).
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TERMS = [15, 30];
const VALID_CREDIT_RANGES = ['poor', 'fair', 'good', 'very_good', 'excellent'];

router.post('/payment', (req, res) => {
  try {
    const {
      homePrice,
      downPayment,
      interestRate,
      termYears,
      creditRange,
      location,
      propertyTaxRate,
      insurancePerMonth,
      hoaPerMonth,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    const errors = [];

    if (homePrice == null || typeof homePrice !== 'number' || homePrice <= 0) {
      errors.push('homePrice must be a positive number.');
    }

    if (!downPayment || !downPayment.type || downPayment.value == null) {
      errors.push('downPayment must be an object with { type, value }.');
    } else if (!['percent', 'amount'].includes(downPayment.type)) {
      errors.push('downPayment.type must be "percent" or "amount".');
    } else if (typeof downPayment.value !== 'number' || downPayment.value < 0) {
      errors.push('downPayment.value must be a non-negative number.');
    }

    if (interestRate == null || typeof interestRate !== 'number' || interestRate < 0) {
      errors.push('interestRate must be a non-negative number (annual %, e.g. 6.5).');
    }

    if (!VALID_TERMS.includes(termYears)) {
      errors.push('termYears must be 15 or 30.');
    }

    if (creditRange !== undefined && !VALID_CREDIT_RANGES.includes(creditRange)) {
      errors.push(`creditRange must be one of: ${VALID_CREDIT_RANGES.join(', ')}.`);
    }

    if (location !== undefined) {
      if (typeof location !== 'object' || location === null) {
        errors.push('location must be an object with { state, zip }.');
      }
    }

    if (propertyTaxRate !== undefined) {
      if (typeof propertyTaxRate !== 'number' || propertyTaxRate < 0) {
        errors.push('propertyTaxRate must be a non-negative number (annual %).');
      }
    }

    if (insurancePerMonth !== undefined) {
      if (typeof insurancePerMonth !== 'number' || insurancePerMonth < 0) {
        errors.push('insurancePerMonth must be a non-negative number.');
      }
    }

    if (hoaPerMonth !== undefined) {
      if (typeof hoaPerMonth !== 'number' || hoaPerMonth < 0) {
        errors.push('hoaPerMonth must be a non-negative number.');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // ── Compute down-payment amount ───────────────────────────────────────
    let downPaymentAmount;
    if (downPayment.type === 'percent') {
      if (downPayment.value > 100) {
        return res.status(400).json({
          errors: ['downPayment.value cannot exceed 100 when type is "percent".'],
        });
      }
      downPaymentAmount = homePrice * (downPayment.value / 100);
    } else {
      downPaymentAmount = downPayment.value;
    }

    if (downPaymentAmount > homePrice) {
      return res.status(400).json({
        errors: ['Down payment cannot exceed home price.'],
      });
    }

    const loanAmount = homePrice - downPaymentAmount;

    // ── Principal & Interest ──────────────────────────────────────────────
    const principalInterest = calculateMonthlyPI(loanAmount, interestRate, termYears);

    // ── Property Tax ──────────────────────────────────────────────────────
    let taxRate;
    if (propertyTaxRate !== undefined) {
      taxRate = propertyTaxRate;
    } else if (location && location.state) {
      taxRate = getStateTaxRate(location.state);
    } else {
      taxRate = NATIONAL_AVG_TAX_RATE;
    }
    const propertyTax = Math.round(((homePrice * (taxRate / 100)) / 12) * 100) / 100;

    // ── Insurance ─────────────────────────────────────────────────────────
    let insurance;
    let insuranceUsedLabel;
    if (insurancePerMonth !== undefined) {
      insurance = Math.round(insurancePerMonth * 100) / 100;
      insuranceUsedLabel = `User-provided: $${insurance}/mo`;
    } else {
      insurance = estimateInsurance(homePrice);
      insuranceUsedLabel = `Estimated at 0.35% of home price/year ($${insurance}/mo)`;
    }

    // ── PMI ───────────────────────────────────────────────────────────────
    const pmi = calculatePMI(loanAmount, homePrice, creditRange);
    const pmiRule = describePMIRule(loanAmount, homePrice, creditRange);

    // ── HOA ───────────────────────────────────────────────────────────────
    const hoa = (typeof hoaPerMonth === 'number' && hoaPerMonth >= 0) ? hoaPerMonth : 0;

    // ── Total ─────────────────────────────────────────────────────────────
    const total = Math.round((principalInterest + propertyTax + insurance + pmi + hoa) * 100) / 100;

    res.json({
      monthly: {
        principalInterest,
        propertyTax,
        insurance,
        pmi,
        hoa,
        total,
      },
      assumptions: {
        propertyTaxRateUsed: taxRate,
        insuranceUsed: insuranceUsedLabel,
        pmiRule,
      },
    });
  } catch (err) {
    console.error('Finance /payment error:', err);
    res.status(500).json({ error: 'Internal server error computing payment.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/finance/affordability
// Rule-based NLP affordability parser (no AI/LLM service needed).
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/affordability', (req, res) => {
  try {
    const { freeText, locationText } = req.body;

    if (!freeText || typeof freeText !== 'string' || freeText.trim().length === 0) {
      return res.status(400).json({
        errors: ['freeText is required and must be a non-empty string.'],
      });
    }

    const text = freeText.trim().toLowerCase();
    const locText = (locationText || '').trim().toLowerCase();

    // ── Extract financial profile from freeText ─────────────────────────
    const incomeAnnual = parseIncome(text);
    const debtsMonthly = parseDebts(text);
    const rentMonthly = parseRent(text);
    const downPaymentCash = parseDownPayment(text);
    const creditScoreApprox = parseCreditScore(text);
    const savingsMonthly = parseSavingsMonthly(text);

    const profile = {
      incomeAnnual,
      debtsMonthly,
      rentMonthly,
      downPaymentCash,
      creditScoreApprox,
      savingsMonthly,
    };

    // ── Determine confidence based on how much info we extracted ─────────
    const fieldsFilled = [
      incomeAnnual,
      debtsMonthly,
      rentMonthly,
      downPaymentCash,
      creditScoreApprox,
      savingsMonthly,
    ].filter((v) => v !== null).length;

    let confidence;
    if (incomeAnnual !== null && fieldsFilled >= 3) {
      confidence = 0.8;
    } else if (incomeAnnual !== null) {
      confidence = 0.6;
    } else if (fieldsFilled >= 2) {
      confidence = 0.5;
    } else {
      confidence = 0.3;
    }

    // ── Clarifying questions for missing info ───────────────────────────
    const clarifyingQuestions = [];
    if (incomeAnnual === null) {
      clarifyingQuestions.push(
        'What is your annual household income (before taxes)?'
      );
    }
    if (debtsMonthly === null) {
      clarifyingQuestions.push(
        'How much do you pay each month toward debts (student loans, car, credit cards)?'
      );
    }
    if (downPaymentCash === null) {
      clarifyingQuestions.push(
        'How much have you saved for a down payment?'
      );
    }
    if (creditScoreApprox === null) {
      clarifyingQuestions.push(
        'What is your approximate credit score (e.g. 720)?'
      );
    }
    if (rentMonthly === null && debtsMonthly === null) {
      clarifyingQuestions.push(
        'How much are you currently paying in rent each month?'
      );
    }

    // ── Generate recommendation using DTI rules ─────────────────────────
    const recommendation = buildRecommendation(profile, locText);

    res.json({
      profile,
      recommendation,
      confidence: Math.round(confidence * 100) / 100,
      clarifyingQuestions,
    });
  } catch (err) {
    console.error('Finance /affordability error:', err);
    res.status(500).json({ error: 'Internal server error computing affordability.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NLP Parsing helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a dollar amount from a regex match, handling k/m suffixes and commas.
 * @param {string} numStr  e.g. "120,000" or "120"
 * @param {string} suffix  e.g. "k", "m", "", undefined
 * @returns {number|null}
 */
function parseDollarAmount(numStr, suffix) {
  if (!numStr) return null;
  let val = parseFloat(numStr.replace(/,/g, ''));
  if (isNaN(val)) return null;
  const s = (suffix || '').toLowerCase();
  if (s === 'k') val *= 1000;
  if (s === 'm') val *= 1000000;
  return val;
}

/**
 * Extract annual income.
 * Patterns: "I make $85k", "earn $120,000", "income is $95k a year",
 *           "$85k salary", "$6000/month income", "85000 per year"
 */
function parseIncome(text) {
  // Monthly income pattern: "$X/month income", "$X per month", "$X a month"
  const monthlyPatterns = [
    /(?:i\s+(?:make|earn|bring\s+in|take\s+home)|income\s+(?:is|of)?|salary\s+(?:is|of)?)\s*\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/\s*month|per\s+month|a\s+month|monthly)/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/\s*month|per\s+month|a\s+month|monthly)\s*(?:income|salary|pay)/i,
  ];
  for (const pat of monthlyPatterns) {
    const m = text.match(pat);
    if (m) {
      const monthly = parseDollarAmount(m[1], m[2]);
      if (monthly !== null && monthly > 0) return Math.round(monthly * 12);
    }
  }

  // Annual income patterns
  const annualPatterns = [
    /(?:i\s+(?:make|earn|bring\s+in|take\s+home)|income\s+(?:is|of)?|salary\s+(?:is|of)?)\s*\$?([\d,]+\.?\d*)\s*(k|m)?(?:\s*(?:\/?\s*(?:year|yr|annually)|per\s+year|a\s+year))?/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:salary|income|per\s+year|a\s+year|annually|\/\s*(?:year|yr))/i,
  ];
  for (const pat of annualPatterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseDollarAmount(m[1], m[2]);
      // Heuristic: if the number is small (< 1000), it was probably meant as
      // thousands, but we already handle "k". If < 500 and no suffix, it is
      // likely monthly — multiply by 12.
      if (val !== null && val > 0) {
        if (val < 500 && !m[2]) return Math.round(val * 1000); // assume "85" means "85k"
        if (val < 5000 && !m[2]) return Math.round(val * 12);  // assume monthly
        return Math.round(val);
      }
    }
  }

  return null;
}

/**
 * Extract monthly debt payments.
 * Patterns: "debt $1200/month", "$500 in student loans", "car payment $400",
 *           "I owe $800 per month", "payments of $1000"
 */
function parseDebts(text) {
  const patterns = [
    /(?:debt|debts|owe|owing|payments?|student\s+loans?|car\s+(?:payment|loan)|credit\s+card)\s*(?:of|is|are|about|around)?\s*\$?([\d,]+\.?\d*)\s*(k|m)?(?:\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly))?/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)?\s*(?:in\s+)?(?:debt|debts|student\s+loans?|car\s+(?:payment|loan)|payments?)/i,
    /(?:pay|paying)\s*\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)?\s*(?:in|on|for|toward)\s*(?:debt|loans?|credit|payments?)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseDollarAmount(m[1], m[2]);
      if (val !== null && val > 0) return Math.round(val);
    }
  }
  return null;
}

/**
 * Extract monthly rent.
 * Patterns: "rent $1500", "paying $1800/month rent", "rent is $2000"
 */
function parseRent(text) {
  const patterns = [
    /rent\s*(?:is|of|about|around|currently)?\s*\$?([\d,]+\.?\d*)\s*(k|m)?/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)?\s*(?:in\s+)?rent/i,
    /paying\s*\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)?(?:\s+(?:in|for)\s+rent)?/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseDollarAmount(m[1], m[2]);
      if (val !== null && val > 0) return Math.round(val);
    }
  }
  return null;
}

/**
 * Extract down-payment savings.
 * Patterns: "saved $40k", "down payment $50,000", "$30k cash",
 *           "have $25000 saved up", "$60k for a down payment"
 */
function parseDownPayment(text) {
  const patterns = [
    /(?:saved|save|down\s*payment|have)\s*(?:up|about|around|approximately)?\s*\$?([\d,]+\.?\d*)\s*(k|m)?/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:saved|cash|down\s*payment|for\s+(?:a\s+)?down\s*payment)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseDollarAmount(m[1], m[2]);
      if (val !== null && val > 0) return Math.round(val);
    }
  }
  return null;
}

/**
 * Extract approximate credit score.
 * Patterns: "credit score 720", "720 credit", "my score is 680",
 *           "credit is about 750"
 */
function parseCreditScore(text) {
  const patterns = [
    /credit\s*(?:score)?\s*(?:is|of|about|around|approximately)?\s*(\d{3})/i,
    /(\d{3})\s*credit/i,
    /(?:my\s+)?score\s*(?:is|of|about|around)?\s*(\d{3})/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const score = parseInt(m[1], 10);
      if (score >= 300 && score <= 850) return score;
    }
  }
  return null;
}

/**
 * Extract monthly savings rate.
 * Patterns: "saving $1000/month", "I save $500 per month"
 */
function parseSavingsMonthly(text) {
  const patterns = [
    /(?:saving|save|put\s+away|set\s+aside)\s*\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)/i,
    /\$?([\d,]+\.?\d*)\s*(k|m)?\s*(?:\/?\s*(?:month|mo)|per\s+month|a\s+month|monthly)\s*(?:in\s+)?(?:savings?)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseDollarAmount(m[1], m[2]);
      if (val !== null && val > 0) return Math.round(val);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Recommendation engine (standard DTI rules)
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_RATE = 7.0;       // assumed 30-yr rate for back-calculation
const DEFAULT_TERM = 30;
const FRONT_END_DTI = 0.28;     // housing payment should be <= 28% gross income
const BACK_END_DTI = 0.36;      // total debt should be <= 36% gross income

/**
 * Build a recommendation object from the extracted profile.
 */
function buildRecommendation(profile, locationText) {
  const {
    incomeAnnual,
    debtsMonthly,
    rentMonthly,
    downPaymentCash,
    creditScoreApprox,
    savingsMonthly,
  } = profile;

  // Fallback income estimate: if rent is known but income is not, assume
  // rent ~ 30% of gross monthly income => income ~ rent / 0.30 * 12
  let effectiveAnnualIncome = incomeAnnual;
  if (effectiveAnnualIncome === null && rentMonthly !== null) {
    effectiveAnnualIncome = Math.round((rentMonthly / 0.30) * 12);
  }

  // If we still have no income, produce a minimal recommendation
  if (effectiveAnnualIncome === null || effectiveAnnualIncome <= 0) {
    return {
      recommendedMaxHomePrice: 0,
      recommendedMonthlyPaymentMax: 0,
      suggestedDownPaymentPercent: 20,
      riskLevel: 'high',
      nextSteps: [
        'Provide your annual household income so we can calculate an accurate budget.',
        'Gather recent pay stubs or tax returns to verify income.',
        'Check your credit score for free at annualcreditreport.com.',
      ],
    };
  }

  const monthlyGross = effectiveAnnualIncome / 12;
  const existingDebts = debtsMonthly || 0;

  // Max housing payment (front-end DTI: 28% of gross)
  let maxHousingPayment = Math.round(monthlyGross * FRONT_END_DTI);

  // Also check back-end DTI: total debts + housing <= 36% of gross
  const backEndMax = Math.round(monthlyGross * BACK_END_DTI) - existingDebts;
  if (backEndMax < maxHousingPayment) {
    maxHousingPayment = Math.max(0, backEndMax);
  }

  // Determine current DTI
  const currentDTI = existingDebts / monthlyGross;
  const projectedDTI = (existingDebts + maxHousingPayment) / monthlyGross;

  let riskLevel;
  if (projectedDTI > 0.36) {
    riskLevel = 'high';
  } else if (projectedDTI > 0.28) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Back-calculate max home price from max monthly P&I.
  // We assume ~70% of total housing payment goes to P&I (rest is tax/ins/PMI).
  // This is a rough heuristic that avoids circular dependency.
  const piPortion = maxHousingPayment * 0.70;

  // From amortization formula, solve for P:
  //   P = M * [ (1+r)^n - 1 ] / [ r(1+r)^n ]
  const r = DEFAULT_RATE / 100 / 12;
  const n = DEFAULT_TERM * 12;
  const rPowN = Math.pow(1 + r, n);
  const maxLoanAmount = piPortion > 0
    ? piPortion * (rPowN - 1) / (r * rPowN)
    : 0;

  // Suggested down-payment percent
  let suggestedDownPercent = 20;
  if (downPaymentCash !== null && maxLoanAmount > 0) {
    // If the user can cover 20% of (loan + down), great. Otherwise lower it.
    const impliedHome = maxLoanAmount / 0.80;
    if (downPaymentCash >= impliedHome * 0.20) {
      suggestedDownPercent = 20;
    } else if (downPaymentCash >= impliedHome * 0.10) {
      suggestedDownPercent = 10;
    } else if (downPaymentCash >= impliedHome * 0.05) {
      suggestedDownPercent = 5;
    } else if (downPaymentCash >= impliedHome * 0.035) {
      suggestedDownPercent = 3.5; // FHA
    } else {
      suggestedDownPercent = 3;
    }
  }

  // Max home price = maxLoanAmount / (1 - downPercent/100)
  let maxHomePrice = suggestedDownPercent < 100
    ? Math.round(maxLoanAmount / (1 - suggestedDownPercent / 100))
    : 0;

  // Cap by down payment cash if we know it
  if (downPaymentCash !== null && maxHomePrice > 0) {
    const downRequired = maxHomePrice * (suggestedDownPercent / 100);
    if (downPaymentCash < downRequired) {
      // Adjust: max home they can afford = downPaymentCash / (downPercent/100)
      const cashConstrained = Math.round(downPaymentCash / (suggestedDownPercent / 100));
      if (cashConstrained < maxHomePrice) {
        maxHomePrice = cashConstrained;
      }
    }
  }

  // Round to nearest $1000
  maxHomePrice = Math.round(maxHomePrice / 1000) * 1000;

  // ── Next steps ──────────────────────────────────────────────────────────
  const nextSteps = [];

  if (creditScoreApprox !== null && creditScoreApprox < 620) {
    nextSteps.push(
      'Work on improving your credit score before applying for a mortgage — aim for 620+ for conventional loans.'
    );
  } else if (creditScoreApprox !== null && creditScoreApprox < 700) {
    nextSteps.push(
      'Consider improving your credit score to qualify for better interest rates — 740+ gets the best terms.'
    );
  }

  if (suggestedDownPercent < 20) {
    nextSteps.push(
      `With ${suggestedDownPercent}% down, you will likely pay PMI. Saving for 20% down eliminates PMI and lowers monthly costs.`
    );
  }

  if (riskLevel === 'high') {
    nextSteps.push(
      'Your debt-to-income ratio is high. Consider paying down existing debts before buying to reduce financial risk.'
    );
  }

  if (downPaymentCash === null) {
    nextSteps.push(
      'Start building a dedicated home savings fund — aim for at least 3-6 months of expenses plus your target down payment.'
    );
  }

  nextSteps.push('Get pre-approved by 2-3 lenders to compare interest rates and loan terms.');

  if (savingsMonthly !== null && savingsMonthly > 0 && downPaymentCash !== null) {
    const targetDown = maxHomePrice * 0.20;
    const gap = targetDown - downPaymentCash;
    if (gap > 0) {
      const monthsToSave = Math.ceil(gap / savingsMonthly);
      nextSteps.push(
        `At your current savings rate, you could reach a 20% down payment in approximately ${monthsToSave} months.`
      );
    }
  }

  if (nextSteps.length < 3) {
    nextSteps.push('Research first-time homebuyer programs in your area for potential down payment assistance.');
  }

  // Keep to 5 max
  const finalSteps = nextSteps.slice(0, 5);

  return {
    recommendedMaxHomePrice: maxHomePrice,
    recommendedMonthlyPaymentMax: maxHousingPayment,
    suggestedDownPaymentPercent: suggestedDownPercent,
    riskLevel,
    nextSteps: finalSteps,
  };
}

module.exports = router;
