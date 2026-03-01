import React from 'react';
import './IntentChips.css';

const CHIP_ICONS = {
  location: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  budget: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  beds: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  ),
  baths: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z" />
      <path d="M6 12V5a2 2 0 0 1 2-2h3v2.25" />
    </svg>
  ),
  type: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  feature: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  musthave: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  ),
  default: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
};

function getChipIcon(label) {
  const lower = (label || '').toLowerCase();
  if (lower.includes('location') || lower.includes('city') || lower.includes('zip')) return CHIP_ICONS.location;
  if (lower.includes('budget') || lower.includes('price') || lower.includes('$')) return CHIP_ICONS.budget;
  if (lower.includes('bed')) return CHIP_ICONS.beds;
  if (lower.includes('bath')) return CHIP_ICONS.baths;
  if (lower.includes('type') || lower.includes('house') || lower.includes('condo')) return CHIP_ICONS.type;
  if (lower.includes('feature') || lower.includes('pool') || lower.includes('garage') || lower.includes('gym')) return CHIP_ICONS.feature;
  if (lower.includes('must')) return CHIP_ICONS.musthave;
  return CHIP_ICONS.default;
}

function getChipColorClass(label) {
  const lower = (label || '').toLowerCase();
  if (lower.includes('location') || lower.includes('city') || lower.includes('zip')) return 'chip-location';
  if (lower.includes('budget') || lower.includes('price') || lower.includes('$')) return 'chip-budget';
  if (lower.includes('bed')) return 'chip-beds';
  if (lower.includes('bath')) return 'chip-baths';
  if (lower.includes('type') || lower.includes('house') || lower.includes('condo')) return 'chip-type';
  if (lower.includes('feature') || lower.includes('pool') || lower.includes('garage') || lower.includes('gym')) return 'chip-feature';
  if (lower.includes('must')) return 'chip-musthave';
  return 'chip-default';
}

function IntentChips({ chips, onRemove }) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="intent-chips">
      {chips.map((chip, index) => (
        <span
          key={`${chip.label}-${index}`}
          className={`intent-chip ${getChipColorClass(chip.label)}`}
        >
          <span className="intent-chip-icon">{getChipIcon(chip.label)}</span>
          <span className="intent-chip-label">{chip.label}</span>
          {chip.value && <span className="intent-chip-value">{chip.value}</span>}
          {onRemove && (
            <button
              type="button"
              className="intent-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              aria-label={`Remove ${chip.label}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export default IntentChips;
