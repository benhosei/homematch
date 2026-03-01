/**
 * Calculate monthly mortgage payment
 */
export function calculateMonthlyPayment(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Calculate DTI ratio
 */
export function calculateDTI(monthlyDebts, monthlyIncome) {
  if (!monthlyIncome || monthlyIncome <= 0) return 0;
  return monthlyDebts / monthlyIncome;
}

/**
 * Calculate maximum affordable home price using 28% front-end DTI rule
 */
export function calculateMaxBudget(annualIncome, monthlyDebts, downPayment, annualRate, termYears = 30) {
  const monthlyIncome = annualIncome / 12;
  const maxMonthlyHousing = monthlyIncome * 0.28;
  const maxPI = maxMonthlyHousing * 0.78;

  const r = annualRate / 100 / 12;
  const n = termYears * 12;

  let maxLoan;
  if (r === 0) {
    maxLoan = maxPI * n;
  } else {
    maxLoan = maxPI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  }

  return Math.round(maxLoan + downPayment);
}

/**
 * Estimate property tax monthly
 */
export function estimatePropertyTax(homePrice, rate = 0.0115) {
  return (homePrice * rate) / 12;
}

/**
 * Estimate homeowner's insurance monthly
 */
export function estimateInsurance(homePrice) {
  return (homePrice * 0.0035) / 12;
}

/**
 * Estimate PMI monthly (if down payment < 20%)
 */
export function estimatePMI(loanAmount, downPaymentPercent) {
  if (downPaymentPercent >= 20) return 0;
  return (loanAmount * 0.005) / 12;
}

/**
 * Full monthly payment breakdown
 */
export function getFullMonthlyBreakdown(homePrice, downPaymentPercent, annualRate, termYears = 30) {
  const downPayment = homePrice * (downPaymentPercent / 100);
  const loanAmount = homePrice - downPayment;

  const principalInterest = calculateMonthlyPayment(loanAmount, annualRate, termYears);
  const propertyTax = estimatePropertyTax(homePrice);
  const insurance = estimateInsurance(homePrice);
  const pmi = estimatePMI(loanAmount, downPaymentPercent);

  return {
    principalInterest: Math.round(principalInterest),
    propertyTax: Math.round(propertyTax),
    insurance: Math.round(insurance),
    pmi: Math.round(pmi),
    total: Math.round(principalInterest + propertyTax + insurance + pmi),
    loanAmount: Math.round(loanAmount),
    downPayment: Math.round(downPayment),
  };
}
