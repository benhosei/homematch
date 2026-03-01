import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ListingCard from './ListingCard';
import API_BASE from '../utils/apiBase';
import './MoveInWizard.css';

function formatLotSize(lotSqft) {
  if (!lotSqft || lotSqft <= 0) return null;
  const acres = lotSqft / 43560;
  if (acres >= 10) return `${Math.round(acres)} acres`;
  if (acres >= 1) return `${acres.toFixed(1).replace(/\.0$/, '')} acres`;
  return `${acres.toFixed(2).replace(/0$/, '')} acres`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AFFORD_EXAMPLES = [
  "I make $95k/year, have $800/mo in student loans, saved $40k for down payment, credit score around 720",
  "Household income $150k, $30k saved, no debts, excellent credit",
  "I earn $65k, paying $1500 rent, $200/mo car payment, saved $15k, credit is fair",
];

const STEPS = [
  { id: 'finance', label: 'Financing', sublabel: 'Know your budget', icon: '$' },
  { id: 'homes', label: 'Dream Home', sublabel: 'Find your match', icon: '🏠' },
  { id: 'movers', label: 'Movers', sublabel: 'Plan your move', icon: '📦' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Main Component ──────────────────────────────────────────────────────────

function MoveInWizard() {
  const [currentStep, setCurrentStep] = useState(0); // 0=finance, 1=homes, 2=movers
  const [skippedFinance, setSkippedFinance] = useState(false);

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

  // ── Homes state ──
  const [homesSearchParams, setHomesSearchParams] = useState(null);
  const [homesResults, setHomesResults] = useState([]);
  const [homesLoading, setHomesLoading] = useState(false);
  const [selectedHome, setSelectedHome] = useState(null);
  const [homesQuery, setHomesQuery] = useState('');
  const [homesLocation, setHomesLocation] = useState('');

  // ── Movers state ──
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [stairs, setStairs] = useState('none');
  const [specialItems, setSpecialItems] = useState('');
  const [moveEstimate, setMoveEstimate] = useState(null);
  const [moveEstLoading, setMoveEstLoading] = useState(false);
  const [movePlan, setMovePlan] = useState(null);
  const [movePlanLoading, setMovePlanLoading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Pre-fill homes budget from affordability
  useEffect(() => {
    if (affordResult?.recommendation?.recommendedMaxHomePrice) {
      setCalcPrice(String(Math.round(affordResult.recommendation.recommendedMaxHomePrice)));
    }
  }, [affordResult]);

  // Auto-fill destination from selected home
  useEffect(() => {
    if (selectedHome?.address) {
      // Destination is auto-filled when movers step loads
    }
  }, [selectedHome]);

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

  const handleHomesSearch = useCallback(async () => {
    if (!homesLocation.trim() || !homesQuery.trim()) return;
    setHomesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assistant/parse-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${homesQuery} in ${homesLocation}` }),
      });
      const parsed = await res.json();
      if (parsed.searchParams) {
        // Apply budget ceiling from financing
        if (affordResult?.recommendation?.recommendedMaxHomePrice && !parsed.searchParams.priceMax) {
          parsed.searchParams.priceMax = String(Math.round(affordResult.recommendation.recommendedMaxHomePrice));
        }
        const searchRes = await fetch(`${API_BASE}/api/listings/search?city=${encodeURIComponent(parsed.searchParams.city || homesLocation.split(',')[0]?.trim())}&state_code=${encodeURIComponent(parsed.searchParams.stateCode || homesLocation.split(',')[1]?.trim() || '')}&price_max=${parsed.searchParams.priceMax || ''}&price_min=${parsed.searchParams.priceMin || ''}&beds=${parsed.searchParams.beds || ''}&baths=${parsed.searchParams.baths || ''}&prop_type=${parsed.searchParams.propType || ''}`);
        const searchData = await searchRes.json();
        setHomesResults(searchData.results || []);
      }
    } catch (err) {
      console.error('Homes search error:', err);
    } finally {
      setHomesLoading(false);
    }
  }, [homesQuery, homesLocation, affordResult]);

  const handleSelectHome = useCallback((listing) => {
    setSelectedHome(listing);
  }, []);

  const handleMoveEstimate = useCallback(async () => {
    if (!originCity.trim()) return;
    setMoveEstLoading(true);
    try {
      const dest = selectedHome?.address || {};
      const res = await fetch(`${API_BASE}/api/move/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { city: originCity, state: originState, zip: originZip },
          destination: { city: dest.city || '', state: dest.state || '', zip: dest.postal_code || '' },
          homeSize: { bedrooms: selectedHome?.beds || 3, sqft: selectedHome?.sqft || 1500 },
          stairs,
          date: moveDate || undefined,
        }),
      });
      const data = await res.json();
      setMoveEstimate(data);
    } catch (err) {
      console.error('Move estimate error:', err);
    } finally {
      setMoveEstLoading(false);
    }
  }, [originCity, originState, originZip, selectedHome, stairs, moveDate]);

  const handleMovePlan = useCallback(async () => {
    setMovePlanLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/move/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveDate: moveDate || undefined,
          householdSize: (selectedHome?.beds || 3) >= 4 ? 'large' : (selectedHome?.beds || 3) >= 2 ? 'medium' : 'small',
          pets: false,
          specialItems: specialItems ? specialItems.split(',').map(s => s.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      setMovePlan(data);
    } catch (err) {
      console.error('Move plan error:', err);
    } finally {
      setMovePlanLoading(false);
    }
  }, [moveDate, selectedHome, specialItems]);

  const handleContactSubmit = useCallback(async () => {
    if (!contactName.trim() || !contactEmail.trim()) return;
    setContactLoading(true);
    try {
      const dest = selectedHome?.address || {};
      await fetch(`${API_BASE}/api/move/find-movers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { city: originCity, state: originState, zip: originZip },
          destination: { city: dest.city || '', state: dest.state || '', zip: dest.postal_code || '' },
          date: moveDate,
          contact: { name: contactName, email: contactEmail, phone: contactPhone },
          notes: contactNotes,
        }),
      });
      setContactSubmitted(true);
    } catch (err) {
      console.error('Contact submit error:', err);
    } finally {
      setContactLoading(false);
    }
  }, [contactName, contactEmail, contactPhone, contactNotes, originCity, originState, originZip, selectedHome, moveDate]);

  const goNext = () => setCurrentStep(prev => Math.min(prev + 1, 2));
  const goPrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const canGoToHomes = currentStep >= 1 || affordResult || skippedFinance;
  const canGoToMovers = currentStep >= 2 || selectedHome;

  // ── Render ──

  return (
    <div className="wizard-page">
      {/* Stepper */}
      <div className="wizard-stepper">
        <div className="stepper-inner">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div className={`stepper-connector ${i <= currentStep ? 'done' : ''}`} />
              )}
              <button
                className={`stepper-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''} ${i > currentStep && !(i === 1 && canGoToHomes) && !(i === 2 && canGoToMovers) ? 'locked' : 'pending'}`}
                onClick={() => {
                  if (i <= currentStep) setCurrentStep(i);
                  else if (i === 1 && canGoToHomes) setCurrentStep(i);
                  else if (i === 2 && canGoToMovers) setCurrentStep(i);
                }}
              >
                <div className="step-number">
                  {i < currentStep ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="step-info">
                  <span className="step-label">{step.label}</span>
                  <span className="step-sublabel">{step.sublabel}</span>
                </div>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content" key={currentStep}>
        {/* ═══ STEP 1: FINANCING ═══ */}
        {currentStep === 0 && (
          <>
            <div className="step-header">
              <h2>Know Your Budget</h2>
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

            {/* Nav */}
            <div className="step-nav">
              <button className="btn-skip" onClick={() => { setSkippedFinance(true); goNext(); }}>
                Skip this step →
              </button>
              <button
                className="btn-step primary"
                onClick={goNext}
                disabled={!affordResult && !skippedFinance}
              >
                Continue to Home Search
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>

            {skippedFinance && !affordResult && (
              <div className="skip-warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                You skipped financing. Results won't have a budget ceiling — you can always come back!
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 2: HOMES ═══ */}
        {currentStep === 1 && (
          <>
            <div className="step-header">
              <h2>Find Your Dream Home</h2>
              <p>Search for homes that match your criteria{affordResult ? ' within your budget' : ''}</p>
            </div>

            {affordResult?.recommendation?.recommendedMaxHomePrice && (
              <div className="homes-budget-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                Budget cap from financing: {fmt(affordResult.recommendation.recommendedMaxHomePrice)}
              </div>
            )}

            <div className="finance-card full-width" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={homesLocation}
                  onChange={e => setHomesLocation(e.target.value)}
                  placeholder="City, State (e.g. Austin, TX)"
                  style={{ flex: '0 0 240px', padding: '10px 14px', border: '1.5px solid var(--color-border-light)', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.88rem' }}
                />
                <input
                  type="text"
                  value={homesQuery}
                  onChange={e => setHomesQuery(e.target.value)}
                  placeholder="Describe your dream home... (e.g. 3 bed house with pool under 400k)"
                  style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--color-border-light)', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.88rem' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleHomesSearch(); }}
                />
                <button
                  className="btn-step primary"
                  onClick={handleHomesSearch}
                  disabled={homesLoading || !homesLocation.trim() || !homesQuery.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {homesLoading ? <><span className="btn-loading-sm" /> Searching...</> : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Search</>
                  )}
                </button>
              </div>
            </div>

            {/* Selected home card */}
            {selectedHome && (
              <div className="homes-selected-card">
                {selectedHome.thumbnail && <img src={selectedHome.thumbnail} alt="" />}
                <div className="hsc-info">
                  <div className="hsc-price">{fmt(selectedHome.price)}</div>
                  <div className="hsc-address">{selectedHome.address?.full || 'Address unavailable'}</div>
                  <div className="hsc-details">{selectedHome.beds} bd | {selectedHome.baths} ba{selectedHome.sqft > 0 ? ` | ${selectedHome.sqft.toLocaleString()} sqft` : ''}{formatLotSize(selectedHome.lot_sqft) ? ` | ${formatLotSize(selectedHome.lot_sqft)}` : ''}</div>
                </div>
                <button className="hsc-change" onClick={() => setSelectedHome(null)}>Change</button>
              </div>
            )}

            {/* Results grid */}
            {homesLoading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>
                <span className="btn-loading-sm" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)', width: 24, height: 24, display: 'inline-block' }} />
                <p style={{ marginTop: 12 }}>Searching homes...</p>
              </div>
            )}

            {!homesLoading && homesResults.length > 0 && !selectedHome && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginTop: 20 }}>
                {homesResults.map(listing => (
                  <div key={listing.property_id}>
                    <ListingCard
                      listing={listing}
                      onFavorite={() => {}}
                      onUnfavorite={() => {}}
                      isFavorited={false}
                      onCardClick={() => {}}
                    />
                    <button className="homes-select-btn" onClick={() => handleSelectHome(listing)}>
                      Select This Home →
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!homesLoading && homesResults.length === 0 && homesQuery && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>
                <p>No results yet. Try searching above!</p>
              </div>
            )}

            <div className="step-nav">
              <button className="btn-step secondary" onClick={goPrev}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Financing
              </button>
              <button className="btn-step primary" onClick={goNext} disabled={!selectedHome}>
                Continue to Movers
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </>
        )}

        {/* ═══ STEP 3: MOVERS ═══ */}
        {currentStep === 2 && (
          <>
            <div className="step-header">
              <h2>Plan Your Move</h2>
              <p>Get a cost estimate, moving checklist, and connect with local movers</p>
            </div>

            {selectedHome && (
              <div className="homes-selected-card" style={{ marginBottom: 24 }}>
                {selectedHome.thumbnail && <img src={selectedHome.thumbnail} alt="" />}
                <div className="hsc-info">
                  <div className="hsc-price">Moving to: {fmt(selectedHome.price)} home</div>
                  <div className="hsc-address">{selectedHome.address?.full}</div>
                </div>
              </div>
            )}

            <div className="movers-section">
              {/* Moving estimate */}
              <div className="movers-card">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Moving Cost Estimate
                </h3>
                <p className="card-desc">Where are you moving from?</p>

                <div className="mover-form-grid">
                  <div className="mover-field">
                    <label>Origin City</label>
                    <input value={originCity} onChange={e => setOriginCity(e.target.value)} placeholder="Current city" />
                  </div>
                  <div className="mover-field">
                    <label>Origin State</label>
                    <input value={originState} onChange={e => setOriginState(e.target.value)} placeholder="State code (e.g. CA)" maxLength={2} />
                  </div>
                  <div className="mover-field">
                    <label>Origin Zip</label>
                    <input value={originZip} onChange={e => setOriginZip(e.target.value)} placeholder="Zip code" maxLength={5} />
                  </div>
                  <div className="mover-field">
                    <label>Move Date</label>
                    <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} />
                  </div>
                  <div className="mover-field">
                    <label>Stairs</label>
                    <select value={stairs} onChange={e => setStairs(e.target.value)}>
                      <option value="none">No stairs</option>
                      <option value="some">Some stairs (1-2 flights)</option>
                      <option value="many">Many stairs (3+)</option>
                    </select>
                  </div>
                  <div className="mover-field">
                    <label>Special Items</label>
                    <input value={specialItems} onChange={e => setSpecialItems(e.target.value)} placeholder="Piano, hot tub, etc." />
                  </div>
                </div>

                <button className="calc-btn" onClick={handleMoveEstimate} disabled={moveEstLoading || !originCity.trim()} style={{ marginTop: 16 }}>
                  {moveEstLoading ? 'Estimating...' : 'Get Estimate'}
                </button>

                {moveEstimate && (
                  <div className="move-estimate-result">
                    <div className="estimate-cost">
                      <div className="ec-range">
                        {fmt(moveEstimate.estimatedCostRange?.low)} — {fmt(moveEstimate.estimatedCostRange?.high)}
                      </div>
                      <div className="ec-label">Estimated moving cost</div>
                      {moveEstimate.recommendedMoveType && (
                        <div className="estimate-type-badge">
                          Recommended: {moveEstimate.recommendedMoveType.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                    {moveEstimate.assumptions?.length > 0 && (
                      <ul className="estimate-assumptions">
                        {moveEstimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Moving plan / checklist */}
              <div className="movers-card">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Moving Checklist
                </h3>
                <p className="card-desc">Get a personalized moving timeline</p>

                <button className="calc-btn" onClick={handleMovePlan} disabled={movePlanLoading}>
                  {movePlanLoading ? 'Generating...' : 'Generate My Plan'}
                </button>

                {movePlan && (
                  <div className="move-timeline">
                    {(movePlan.timeline || []).map((item, i) => (
                      <div key={i} className="timeline-item">
                        <div className="timeline-when">{item.when}</div>
                        <ul className="timeline-tasks">
                          {(item.tasks || []).map((task, j) => (
                            <li key={j}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {movePlan.specialItemNotes?.length > 0 && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#92400e' }}>Special Item Notes:</strong>
                        <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                          {movePlan.specialItemNotes.map((n, i) => (
                            <li key={i} style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: 4 }}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Find Movers / Contact */}
              <div className="movers-card full-width">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Request Mover Quotes
                </h3>
                <p className="card-desc">We'll connect you with local moving companies</p>

                {!contactSubmitted ? (
                  <div className="contact-form">
                    <div className="mover-form-grid">
                      <div className="mover-field">
                        <label>Your Name *</label>
                        <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="mover-field">
                        <label>Email *</label>
                        <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" />
                      </div>
                      <div className="mover-field">
                        <label>Phone</label>
                        <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 123-4567" />
                      </div>
                      <div className="mover-field">
                        <label>Notes</label>
                        <input value={contactNotes} onChange={e => setContactNotes(e.target.value)} placeholder="Anything else movers should know?" />
                      </div>
                    </div>
                    <button
                      className="contact-submit"
                      onClick={handleContactSubmit}
                      disabled={contactLoading || !contactName.trim() || !contactEmail.trim()}
                    >
                      {contactLoading ? (
                        <><span className="btn-loading-sm" /> Submitting...</>
                      ) : (
                        'Request Quotes'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="contact-success">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                    <h4>Request Submitted!</h4>
                    <p>Local movers will contact you within 24-48 hours with quotes.</p>
                  </div>
                )}

                <div className="disclaimer" style={{ marginTop: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>Quotes are estimates; movers will provide final pricing after an in-home or virtual survey.</span>
                </div>
              </div>
            </div>

            <div className="step-nav">
              <button className="btn-step secondary" onClick={goPrev}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Homes
              </button>
              <Link to="/" className="btn-step primary" style={{ textDecoration: 'none' }}>
                Done — Back to Home
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MoveInWizard;
