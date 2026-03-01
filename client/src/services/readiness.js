/**
 * Financial Readiness Score Calculator
 * Deterministic scoring (0-100) based on user financial inputs.
 * No external API calls — pure math.
 */

// Map credit range strings to numeric scores
const CREDIT_MAP = {
  excellent: 780,
  good: 720,
  fair: 670,
  poor: 600,
};

// Map timeline strings to months
const TIMELINE_MAP = {
  asap: 1,
  '1-3months': 2,
  '3-6months': 5,
  flexible: 9,
};

/**
 * Calculate a financial readiness score (0-100)
 *
 * Accepts either numeric creditScore or string creditRange.
 * Accepts either numeric timelineMonths or string timeline.
 *
 * Returns: { score, color, level, breakdown, grade, dpPercent, dti, runwayMonths }
 */
export function calculateReadinessScore({
  annualIncome = 0,
  monthlyDebts = 0,
  downPayment = 0,
  homePrice = 0,
  targetPrice = 0,
  creditScore,
  creditRange,
  savingsBalance,
  timelineMonths,
  timeline,
}) {
  // Resolve homePrice — caller might pass targetPrice instead
  const hp = homePrice || targetPrice || 0;

  // Resolve credit score from range string if needed
  const credit = creditScore || CREDIT_MAP[creditRange] || 680;

  // Resolve timeline months from string if needed
  const tlMonths = timelineMonths || TIMELINE_MAP[timeline] || 6;

  // Default savingsBalance to downPayment * 2 if not provided (assumes some reserves)
  const savings = savingsBalance != null ? savingsBalance : downPayment * 2;

  const scores = {};

  // 1. Down payment % (25 pts) — 20%+ = full marks
  const dpPercent = hp > 0 ? (downPayment / hp) * 100 : 0;
  if (dpPercent >= 20) scores.downPayment = 25;
  else if (dpPercent >= 10) scores.downPayment = 18;
  else if (dpPercent >= 5) scores.downPayment = 12;
  else if (dpPercent >= 3) scores.downPayment = 7;
  else scores.downPayment = 2;

  // 2. DTI ratio (25 pts) — under 28% = excellent
  const monthlyIncome = annualIncome / 12;
  const dti = monthlyIncome > 0 ? monthlyDebts / monthlyIncome : 1;
  const dtiPercent = dti * 100;
  if (dtiPercent <= 20) scores.dti = 25;
  else if (dtiPercent <= 28) scores.dti = 20;
  else if (dtiPercent <= 36) scores.dti = 14;
  else if (dtiPercent <= 43) scores.dti = 8;
  else scores.dti = 3;

  // 3. Credit score (25 pts)
  if (credit >= 760) scores.credit = 25;
  else if (credit >= 720) scores.credit = 21;
  else if (credit >= 680) scores.credit = 16;
  else if (credit >= 640) scores.credit = 10;
  else if (credit >= 580) scores.credit = 5;
  else scores.credit = 2;

  // 4. Savings runway (15 pts) — 6+ months of expenses after down payment
  const remainingSavings = savings - downPayment;
  const monthlyExpenses = monthlyDebts > 0 ? monthlyDebts : monthlyIncome * 0.3;
  const runwayMonths = monthlyExpenses > 0 ? remainingSavings / monthlyExpenses : 0;
  if (runwayMonths >= 6) scores.savings = 15;
  else if (runwayMonths >= 3) scores.savings = 10;
  else if (runwayMonths >= 1) scores.savings = 5;
  else scores.savings = 1;

  // 5. Timeline (10 pts) — more time = better preparation
  if (tlMonths >= 12) scores.timeline = 10;
  else if (tlMonths >= 6) scores.timeline = 8;
  else if (tlMonths >= 3) scores.timeline = 5;
  else scores.timeline = 2;

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const score = Math.min(100, Math.max(0, total));

  return {
    score,
    total: score,
    breakdown: { ...scores, dti },
    grade: getGrade(score),
    level: getReadinessLabel(score),
    color: getReadinessColor(score),
    dpPercent: Math.round(dpPercent * 10) / 10,
    dti: Math.round(dti * 1000) / 1000,
    runwayMonths: Math.round(runwayMonths * 10) / 10,
  };
}

function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Generate human-readable readiness insights
 * Returns an array of { type: 'positive'|'warning'|'tip', text }
 */
