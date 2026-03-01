'use strict';

/**
 * Mortgage & amortization helpers for the finance module.
 *
 * All functions are pure, deterministic, and have no external dependencies.
 */

// ── State property-tax rate lookup (annual % of home value) ─────────────────
// Sources: Tax Foundation / Census averages, rounded to two decimals.
const STATE_TAX_RATES = {
  NJ: 2.49,
  IL: 2.27,
  NH: 2.18,
  CT: 2.14,
  VT: 1.90,
  WI: 1.85,
  TX: 1.80,
  NE: 1.73,
  NY: 1.72,
  RI: 1.63,
  PA: 1.58,
  OH: 1.56,
  IA: 1.57,
  MI: 1.54,
  KS: 1.41,
  SD: 1.31,
  ME: 1.36,
  MN: 1.12,
  MA: 1.23,
  AK: 1.19,
  MD: 1.09,
  MO: 0.97,
  OR: 0.97,
  GA: 0.92,
  FL: 0.89,
  OK: 0.90,
  NC: 0.84,
  IN: 0.85,
  WA: 0.98,
  VA: 0.82,
  ND: 0.98,
  MT: 0.84,
  CA: 0.76,
  AZ: 0.66,
  TN: 0.71,
  ID: 0.69,
  NM: 0.80,
  MS: 0.81,
  KY: 0.86,
  LA: 0.55,
  AR: 0.62,
  NV: 0.60,
  DE: 0.57,
  DC: 0.56,
  SC: 0.57,
  WV: 0.58,
  UT: 0.63,
  WY: 0.61,
  CO: 0.51,
  AL: 0.41,
  HI: 0.28,
};

const NATIONAL_AVG_TAX_RATE = 1.10; // fallback

// ── PMI rate table by credit range (annual % of loan amount) ────────────────
// Lower credit => higher PMI.  These are mid-range estimates; actual PMI also
// depends on LTV, but this provides a reasonable first approximation.
const PMI_RATES = {
  excellent: 0.30,  // 760+
  very_good: 0.45,  // 720-759
  good:      0.55,  // 680-719
  fair:      0.75,  // 640-679
  poor:      1.00,  // <640
};

const DEFAULT_PMI_RATE = 0.55; // used when creditRange is not supplied

/**
 * Calculate the monthly principal & interest payment using the standard
 * amortization formula:
 *
 *   M = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
 *
 * @param {number} principal  Loan amount (P)
 * @param {number} annualRate Annual interest rate as a percentage (e.g. 6.5)
 * @param {number} termYears  Loan term in years (15 or 30)
 * @returns {number}          Monthly P&I payment, rounded to 2 decimals
 */
function calculateMonthlyPI(principal, annualRate, termYears) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) {
    // 0% interest — just divide principal by total months
    return Math.round((principal / (termYears * 12)) * 100) / 100;
  }

  const r = annualRate / 100 / 12;       // monthly rate
  const n = termYears * 12;              // total payments
  const rPowN = Math.pow(1 + r, n);

  const payment = principal * (r * rPowN) / (rPowN - 1);
  return Math.round(payment * 100) / 100;
}

/**
 * Estimate the monthly PMI cost, or 0 if down-payment >= 20%.
 *
 * @param {number} loanAmount   The loan (homePrice minus downPayment)
 * @param {number} homePrice    Full price of the home
 * @param {string} [creditRange] "poor"|"fair"|"good"|"very_good"|"excellent"
 * @returns {number}            Monthly PMI estimate, rounded to 2 decimals
 */
function calculatePMI(loanAmount, homePrice, creditRange) {
  if (homePrice <= 0) return 0;
  const ltv = loanAmount / homePrice;
  if (ltv <= 0.80) return 0; // no PMI at 20%+ equity

  const annualRate = PMI_RATES[creditRange] || DEFAULT_PMI_RATE;
  const monthlyPMI = (loanAmount * (annualRate / 100)) / 12;
  return Math.round(monthlyPMI * 100) / 100;
}

/**
 * Return the annual property-tax rate (%) for a US state.
 *
 * @param {string} stateCode Two-letter state abbreviation (e.g. "NJ")
 * @returns {number}         Annual rate as a percentage
 */
function getStateTaxRate(stateCode) {
  if (!stateCode) return NATIONAL_AVG_TAX_RATE;
  const code = stateCode.trim().toUpperCase();
  return STATE_TAX_RATES[code] !== undefined
    ? STATE_TAX_RATES[code]
    : NATIONAL_AVG_TAX_RATE;
}

/**
 * Estimate annual homeowner's insurance as a percentage of home price,
 * then return the monthly amount.
 *
 * Heuristic: 0.35% of homePrice per year.
 *
 * @param {number} homePrice
 * @returns {number} Monthly insurance estimate, rounded to 2 decimals
 */
function estimateInsurance(homePrice) {
  if (homePrice <= 0) return 0;
  const annual = homePrice * 0.0035;
  return Math.round((annual / 12) * 100) / 100;
}

/**
 * Describe which PMI rule was applied, for the `assumptions` object.
 *
 * @param {number} loanAmount
 * @param {number} homePrice
 * @param {string} [creditRange]
 * @returns {string}
 */
function describePMIRule(loanAmount, homePrice, creditRange) {
  if (homePrice <= 0) return 'No PMI (invalid home price)';
  const ltv = loanAmount / homePrice;
  if (ltv <= 0.80) {
    return 'No PMI required (down payment >= 20%)';
  }
  const rate = PMI_RATES[creditRange] || DEFAULT_PMI_RATE;
  const label = creditRange || 'default (good)';
  return `PMI estimated at ${rate}% of loan/year (credit: ${label}, LTV: ${(ltv * 100).toFixed(1)}%)`;
}

module.exports = {
  calculateMonthlyPI,
  calculatePMI,
  getStateTaxRate,
  estimateInsurance,
  describePMIRule,
  STATE_TAX_RATES,
  NATIONAL_AVG_TAX_RATE,
};
