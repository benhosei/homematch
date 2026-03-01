import React, { useState, useCallback, useMemo } from 'react';
import { calculateMaxBudget, getFullMonthlyBreakdown } from '../services/affordability';
import { calculateReadinessScore, generateReadinessInsights } from '../services/readiness';
import CurrencySlider from './CurrencySlider';
import DownPaymentSelector from './DownPaymentSelector';
import './BudgetWizard.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const CREDIT_RANGES = [
  { value: 'excellent', label: 'Excellent', sub: '750+', icon: '🌟' },
  { value: 'good',      label: 'Good',      sub: '700-749', icon: '👍' },
  { value: 'fair',      label: 'Fair',       sub: '650-699', icon: '📊' },
  { value: 'poor',      label: 'Needs Work', sub: '<650',    icon: '🔧' },
];

const TIMELINE_OPTIONS = [
  { value: 'asap',       label: 'ASAP',       sub: 'Ready now',   icon: '⚡' },
  { value: '1-3months',  label: '1-3 Mo',     sub: 'Very soon',   icon: '📅' },
  { value: '3-6months',  label: '3-6 Mo',     sub: 'Planning',    icon: '🗓️' },
  { value: 'flexible',   label: 'Flexible',   sub: 'No rush',     icon: '🌊' },
];

