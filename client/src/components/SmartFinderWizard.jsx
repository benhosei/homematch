import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Home, Building2, Construction, Warehouse,
  Car, Layout, ArrowDownToLine, Maximize,
  Waves, Sparkles, Briefcase, Fence,
  Trees, MapPin, Star, AlertCircle, Check,
  ChefHat, Bath, Dumbbell, Wifi, Ruler,
  CookingPot, WashingMachine, MoveVertical,
  Anchor, TreePine, Sun, Hammer,
  Building, Layers, Mountain, Eye,
  Truck, Calendar, DollarSign, SlidersHorizontal,
} from 'lucide-react';
import CityMultiSelect from './CityMultiSelect';
import { US_STATES } from '../utils/stateCenters';
import './SmartFinderWizard.css';

/**
 * SmartFinderWizard — Concierge-level guided home finder with:
 * - Expanded categorized priorities (Interior/Exterior/Architecture)
 * - Triple-state toggle (null → nice → must)
 * - Deep Search filters (sqft, lot, garage, year, HOA)
 * - Mutual exclusion for story count
 * - Auto-advance on single-select steps
 * - Lucide React icons throughout
 */

// ── Property Types ──
const PROPERTY_TYPES = [
  { id: 'house',            label: 'House',            Icon: Home },
  { id: 'townhome',         label: 'Townhome',         Icon: Building2 },
  { id: 'condo',            label: 'Condo',            Icon: Warehouse },
  { id: 'new_construction', label: 'New Construction', Icon: Construction },
];

// ── Beds / Baths ──
const BEDS_OPTIONS = [
  { value: '1', label: '1+' }, { value: '2', label: '2+' },
  { value: '3', label: '3+' }, { value: '4', label: '4+' },
  { value: '5', label: '5+' }, { value: '6', label: '6+' },
];
const BATHS_OPTIONS = [
  { value: '1', label: '1+' }, { value: '2', label: '2+' },
  { value: '3', label: '3+' }, { value: '4', label: '4+' },
  { value: '5', label: '5+' }, { value: '6', label: '6+' },
];

// ── Feature Categories (expanded) ──
const FEATURE_CATEGORIES = [
  {
    label: 'Interior & Luxury',
    features: [
      { id: 'office',          label: 'Home Office',         Icon: Briefcase },
      { id: 'gym',             label: 'Gym / Flex Space',    Icon: Dumbbell },
      { id: 'chef_kitchen',    label: 'Gourmet Kitchen',     Icon: ChefHat },
      { id: 'main_primary',    label: 'Primary on Main',     Icon: Home },
      { id: 'pantry',          label: 'Walk-in Pantry',      Icon: CookingPot },
      { id: 'laundry',         label: 'Laundry Room',        Icon: WashingMachine },
      { id: 'smart_home',      label: 'Smart Home Tech',     Icon: Wifi },
      { id: 'high_ceilings',   label: 'High Ceilings (10ft+)', Icon: MoveVertical },
    ],
  },
  {
    label: 'Exterior & Property',
    features: [
      { id: 'pool',            label: 'In-Ground Pool',      Icon: Waves },
      { id: 'fenced',          label: 'Fenced-in Yard',      Icon: Fence },
      { id: 'porch',           label: 'Screened Porch',      Icon: Sun },
      { id: 'outdoor_kitchen', label: 'Outdoor Kitchen',     Icon: ChefHat },
      { id: 'rv_parking',      label: 'RV / Boat Parking',   Icon: Truck },
      { id: 'waterfront',      label: 'Waterfront / View',   Icon: Anchor },
      { id: 'wooded_lot',      label: 'Wooded / Private',    Icon: TreePine },
    ],
  },
  {
    label: 'Architecture & Layout',
    features: [
      { id: 'single_story',    label: 'Single Story',        Icon: Home,          group: 'stories' },
      { id: 'two_story',       label: 'Two Story',           Icon: Building,      group: 'stories' },
      { id: 'three_story',     label: 'Three+ Stories',      Icon: Layers,        group: 'stories' },
      { id: 'fin_basement',    label: 'Finished Basement',   Icon: ArrowDownToLine },
      { id: 'walkout_basement', label: 'Walk-out Basement',  Icon: Mountain },
      { id: 'modern',          label: 'Modern Style',        Icon: Layout,        group: 'style' },
      { id: 'craftsman',       label: 'Craftsman / Traditional', Icon: Hammer,    group: 'style' },
    ],
  },
];