export function generateReadinessInsights({
  score = 0,
  breakdown = {},
  annualIncome = 0,
  monthlyDebts = 0,
  downPayment = 0,
  homePrice = 0,
  targetPrice = 0,
  creditScore,
  creditRange,
  savingsBalance,
  timelineMonths,
  timeline,
}) {
  const hp = homePrice || targetPrice || 0;
  const credit = creditScore || CREDIT_MAP[creditRange] || 680;
  const insights = [];
  const monthlyIncome = annualIncome / 12;
  const dpPercent = hp > 0 ? (downPayment / hp) * 100 : 0;
  const dti = monthlyIncome > 0 ? (monthlyDebts / monthlyIncome) * 100 : 100;

  // Down payment insights
  if (dpPercent >= 20) {
    insights.push({
      type: 'positive',
      text: `Your ${Math.round(dpPercent)}% down payment eliminates PMI — saving you ~$${Math.round((hp - downPayment) * 0.005 / 12)}/mo.`,
    });
  } else if (dpPercent >= 10) {
    insights.push({
      type: 'tip',
      text: `At ${Math.round(dpPercent)}% down, you'll pay PMI (~$${Math.round((hp - downPayment) * 0.005 / 12)}/mo). Reaching 20% saves that cost.`,
    });
  } else if (dpPercent >= 3) {
    insights.push({
      type: 'warning',
      text: `Only ${Math.round(dpPercent)}% down means higher PMI and a larger loan. FHA loans accept 3.5% but consider saving more.`,
    });
  } else if (hp > 0) {
    insights.push({
      type: 'warning',
      text: 'Most lenders require at least 3% down. You may need to save more or look at down payment assistance programs.',
    });
  }

  // DTI insights
  if (dti <= 28) {
    insights.push({
      type: 'positive',
      text: `Your DTI of ${Math.round(dti)}% is excellent — lenders prefer under 36% and yours is well below.`,
    });
  } else if (dti <= 36) {
    insights.push({
      type: 'tip',
      text: `Your DTI is ${Math.round(dti)}% — acceptable for most lenders. Paying down debt could improve your rate.`,
    });
  } else if (dti <= 43) {
    insights.push({
      type: 'warning',
      text: `DTI of ${Math.round(dti)}% is near the maximum for qualified mortgages. Consider reducing debts first.`,
    });
  } else {
    insights.push({
      type: 'warning',
      text: `DTI of ${Math.round(dti)}% exceeds the 43% qualified mortgage limit. Focus on debt reduction before buying.`,
    });
  }

  // Credit insights
  if (credit >= 760) {
    insights.push({
      type: 'positive',
      text: 'Excellent credit — you\'ll likely qualify for the best available mortgage rates.',
    });
  } else if (credit >= 720) {
    insights.push({
      type: 'positive',
      text: 'Very good credit score. You should qualify for competitive mortgage rates.',
    });
  } else if (credit >= 680) {
    insights.push({
      type: 'tip',
      text: 'Good credit, but boosting it above 720 could save thousands over your loan term.',
    });
  } else if (credit >= 620) {
    insights.push({
      type: 'warning',
      text: `Credit score of ${credit} may limit your options. Focus on on-time payments and reducing credit utilization.`,
    });
  } else {
    insights.push({
      type: 'warning',
      text: `A credit score of ${credit} is below most conventional loan minimums (620). Consider credit repair before applying.`,
    });
  }

  // Score-based overall insight
  if (score >= 80) {
    insights.push({
      type: 'positive',
      text: 'You\'re in excellent shape to buy. Consider getting pre-approved to lock in your rate.',
    });
  } else if (score >= 60) {
    insights.push({
      type: 'tip',
      text: 'You\'re in a good position. A few improvements could strengthen your buying power.',
    });
  } else if (score >= 40) {
    insights.push({
      type: 'tip',
      text: 'There\'s room to improve your readiness. Focus on the areas highlighted above.',
    });
  }

  return insights;
}

/**
 * Get a color for the readiness gauge based on score
 */
export function getReadinessColor(score) {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#84cc16'; // lime
  if (score >= 40) return '#eab308'; // yellow
  if (score >= 20) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Get a label for the readiness score
 */
export function getReadinessLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 25) return 'Needs Work';
  return 'Not Ready';
}