const GAUGE_RADIUS = 55;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function fmt(n) {
  if (n == null || isNaN(n)) return '--';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BudgetWizard({
  income, setIncome,
  monthlyDebts, setMonthlyDebts,
  downPayment, setDownPayment,
  interestRate, setInterestRate,
  creditRange, setCreditRange,
  timeline, setTimeline,
  maxBudget, setMaxBudget,
  monthlyBreakdown, setMonthlyBreakdown,
  readinessScore, setReadinessScore,
  readinessInsights, setReadinessInsights,
  budgetCalculated, setBudgetCalculated,
  onToast,
}) {
  const [screen, setScreen] = useState(budgetCalculated ? 2 : 0);
  const [animPhase, setAnimPhase] = useState('idle');
  const [direction, setDirection] = useState('forward');

  // ── Navigation ──
  const goTo = useCallback((nextScreen, dir) => {
    if (animPhase !== 'idle') return;
    setDirection(dir || (nextScreen > screen ? 'forward' : 'back'));
    setAnimPhase('exiting');
    setTimeout(() => {
      setScreen(nextScreen);
      setAnimPhase('entering');
      setTimeout(() => { setAnimPhase('idle'); }, 350);
    }, 200);
  }, [screen, animPhase]);

  const goNext = useCallback(() => goTo(screen + 1, 'forward'), [goTo, screen]);
  const goPrev = useCallback(() => goTo(screen - 1, 'back'), [goTo, screen]);

  // ── Validation ──
  const canProceedFromInputs = useMemo(() => {
    return (parseFloat(income) || 0) > 0;
  }, [income]);

  // ── Calculate Budget ──
  const handleCalculate = useCallback(() => {
    const inc = parseFloat(income) || 0;
    const debts = parseFloat(monthlyDebts) || 0;
    const dp = parseFloat(downPayment) || 0;
    const rate = parseFloat(interestRate) || 6.5;

    if (inc <= 0) {
      onToast?.('warning', 'Set your annual income using the slider');
      return;
    }

    const max = calculateMaxBudget(inc, debts, dp, rate);
    setMaxBudget(max);

    const breakdown = getFullMonthlyBreakdown(max, dp > 0 ? (dp / max * 100) : 10, rate);
    setMonthlyBreakdown(breakdown);

    const score = calculateReadinessScore({
      annualIncome: inc,
      monthlyDebts: debts,
      downPayment: dp,
      targetPrice: max,
      creditRange,
      timeline,
    });
    setReadinessScore(score);

    const insights = generateReadinessInsights({
      score: score.score,
      breakdown: score.breakdown,
      annualIncome: inc,
      monthlyDebts: debts,
      downPayment: dp,
      creditRange,
    });
    setReadinessInsights(insights);

    setBudgetCalculated(true);
    goTo(2, 'forward');
    onToast?.('success', 'Budget analysis complete!');
  }, [income, monthlyDebts, downPayment, interestRate, creditRange, timeline, goTo, onToast,
      setMaxBudget, setMonthlyBreakdown, setReadinessScore, setReadinessInsights, setBudgetCalculated]);

  // ── Recalculate (from results screen) ──
  const handleRecalculate = useCallback(() => {
    goTo(0, 'back');
  }, [goTo]);

  // ── Progress ──
  const progress = screen === 0 ? 33 : screen === 1 ? 66 : 100;

  // ── Wrapper animation class ──
  const wrapClass = animPhase === 'exiting'
    ? `bw-exit-${direction === 'forward' ? 'left' : 'right'}`
    : animPhase === 'entering'
    ? 'bw-enter'
    : '';

  return (
    <div className="bw-container">
      {/* Progress bar */}
      <div className="bw-progress">
        <div className="bw-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Step indicators */}
      <div className="bw-steps">
        {['Financials', 'Profile', 'Results'].map((label, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            className={`bw-step-dot ${screen === i ? 'bw-step-active' : ''} ${i < screen ? 'bw-step-done' : ''}`}
            onClick={() => {
              if (i < screen) goTo(i, 'back');
            }}
          >
            {i < screen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span className="bw-step-num">{i + 1}</span>
            )}
            <span className="bw-step-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Screen content */}
      <div className={`bw-screen-wrap ${wrapClass}`}>

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 0: Financials (Income, Debts, Down Payment)
            ═══════════════════════════════════════════════════════════ */}
        {screen === 0 && (
          <div className="bw-screen">
            <div className="bw-question-header">
              <span className="bw-step-tag">STEP 1 OF 3</span>
              <h3 className="bw-question">Tell us about your finances</h3>
              <p className="bw-question-sub">This helps us calculate what you can comfortably afford</p>
            </div>

            <div className="bw-field-group">
              <CurrencySlider
                label="Annual Income"
                value={income}
                onChange={setIncome}
                min={20000}
                max={1000000}
                step={1000}
                stepBreakpoint={200000}
                stepLarge={5000}
                presets={[50000, 75000, 100000, 150000, 200000, 300000]}
                presetLabels={['$50k', '$75k', '$100k', '$150k', '$200k', '$300k']}
                formatValue={fmt}
                id="bw-income"
              />
            </div>

            <div className="bw-field-group">
              <CurrencySlider
                label="Monthly Debts"
                value={monthlyDebts}
                onChange={setMonthlyDebts}
                min={0}
                max={10000}
                step={50}
                presets={[0, 250, 500, 1000, 2000, 3000]}
                presetLabels={['$0', '$250', '$500', '$1k', '$2k', '$3k']}
                formatValue={fmt}
                tooltip="Include car payments, student loans, credit cards, etc."
                id="bw-debts"
              />
            </div>

            <div className="bw-field-group">
              <DownPaymentSelector
                value={downPayment}
                onChange={setDownPayment}
                estimatedHomePrice={maxBudget || 0}
                min={0}
                max={300000}
                id="bw-dp"
              />
            </div>

            <div className="bw-field-group">
              <label className="input-label" htmlFor="bw-rate">
                Interest Rate: {interestRate}%
              </label>
              <input
                id="bw-rate"
                type="range"
                className="sw-slider"
                min="3"
                max="9"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                aria-label="Mortgage interest rate"
                style={{
                  background: `linear-gradient(to right, var(--color-primary, #3b82f6) ${((interestRate - 3) / 6) * 100}%, var(--color-border-light, #e5e7eb) ${((interestRate - 3) / 6) * 100}%)`,
                }}
              />
              <div className="sw-slider-labels">
                <span>3%</span>
                <span>{interestRate}%</span>
                <span>9%</span>
              </div>
            </div>

            {/* Nav */}
            <div className="bw-nav">
              <div />
              <button
                type="button"
                className="bw-btn bw-btn-primary"
                onClick={goNext}
                disabled={!canProceedFromInputs}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 1: Profile (Credit Range, Timeline)
            ═══════════════════════════════════════════════════════════ */}
        {screen === 1 && (
          <div className="bw-screen">
            <div className="bw-question-header">
              <span className="bw-step-tag">STEP 2 OF 3</span>
              <h3 className="bw-question">Your buyer profile</h3>
              <p className="bw-question-sub">These factors affect your rate and readiness score</p>
            </div>

            {/* Credit Range Cards */}
            <div className="bw-section">
              <span className="bw-section-label">Credit Score Range</span>
              <div className="bw-card-grid bw-card-grid-4">
                {CREDIT_RANGES.map((opt) => {
                  const active = creditRange === opt.value;
                  return (
                    <div
                      key={opt.value}
                      role="button"
                      tabIndex={0}
                      onClick={() => setCreditRange(opt.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreditRange(opt.value); } }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        padding: '18px 10px',
                        border: active ? '2px solid var(--color-primary, #3b82f6)' : '1.5px solid var(--color-border, #d1d5db)',
                        borderRadius: 12,
                        background: active ? 'rgba(59, 130, 246, 0.06)' : 'var(--color-card, #fff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{opt.icon}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text, #1e293b)', textAlign: 'center' }}>{opt.label}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary, #94a3b8)' }}>{opt.sub}</span>
                      {active && (
                        <span style={{ position: 'absolute', top: 6, right: 6, color: 'var(--color-primary, #3b82f6)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Cards */}
            <div className="bw-section">
              <span className="bw-section-label">When do you want to buy?</span>
              <div className="bw-card-grid bw-card-grid-4">
                {TIMELINE_OPTIONS.map((opt) => {
                  const active = timeline === opt.value;
                  return (
                    <div
                      key={opt.value}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTimeline(opt.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTimeline(opt.value); } }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        padding: '18px 10px',
                        border: active ? '2px solid var(--color-primary, #3b82f6)' : '1.5px solid var(--color-border, #d1d5db)',
                        borderRadius: 12,
                        background: active ? 'rgba(59, 130, 246, 0.06)' : 'var(--color-card, #fff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{opt.icon}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text, #1e293b)', textAlign: 'center' }}>{opt.label}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary, #94a3b8)' }}>{opt.sub}</span>
                      {active && (
                        <span style={{ position: 'absolute', top: 6, right: 6, color: 'var(--color-primary, #3b82f6)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary of inputs */}
            <div className="bw-input-summary">
              <span className="bw-summary-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
              <span className="bw-summary-text">
                Income {fmt(income)} · Debts {fmt(monthlyDebts)}/mo · Down {fmt(downPayment)} · Rate {interestRate}%
              </span>
            </div>

            {/* Nav */}
            <div className="bw-nav">
              <button type="button" className="bw-btn bw-btn-ghost" onClick={goPrev}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-large"
                onClick={handleCalculate}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Calculate My Budget
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SCREEN 2: Results
            ═══════════════════════════════════════════════════════════ */}
        {screen === 2 && budgetCalculated && readinessScore && (
          <div className="bw-screen bw-results-screen">
            <div className="bw-question-header" style={{ textAlign: 'center', alignItems: 'center' }}>
              <span className="bw-step-tag">YOUR RESULTS</span>
              <h3 className="bw-question">Here's what you can afford</h3>
            </div>

            {/* Hero: Max Budget */}
            <div className="bw-hero-card">
              <div className="bw-hero-label">Maximum Home Price</div>
              <div className="bw-hero-value">{fmt(maxBudget)}</div>
              {monthlyBreakdown && (
                <div className="bw-hero-monthly">
                  Est. {fmt(monthlyBreakdown.total || monthlyBreakdown.monthlyPayment)}/month
                </div>
              )}
            </div>

            {/* Two-column: Gauge + Breakdown */}
            <div className="bw-results-grid">
              {/* Readiness Gauge */}
              <div className="bw-result-card">
                <div className="bw-gauge-wrap">
                  <svg width="120" height="120" viewBox="0 0 140 140" className="bw-gauge-svg">
                    <circle cx="70" cy="70" r={GAUGE_RADIUS} fill="none" stroke="var(--color-border-light, #e5e7eb)" strokeWidth="10" />
                    <circle
                      cx="70" cy="70" r={GAUGE_RADIUS} fill="none"
                      stroke={readinessScore.color || 'var(--color-primary)'}
                      strokeWidth="10"
                      strokeDasharray={GAUGE_CIRCUMFERENCE}
                      strokeDashoffset={GAUGE_CIRCUMFERENCE - (readinessScore.score / 100) * GAUGE_CIRCUMFERENCE}
                      strokeLinecap="round"
                      transform="rotate(-90 70 70)"
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                    <text x="70" y="66" textAnchor="middle" style={{ fontSize: '28px', fontWeight: 800, fill: readinessScore.color || 'var(--color-primary)' }}>
                      {readinessScore.score}
                    </text>
                    <text x="70" y="86" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 600, fill: 'var(--color-text-secondary)' }}>
                      {readinessScore.level || 'Score'}
                    </text>
                  </svg>
                </div>
                <div className="bw-gauge-title">Readiness Score</div>
                <p className="bw-gauge-desc">
                  {readinessScore.score >= 80 ? "You're in a strong position to buy!"
                   : readinessScore.score >= 60 ? 'Good foundation — small improvements help.'
                   : readinessScore.score >= 40 ? 'Getting there — reduce debt or save more.'
                   : 'Focus on savings and debt reduction first.'}
                </p>
              </div>

              {/* Monthly Breakdown */}
              {monthlyBreakdown && (
                <div className="bw-result-card">
                  <div className="bw-breakdown-title">Monthly Breakdown</div>
                  <div className="bw-breakdown-rows">
                    {monthlyBreakdown.principalInterest != null && (
                      <div className="bw-bd-row">
                        <span className="bw-bd-dot" style={{ background: '#3b82f6' }} />
                        <span className="bw-bd-label">Principal & Interest</span>
                        <span className="bw-bd-val">{fmt(monthlyBreakdown.principalInterest)}</span>
                      </div>
                    )}
                    {monthlyBreakdown.propertyTax != null && (
                      <div className="bw-bd-row">
                        <span className="bw-bd-dot" style={{ background: '#8b5cf6' }} />
                        <span className="bw-bd-label">Property Tax</span>
                        <span className="bw-bd-val">{fmt(monthlyBreakdown.propertyTax)}</span>
                      </div>
                    )}
                    {monthlyBreakdown.insurance != null && (
                      <div className="bw-bd-row">
                        <span className="bw-bd-dot" style={{ background: '#06b6d4' }} />
                        <span className="bw-bd-label">Insurance</span>
                        <span className="bw-bd-val">{fmt(monthlyBreakdown.insurance)}</span>
                      </div>
                    )}
                    {monthlyBreakdown.pmi != null && monthlyBreakdown.pmi > 0 && (
                      <div className="bw-bd-row">
                        <span className="bw-bd-dot" style={{ background: '#f59e0b' }} />
                        <span className="bw-bd-label">PMI</span>
                        <span className="bw-bd-val">{fmt(monthlyBreakdown.pmi)}</span>
                      </div>
                    )}
                  </div>
                  {readinessScore?.breakdown?.dti != null && (
                    <div className="bw-dti-bar">
                      <span>DTI Ratio</span>
                      <span className="bw-dti-val">
                        {typeof readinessScore.breakdown.dti === 'number'
                          ? `${(readinessScore.breakdown.dti * 100).toFixed(1)}%`
                          : `${readinessScore.breakdown.dti}%`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Insights */}
            {readinessInsights.length > 0 && (
              <div className="bw-insights-card">
                <div className="bw-insights-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  AI Insights
                </div>
                <div className="bw-insights-list">
                  {readinessInsights.map((insight, i) => (
                    <div key={i} className="bw-insight-row">
                      <span className="bw-insight-icon">
                        {insight.type === 'positive' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                        ) : insight.type === 'warning' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                        )}
                      </span>
                      <span className="bw-insight-text">{insight.text || insight.message || insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="bw-disclaimer">AI scores are educational estimates, not professional advice.</p>

            {/* Nav */}
            <div className="bw-nav bw-nav-final">
              <button type="button" className="bw-btn bw-btn-ghost" onClick={handleRecalculate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Adjust Inputs
              </button>
              {/* The "Continue" action is handled by parent's goNext */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
