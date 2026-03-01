import React, { useRef, useCallback, useEffect } from 'react';
import './CurrencySlider.css';

/**
 * CurrencySlider — No-type currency input with slider, preset chips, and +/- steppers.
 *
 * Props:
 *   label        — field label
 *   value        — current number value (controlled)
 *   onChange      — callback(number)
 *   min, max     — slider range
 *   step         — base step size
 *   stepBreakpoint — above this, use stepLarge
 *   stepLarge    — larger step for high values
 *   presets      — array of preset numbers [30000, 50000, ...]
 *   presetLabels — display labels ['$30k', '$50k', ...]
 *   formatValue  — function to format display value
 *   tooltip      — optional info text
 *   id           — accessibility id
 */
export default function CurrencySlider({
  label,
  value = 0,
  onChange,
  min = 0,
  max = 1000000,
  step = 1000,
  stepBreakpoint,
  stepLarge,
  presets = [],
  presetLabels = [],
  formatValue,
  tooltip,
  id,
}) {
  const holdRef = useRef(null);

  const getStep = useCallback(
    (v) => {
      if (stepBreakpoint && stepLarge && v >= stepBreakpoint) return stepLarge;
      return step;
    },
    [step, stepBreakpoint, stepLarge]
  );

  const clamp = useCallback((v) => Math.max(min, Math.min(max, v)), [min, max]);

  const increment = useCallback(() => {
    onChange(clamp(value + getStep(value)));
  }, [value, onChange, clamp, getStep]);

  const decrement = useCallback(() => {
    onChange(clamp(value - getStep(value)));
  }, [value, onChange, clamp, getStep]);

  // Long-press repeat
  const startHold = useCallback(
    (fn) => {
      fn();
      let delay = 400;
      const tick = () => {
        fn();
        delay = Math.max(60, delay * 0.85);
        holdRef.current = setTimeout(tick, delay);
      };
      holdRef.current = setTimeout(tick, delay);
    },
    []
  );

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  const display = formatValue ? formatValue(value) : `$${value.toLocaleString()}`;

  // Compute slider position percent for gradient fill
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className="cs-container">
      <div className="cs-label-row">
        <label className="input-label" htmlFor={id}>
          {label}
          {tooltip && (
            <span className="sw-tooltip-trigger" data-tooltip={tooltip} aria-label="Info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
          )}
        </label>
      </div>

      <div className="cs-display">{display}</div>

      <div className="cs-slider-row">
        <button
          type="button"
          className="cs-stepper"
          onPointerDown={() => startHold(decrement)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          aria-label={`Decrease ${label}`}
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
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          style={{
            background: `linear-gradient(to right, var(--color-primary, #3b82f6) ${pct}%, var(--color-border-light, #e5e7eb) ${pct}%)`,
          }}
        />

        <button
          type="button"
          className="cs-stepper"
          onPointerDown={() => startHold(increment)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          aria-label={`Increase ${label}`}
          disabled={value >= max}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {presets.length > 0 && (
        <div className="cs-chips">
          {presets.map((preset, i) => (
            <button
              key={preset}
              type="button"
              className={`cs-chip ${value === preset ? 'cs-chip-active' : ''}`}
              onClick={() => onChange(preset)}
            >
              {presetLabels[i] || `$${preset.toLocaleString()}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
