import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API_BASE from '../utils/apiBase';
import './MoveInWizard.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const AFFORD_EXAMPLES = [
  "I make $95k/year, have $800/mo in student loans, saved $40k for down payment, credit score around 720",
  "Household income $150k, $30k saved, no debts, excellent credit",
  "I earn $65k, paying $1500 rent, $200/mo car payment, saved $15k, credit is fair",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Main Component ──────────────────────────────────────────────────────────

function Financing() {
  // ── Finance state ──
  const [affordText, setAffordText] = useState('');
  const [affordLoading, setAffordLoading] = useState(false);
  const [affordResult, setAffordResult] = useState(null);

  // Payment calculator state
  const [calcPrice, setCalcPrice] = useState('350000');
  const [calcDown, setCalcDown] = useState('20');
  const [calcRate, setCalcRate] = useState('6.75');
  const [calcTerm, setCalcTerm] = useState('30');
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Handlers ──

  const handleAffordSubmit = useCallback(async () => {
    if (!affordText.trim()) return;
    setAffordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/finance/affordability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeText: affordText }),
      });
      const data = await res.json();
      setAffordResult(data);
    } catch (err) {
      console.error('Affordability error:', err);
    } finally {
      setAffordLoading(false);
    }
  }, [affordText]);

  const handleCalcSubmit = useCallback(async () => {
    setCalcLoading(true);
    try {
      const downVal = Number(calcDown);
      const res = await fetch(`${API_BASE}/api/finance/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homePrice: Number(calcPrice),
          downPayment: { type: downVal <= 100 ? 'percent' : 'amount', value: downVal },
          interestRate: Number(calcRate),
          termYears: Number(calcTerm),
        }),
      });
      const data = await res.json();
      setCalcResult(data);
    } catch (err) {
      console.error('Calc error:', err);
    } finally {
      setCalcLoading(false);
    }
  }, [calcPrice, calcDown, calcRate, calcTerm]);

  // ── Render ──

  return (
    <div className="wizard-page">
      <div className="wizard-content">
        <div className="step-header">
          <h2>Financing & Budget</h2>
          <p>Tell us about your financial situation and we'll recommend what you can afford</p>
        </div>

        <div className="finance-section">
          {/* Affordability (left) */}
          <div className="finance-card">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              AI Affordability Check
            </h3>
            <p className="card-desc">Describe your financial situation in plain English</p>

            <textarea
              className="afford-textarea"
              value={affordText}
              onChange={(e) => setAffordText(e.target.value)}
              placeholder="Example: I make $90k/year, have $600/mo in student loans, saved $35k for a down payment, credit score is about 740..."
            />

            <div className="afford-examples">
              {AFFORD_EXAMPLES.map((ex, i) => (
                <button key={i} className="afford-example" onClick={() => setAffordText(ex)}>
                  {ex.slice(0, 50)}...
                </button>
              ))}
            </div>

            <button
              className="afford-submit"
              onClick={handleAffordSubmit}
              disabled={affordLoading || !affordText.trim()}
            >
              {affordLoading ? (
                <><span className="btn-loading-sm" /> Analyzing...</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg> Analyze My Budget</>
              )}
            </button>

            {affordResult && (
              <div className="afford-result">
                {/* Profile */}
                <div className="afford-profile">
                  <div className="profile-item">
                    <span className="pi-label">Annual Income</span>
                    <span className={`pi-value ${!affordResult.profile?.incomeAnnual ? 'missing' : ''}`}>
                      {affordResult.profile?.incomeAnnual ? fmt(affordResult.profile.incomeAnnual) : 'Not provided'}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="pi-label">Monthly Debts</span>
                    <span className={`pi-value ${!affordResult.profile?.debtsMonthly ? 'missing' : ''}`}>
                      {affordResult.profile?.debtsMonthly ? fmt(affordResult.profile.debtsMonthly) + '/mo' : 'Not provided'}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="pi-label">Down Payment Saved</span>
                    <span className={`pi-value ${!affordResult.profile?.downPaymentCash ? 'missing' : ''}`}>
                      {affordResult.profile?.downPaymentCash ? fmt(affordResult.profile.downPaymentCash) : 'Not provided'}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="pi-label">Credit Score</span>
                    <span className={`pi-value ${!affordResult.profile?.creditScoreApprox ? 'missing' : ''}`}>
                      {affordResult.profile?.creditScoreApprox || 'Not provided'}
                    </span>
                  </div>
                </div>

                {/* Confidence */}
                {affordResult.confidence != null && (
                  <div className="confidence-bar">
                    <span className="confidence-label">Confidence: {Math.round(affordResult.confidence * 100)}%</span>
                    <div className="confidence-track">
                      <div
                        className={`confidence-fill ${affordResult.confidence >= 0.7 ? 'high' : affordResult.confidence >= 0.4 ? 'medium' : 'low'}`}
                        style={{ width: `${affordResult.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {affordResult.recommendation && (
                  <div className="afford-recommendation">
                    <div className="rec-header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                      Our Recommendation
                    </div>
                    <div className="rec-stats">
                      <div className="rec-stat">
                        <div className="rs-value">{fmt(affordResult.recommendation.recommendedMaxHomePrice)}</div>
                        <div className="rs-label">Max Home Price</div>
                      </div>
                      <div className="rec-stat">
                        <div className="rs-value">{fmt(affordResult.recommendation.recommendedMonthlyPaymentMax)}</div>
                        <div className="rs-label">Max Monthly Payment</div>
                      </div>
                    </div>
                    <div className={`rec-risk ${affordResult.recommendation.riskLevel || 'medium'}`}>
                      Risk Level: {(affordResult.recommendation.riskLevel || 'medium').toUpperCase()}
                    </div>
                    {affordResult.recommendation.nextSteps && (
                      <ul className="rec-nextsteps">
                        {affordResult.recommendation.nextSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Clarifying questions */}
                {affordResult.clarifyingQuestions?.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                    <strong>To improve accuracy, tell us:</strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      {affordResult.clarifyingQuestions.map((q, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Calculator (right) */}
          <div className="finance-card">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M10 3v18"/></svg>
              Payment Calculator
            </h3>
            <p className="card-desc">Estimate monthly payments for any home price</p>

            <div className="calc-grid">
              <div className="calc-field">
                <label>Home Price</label>
                <input type="number" value={calcPrice} onChange={e => setCalcPrice(e.target.value)} placeholder="350000" />
              </div>
              <div className="calc-field">
                <label>Down Payment %</label>
                <input type="number" value={calcDown} onChange={e => setCalcDown(e.target.value)} placeholder="20" />
              </div>
              <div className="calc-field">
                <label>Interest Rate %</label>
                <input type="number" value={calcRate} onChange={e => setCalcRate(e.target.value)} step="0.25" placeholder="6.75" />
              </div>
              <div className="calc-field">
                <label>Term (Years)</label>
                <select value={calcTerm} onChange={e => setCalcTerm(e.target.value)}>
                  <option value="30">30 years</option>
                  <option value="15">15 years</option>
                </select>
              </div>
            </div>

            <button className="calc-btn" onClick={handleCalcSubmit} disabled={calcLoading}>
              {calcLoading ? 'Calculating...' : 'Calculate Payment'}
            </button>

            {calcResult?.monthly && (
              <div className="calc-result">
                <div className="calc-total">
                  <div className="ct-amount">{fmt(calcResult.monthly.total)}</div>
                  <div className="ct-label">estimated monthly payment</div>
                </div>
                <div className="calc-breakdown">
                  <div className="calc-breakdown-item">
                    <span className="cb-label">Principal & Interest</span>
                    <span className="cb-value">{fmt(calcResult.monthly.principalInterest)}</span>
                  </div>
                  <div className="calc-breakdown-item">
                    <span className="cb-label">Property Tax</span>
                    <span className="cb-value">{fmt(calcResult.monthly.propertyTax)}</span>
                  </div>
                  <div className="calc-breakdown-item">
                    <span className="cb-label">Insurance</span>
                    <span className="cb-value">{fmt(calcResult.monthly.insurance)}</span>
                  </div>
                  <div className="calc-breakdown-item">
                    <span className="cb-label">PMI</span>
                    <span className="cb-value">{fmt(calcResult.monthly.pmi)}</span>
                  </div>
                  {calcResult.monthly.hoa > 0 && (
                    <div className="calc-breakdown-item">
                      <span className="cb-label">HOA</span>
                      <span className="cb-value">{fmt(calcResult.monthly.hoa)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="finance-card full-width">
            <div className="disclaimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span><strong>Disclaimer:</strong> These are estimates only, not financial advice. Actual rates, taxes, and insurance will vary. Consult a licensed mortgage professional for personalized guidance.</span>
            </div>
          </div>
        </div>

        {/* CTA to search */}
        {affordResult?.recommendation?.recommendedMaxHomePrice > 0 && (
          <div className="step-nav">
            <div />
            <Link to="/" className="btn-step primary" style={{ textDecoration: 'none' }}>
              Search Homes in My Budget
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default Financing;