const ALL_FEATURES = FEATURE_CATEGORIES.flatMap((c) => c.features);

// ── Deep Search Options ──
const LOT_OPTIONS = [
  { value: '', label: 'Any' }, { value: '10890', label: '0.25 ac' },
  { value: '21780', label: '0.5 ac' }, { value: '43560', label: '1 ac' },
  { value: '87120', label: '2 ac' }, { value: '217800', label: '5 ac' },
  { value: '435600', label: '10+ ac' },
];
const GARAGE_OPTIONS = [
  { value: '', label: 'Any' }, { value: '1', label: '1+' },
  { value: '2', label: '2+' }, { value: '3', label: '3+' },
  { value: '4', label: '4+' },
];
const YEAR_OPTIONS = [
  { value: '', label: 'Any' }, { value: '2024', label: '2024+' },
  { value: '2020', label: '2020+' }, { value: '2010', label: '2010+' },
  { value: '2000', label: '2000+' }, { value: '1990', label: '1990+' },
];
const SQFT_PRESETS = [1000, 1500, 2000, 2500, 3000, 4000, 5000];

// 7 screens: welcome, location, propType, bedsBaths, priorities, deepSearch, review
const SCREEN_COUNT = 7;

export default function SmartFinderWizard({
  maxBudget,
  onSearch,
  searchLoading = false,
  fmtPrice,
}) {
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [animPhase, setAnimPhase] = useState('idle');

  // Selections
  const [sfState, setSfState] = useState('');
  const [sfCities, setSfCities] = useState([]);
  const [sfPropType, setSfPropType] = useState('');
  const [sfBeds, setSfBeds] = useState('');
  const [sfBaths, setSfBaths] = useState('');
  const [sfPriorities, setSfPriorities] = useState({}); // { id: 'nice' | 'must' }
  // Deep search
  const [minSqft, setMinSqft] = useState(0);
  const [minLot, setMinLot] = useState('');
  const [minGarage, setMinGarage] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [noHoa, setNoHoa] = useState(false);

  const containerRef = useRef(null);

  const fmt = fmtPrice || ((n) => {
    if (n == null || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  });

  // ── Navigation ──
  const goTo = useCallback((nextScreen, dir) => {
    if (animPhase !== 'idle') return;
    setDirection(dir || (nextScreen > screen ? 'forward' : 'back'));
    setAnimPhase('exiting');
    setTimeout(() => {
      setScreen(nextScreen);
      setAnimPhase('entering');
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      setTimeout(() => { setAnimPhase('idle'); }, 350);
    }, 200);
  }, [screen, animPhase]);

  const goNext = useCallback(() => {
    if (screen < SCREEN_COUNT - 1) goTo(screen + 1, 'forward');
  }, [screen, goTo]);

  const goBack = useCallback(() => {
    if (screen > 0) goTo(screen - 1, 'back');
  }, [screen, goTo]);

  const autoAdvance = useCallback((key, value) => {
    if (key === 'propType') setSfPropType(value);
    setTimeout(() => { goTo(screen + 1, 'forward'); }, 350);
  }, [screen, goTo]);

  useEffect(() => { setSfCities([]); }, [sfState]);

  // ── Mutual Exclusion Groups ──
  const getExcludedIds = useCallback((groupName, selectedId) => {
    if (!groupName) return [];
    return ALL_FEATURES
      .filter((f) => f.group === groupName && f.id !== selectedId)
      .map((f) => f.id);
  }, []);

  const isDisabled = useMemo(() => {
    const disabled = new Set();
    Object.entries(sfPriorities).forEach(([id, level]) => {
      if (level === 'must') {
        const feat = ALL_FEATURES.find((f) => f.id === id);
        if (feat?.group) {
          getExcludedIds(feat.group, id).forEach((eid) => disabled.add(eid));
        }
      }
    });
    return disabled;
  }, [sfPriorities, getExcludedIds]);

  // ── Priority toggle: null → nice → must → null ──
  const togglePriority = useCallback((id) => {
    if (isDisabled.has(id)) return;
    setSfPriorities((prev) => {
      const current = prev[id];
      const next = { ...prev };
      if (!current) next[id] = 'nice';
      else if (current === 'nice') next[id] = 'must';
      else delete next[id];
      return next;
    });
  }, [isDisabled]);

  const sfFeatures = Object.keys(sfPriorities);

  // ── Fire search ──
  const handleFindMatches = useCallback(() => {
    if (!sfState || sfCities.length === 0) return;
    onSearch({
      state: sfState,
      cities: sfCities,
      propType: sfPropType,
      beds: sfBeds,
      baths: sfBaths,
      features: sfFeatures,
      priorities: sfPriorities,
      minSqft: minSqft > 0 ? minSqft : undefined,
      minLot: minLot || undefined,
      minGarage: minGarage || undefined,
      yearBuilt: yearBuilt || undefined,
      noHoa,
    });
  }, [sfState, sfCities, sfPropType, sfBeds, sfBaths, sfFeatures, sfPriorities,
      minSqft, minLot, minGarage, yearBuilt, noHoa, onSearch]);

  const canProceedFromLocation = sfState && sfCities.length > 0;
  const progressPercent = Math.round((screen / (SCREEN_COUNT - 1)) * 100);
  const niceCount = Object.values(sfPriorities).filter((v) => v === 'nice').length;
  const mustCount = Object.values(sfPriorities).filter((v) => v === 'must').length;

  // sqft slider percent
  const sqftPct = minSqft > 0 ? Math.min(100, ((minSqft - 500) / 7000) * 100) : 0;

  // ── Render ──
  return (
    <div className="sfw-container" ref={containerRef}>
      {screen > 0 && (
        <div className="sfw-progress">
          <div className="sfw-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      <div className={`sfw-screen-wrap ${animPhase === 'exiting' ? `sfw-exit-${direction}` : animPhase === 'entering' ? 'sfw-enter' : ''}`}>

        {/* ═══════════ Screen 0: Welcome ═══════════ */}
        {screen === 0 && (
          <div className="sfw-screen sfw-welcome">
            <div className="sfw-welcome-icon">
              <Sparkles size={40} strokeWidth={1.5} />
            </div>
            <h3 className="sfw-welcome-title">Let's find your dream home</h3>
            {maxBudget && (
              <p className="sfw-welcome-budget">
                Budget up to <strong>{fmt(maxBudget)}</strong>
              </p>
            )}
            <p className="sfw-welcome-sub">6 quick steps — concierge-level search</p>
            <button type="button" className="sfw-btn sfw-btn-primary sfw-btn-large" onClick={goNext}>
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ═══════════ Screen 1: Location ═══════════ */}
        {screen === 1 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 1 OF 6</span>
              <h3 className="sfw-question">Where do you want to live?</h3>
            </div>
            <div className="sfw-field-group">
              <label className="sfw-label" htmlFor="sfw-state">State</label>
              <select id="sfw-state" className="sfw-select" value={sfState}
                onChange={(e) => setSfState(e.target.value)}>
                <option value="">Select a state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            {sfState && (
              <div className="sfw-field-group">
                <CityMultiSelect stateCode={sfState} selectedCities={sfCities}
                  onChange={setSfCities} maxCities={5} />
              </div>
            )}
            <div className="sfw-nav">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary" onClick={goNext} disabled={!canProceedFromLocation}>
                Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Screen 2: Property Type (auto-advances) ═══════════ */}
        {screen === 2 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 2 OF 6</span>
              <h3 className="sfw-question">What type of property?</h3>
              <p className="sfw-question-sub">Tap to select — auto-advances</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {PROPERTY_TYPES.map((pt) => {
                const active = sfPropType === pt.id;
                const IC = pt.Icon;
                return (
                  <div key={pt.id} role="button" tabIndex={0}
                    onClick={() => active ? setSfPropType('') : autoAdvance('propType', pt.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); active ? setSfPropType('') : autoAdvance('propType', pt.id); }}}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '22px 12px', borderRadius: 12, cursor: 'pointer',
                      border: active ? '2px solid var(--color-primary, #3b82f6)' : '1.5px solid var(--color-border, #d1d5db)',
                      background: active ? 'rgba(59,130,246,0.06)' : 'var(--color-card, #fff)',
                      boxShadow: active ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
                      transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                    }}>
                    <IC size={28} strokeWidth={1.8} style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-secondary, #64748b)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', textAlign: 'center' }}>{pt.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="sfw-nav">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary" onClick={goNext}>
                {sfPropType ? 'Next' : 'Skip — All Types'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Screen 3: Beds & Baths ═══════════ */}
        {screen === 3 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 3 OF 6</span>
              <h3 className="sfw-question">Bedrooms and bathrooms?</h3>
            </div>
            <div className="sfw-bb-section">
              <span className="sfw-label">Bedrooms</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BEDS_OPTIONS.map((opt) => {
                  const active = sfBeds === opt.value;
                  return (
                    <div key={opt.value} role="button" tabIndex={0}
                      onClick={() => setSfBeds(active ? '' : opt.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSfBeds(active ? '' : opt.value); }}}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 52, padding: '10px 18px', borderRadius: 100, cursor: 'pointer',
                        border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border, #d1d5db)',
                        background: active ? 'var(--color-primary, #3b82f6)' : 'var(--color-card, #fff)',
                        color: active ? '#fff' : 'var(--color-text, #374151)',
                        fontSize: '0.88rem', fontWeight: 600,
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                      }}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="sfw-bb-section">
              <span className="sfw-label">Bathrooms</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BATHS_OPTIONS.map((opt) => {
                  const active = sfBaths === opt.value;
                  return (
                    <div key={opt.value} role="button" tabIndex={0}
                      onClick={() => setSfBaths(active ? '' : opt.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSfBaths(active ? '' : opt.value); }}}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 52, padding: '10px 18px', borderRadius: 100, cursor: 'pointer',
                        border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border, #d1d5db)',
                        background: active ? 'var(--color-primary, #3b82f6)' : 'var(--color-card, #fff)',
                        color: active ? '#fff' : 'var(--color-text, #374151)',
                        fontSize: '0.88rem', fontWeight: 600,
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                      }}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="sfw-nav">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary" onClick={goNext}>
                {sfBeds || sfBaths ? 'Next' : 'Skip'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Screen 4: Priorities (expanded) ═══════════ */}
        {screen === 4 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 4 OF 6</span>
              <h3 className="sfw-question">Select your priorities</h3>
              <p className="sfw-question-sub">Tap once = Nice to Have · Tap twice = Must Have</p>
            </div>

            <div className="sfw-priority-legend">
              <span className="sfw-legend-item"><Star size={12} style={{ color: '#eab308' }} /> Nice to Have</span>
              <span className="sfw-legend-item"><AlertCircle size={12} style={{ color: '#22c55e' }} /> Must Have</span>
            </div>

            {FEATURE_CATEGORIES.map((cat) => (
              <div key={cat.label} className="sfw-feature-category">
                <span className="sfw-category-label">{cat.label}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {cat.features.map((f) => {
                    const status = sfPriorities[f.id];
                    const disabled = isDisabled.has(f.id);
                    const IC = f.Icon;
                    return (
                      <div key={f.id} role="button" tabIndex={disabled ? -1 : 0}
                        onClick={() => togglePriority(f.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePriority(f.id); }}}
                        style={{
                          position: 'relative',
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '14px 12px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.35 : 1,
                          border: status === 'must' ? '2px solid #22c55e'
                               : status === 'nice' ? '2px solid #eab308'
                               : '1.5px solid var(--color-border, #d1d5db)',
                          background: status === 'must' ? 'rgba(34,197,94,0.06)'
                                    : status === 'nice' ? 'rgba(234,179,8,0.06)'
                                    : 'var(--color-card, #fff)',
                          transition: 'all 0.15s ease',
                          WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                        }}>
                        {status === 'must' && <AlertCircle size={14} style={{ position: 'absolute', top: 5, right: 5, color: '#22c55e' }} />}
                        {status === 'nice' && <Star size={14} style={{ position: 'absolute', top: 5, right: 5, color: '#eab308' }} />}
                        <IC size={18} strokeWidth={1.8} style={{ color: status ? 'var(--color-text)' : 'var(--color-text-secondary, #94a3b8)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: disabled ? 'var(--color-text-light)' : 'var(--color-text)' }}>{f.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="sfw-nav">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary" onClick={goNext}>
                {sfFeatures.length > 0 ? 'Next' : 'Skip'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Screen 5: Deep Search (Specs) ═══════════ */}
        {screen === 5 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 5 OF 6</span>
              <h3 className="sfw-question">Physical specifications</h3>
              <p className="sfw-question-sub">Set minimum requirements or skip for any</p>
            </div>

            {/* Sqft Slider */}
            <div className="sfw-deep-field">
              <div className="sfw-deep-label-row">
                <Ruler size={16} strokeWidth={1.8} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="sfw-deep-label">Min Living Area</span>
                <span className="sfw-deep-value">{minSqft > 0 ? `${minSqft.toLocaleString()} sq ft` : 'Any'}</span>
              </div>
              <input
                type="range"
                className="sw-slider sfw-deep-slider"
                min="500" max="7500" step="100"
                value={minSqft || 500}
                onChange={(e) => setMinSqft(Number(e.target.value))}
                style={{ background: `linear-gradient(to right, var(--color-primary) ${sqftPct}%, var(--color-border-light, #e5e7eb) ${sqftPct}%)` }}
              />
              <div className="sfw-deep-presets">
                <div role="button" tabIndex={0}
                  onClick={() => setMinSqft(0)}
                  style={{
                    padding: '6px 12px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: minSqft === 0 ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                    background: minSqft === 0 ? 'var(--color-primary)' : 'var(--color-card)',
                    color: minSqft === 0 ? '#fff' : 'var(--color-text-secondary)',
                    WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                  }}>
                  Any
                </div>
                {SQFT_PRESETS.map((v) => (
                  <div key={v} role="button" tabIndex={0}
                    onClick={() => setMinSqft(v)}
                    style={{
                      padding: '6px 12px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      border: minSqft === v ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      background: minSqft === v ? 'var(--color-primary)' : 'var(--color-card)',
                      color: minSqft === v ? '#fff' : 'var(--color-text-secondary)',
                      WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                    }}>
                    {v >= 1000 ? `${(v/1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                  </div>
                ))}
              </div>
            </div>

            {/* Lot Size */}
            <div className="sfw-deep-field">
              <div className="sfw-deep-label-row">
                <Maximize size={16} strokeWidth={1.8} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="sfw-deep-label">Min Lot Size</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LOT_OPTIONS.map((opt) => {
                  const active = minLot === opt.value;
                  return (
                    <div key={opt.value} role="button" tabIndex={0}
                      onClick={() => setMinLot(active ? '' : opt.value)}
                      style={{
                        padding: '8px 14px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                        background: active ? 'var(--color-primary)' : 'var(--color-card)',
                        color: active ? '#fff' : 'var(--color-text-secondary)',
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                      }}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Garage */}
            <div className="sfw-deep-field">
              <div className="sfw-deep-label-row">
                <Car size={16} strokeWidth={1.8} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="sfw-deep-label">Min Garage</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GARAGE_OPTIONS.map((opt) => {
                  const active = minGarage === opt.value;
                  return (
                    <div key={opt.value} role="button" tabIndex={0}
                      onClick={() => setMinGarage(active ? '' : opt.value)}
                      style={{
                        padding: '8px 14px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                        background: active ? 'var(--color-primary)' : 'var(--color-card)',
                        color: active ? '#fff' : 'var(--color-text-secondary)',
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                      }}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Year Built */}
            <div className="sfw-deep-field">
              <div className="sfw-deep-label-row">
                <Calendar size={16} strokeWidth={1.8} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="sfw-deep-label">Built After</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {YEAR_OPTIONS.map((opt) => {
                  const active = yearBuilt === opt.value;
                  return (
                    <div key={opt.value} role="button" tabIndex={0}
                      onClick={() => setYearBuilt(active ? '' : opt.value)}
                      style={{
                        padding: '8px 14px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                        background: active ? 'var(--color-primary)' : 'var(--color-card)',
                        color: active ? '#fff' : 'var(--color-text-secondary)',
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                      }}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* No HOA Toggle */}
            <div className="sfw-deep-field">
              <div role="button" tabIndex={0}
                onClick={() => setNoHoa(!noHoa)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 14px', borderRadius: 10, cursor: 'pointer',
                  border: noHoa ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                  background: noHoa ? 'rgba(59,130,246,0.06)' : 'var(--color-card)',
                  WebkitTapHighlightColor: 'transparent', userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}>
                <DollarSign size={18} strokeWidth={1.8} style={{ color: noHoa ? 'var(--color-primary)' : 'var(--color-text-secondary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>No HOA Fees Only</span>
                {noHoa && <Check size={16} style={{ color: 'var(--color-primary)' }} />}
              </div>
            </div>

            <div className="sfw-nav">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary" onClick={goNext}>
                Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Screen 6: Review ═══════════ */}
        {screen === 6 && (
          <div className="sfw-screen">
            <div className="sfw-question-header">
              <span className="sfw-step-label">STEP 6 OF 6</span>
              <h3 className="sfw-question">Review your search</h3>
            </div>

            <div className="sfw-review-card">
              <div className="sfw-review-row">
                <span className="sfw-review-label">Location</span>
                <span className="sfw-review-value">{sfCities.join(', ')}, {US_STATES.find((s) => s.code === sfState)?.name || sfState}</span>
                <button type="button" className="sfw-review-edit" onClick={() => goTo(1, 'back')}>Edit</button>
              </div>
              <div className="sfw-review-row">
                <span className="sfw-review-label">Property</span>
                <span className="sfw-review-value">{PROPERTY_TYPES.find((p) => p.id === sfPropType)?.label || 'All Types'}</span>
                <button type="button" className="sfw-review-edit" onClick={() => goTo(2, 'back')}>Edit</button>
              </div>
              <div className="sfw-review-row">
                <span className="sfw-review-label">Beds / Baths</span>
                <span className="sfw-review-value">{sfBeds ? `${sfBeds}+ beds` : 'Any'} · {sfBaths ? `${sfBaths}+ baths` : 'Any'}</span>
                <button type="button" className="sfw-review-edit" onClick={() => goTo(3, 'back')}>Edit</button>
              </div>
              <div className="sfw-review-row">
                <span className="sfw-review-label">Priorities</span>
                <span className="sfw-review-value">
                  {sfFeatures.length > 0 ? (
                    <span className="sfw-review-priorities">
                      {mustCount > 0 && <span className="sfw-review-badge sfw-review-badge-must"><AlertCircle size={11} /> {mustCount} must</span>}
                      {niceCount > 0 && <span className="sfw-review-badge sfw-review-badge-nice"><Star size={11} /> {niceCount} nice</span>}
                    </span>
                  ) : 'None'}
                </span>
                <button type="button" className="sfw-review-edit" onClick={() => goTo(4, 'back')}>Edit</button>
              </div>
              <div className="sfw-review-row">
                <span className="sfw-review-label">Specs</span>
                <span className="sfw-review-value">
                  {[
                    minSqft > 0 && `${minSqft.toLocaleString()}+ sqft`,
                    minLot && `${LOT_OPTIONS.find((l) => l.value === minLot)?.label}+ lot`,
                    minGarage && `${minGarage}+ garage`,
                    yearBuilt && `Built ${yearBuilt}+`,
                    noHoa && 'No HOA',
                  ].filter(Boolean).join(' · ') || 'Any'}
                </span>
                <button type="button" className="sfw-review-edit" onClick={() => goTo(5, 'back')}>Edit</button>
              </div>

              {maxBudget && (
                <div className="sfw-review-budget">
                  <Check size={14} /> Within your budget of <strong>{fmt(maxBudget)}</strong>
                </div>
              )}
            </div>

            {/* Priority chips */}
            {sfFeatures.length > 0 && (
              <div className="sfw-review-details">
                {Object.entries(sfPriorities).map(([id, level]) => {
                  const feat = ALL_FEATURES.find((f) => f.id === id);
                  if (!feat) return null;
                  const IC = feat.Icon;
                  return (
                    <span key={id} className={`sfw-review-chip ${level === 'must' ? 'sfw-review-chip-must' : 'sfw-review-chip-nice'}`}>
                      <IC size={13} strokeWidth={2} /> {feat.label}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="sfw-nav sfw-nav-final">
              <button type="button" className="sfw-btn sfw-btn-ghost" onClick={goBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> Back
              </button>
              <button type="button" className="sfw-btn sfw-btn-primary sfw-btn-large sfw-btn-find"
                onClick={handleFindMatches} disabled={searchLoading}>
                {searchLoading ? (
                  <><span className="sfw-spinner" /> Searching...</>
                ) : (
                  <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> Find My Matches</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
