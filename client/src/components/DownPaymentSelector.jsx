import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import './CurrencySlider.css';

const PERCENT_PRESETS = [0, 3, 5, 10, 15, 20];

/**
 * DownPaymentSelector — Dual-mode (percent chips + dollar slider) down payment input.
 *
 * Props:
 *   value              — current dollar amount (number, controlled)
 *   onChange            — callback(number)
 *   estimatedHomePrice  — maxBudget or 0 if not yet calculated
 *   min, max           — dollar range for slider
 *   id                 — accessibility id
 */
export default function DownPaymentSelector({
  value = 0,
  onChange,
  estimatedHomePrice = 0,
  min = 0,
  max = 300000,
  id,
}) {
  const holdRef = useRef(null);

  const sliderMax = useMemo(() => {
    if (estimatedHomePrice > 0) return Math.min(max, estimatedHomePrice);
    return max;
  }, [max, estimatedHomePrice]);

  const step = value < 50000 ? 1000 : 5000;

  const clamp = useCallback(
    (v) => Math.max(min, Math.min(sliderMax, v)),
    [min, sliderMax]
  );

  const increment = useCallback(() => {
    onChange(clamp(value + step));
  }, [value, onChange, clamp, step]);

  const decrement = useCallback(() => {
    onChange(clamp(value - step));
  }, [value, onChange, clamp, step]);

  // Long-press repeat
  const startHold = useCallback((fn) => {
    fn();
    let delay = 400;
    const tick = () => {
      fn();
      delay = Math.max(60, delay * 0.85);
      holdRef.current = setTimeout(tick, delay);
    };
    holdRef.current = setTimeout(tick, delay);
  }, []);

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  // Percent calculation
  const pct = estimatedHomePrice > 0
    ? ((value / estimatedHomePrice) * 100).toFixed(1).replace(/\.0$/, '')
    : null;

  // Active percent chip
  const activePercent = useMemo(() => {
    if (!estimatedHomePrice) return null;
    const found = PERCENT_PRESETS.find(
      (p) => Math.abs(value - estimatedHomePrice * (p / 100)) < 100
    );
    return found !== undefined ? found : null;
  }, [value, estimatedHomePrice]);

  // Slider fill
  const fillPct = sliderMax > min ? ((value - min) / (sliderMax - min)) * 100 : 0;

  return (
    <div className="dps-container">
      <div className="cs-label-row">
        <label className="input-label" htmlFor={id}>
          Down Payment
        </label>
      </div>

      <div className="dps-display">
        ${value.toLocaleString()}
        {pct !== null && <span className="dps-pct">({pct}%)</span>}
      </div>

      {/* Percent chips — only show when we have an estimated home price */}
      {estimatedHomePrice > 0 ? (
        <div className="dps-percent-chips">
          {PERCENT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`cs-chip ${activePercent === p ? 'cs-chip-active' : ''}`}
              onClick={() => onChange(Math.round(estimatedHomePrice * (p / 100)))}
            >
              {p}%
            </button>
          ))}
        </div>
      ) : (
        <p className="dps-mode-label">Calculate your budget to see % options</p>
      )}

      <div className="cs-slider-row">
        <button
          type="button"
          className="cs-stepper"
          onPointerDown={() => startHold(decrement)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          aria-label="Decrease down payment"
          disabled={value <= min}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14" />
          </svg>
        </button>

        <input
          id={id}
          type="range"
          className="sw-slider cs-slider"
          min={min}
          max={sliderMax}
          step={step}
          value={Math.min(value, sliderMax)}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Down payment amount"
          style={{
            background: `linear-gradient(to right, var(--color-primary, #3b82f6) ${fillPct}%, var(--color-border-light, #e5e7eb) ${fillPct}%)`,
          }}
        />

        <button
          type="button"
          className="cs-stepper"
          onPointerDown={() => startHold(increment)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          aria-label="Increase down payment"
          disabled={value >= sliderMax}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
