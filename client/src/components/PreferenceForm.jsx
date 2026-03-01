import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../utils/apiBase';
import './PreferenceForm.css';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington DC' },
];

const FEATURES = [
  { id: 'pool', label: 'Pool', icon: '\u{1F3CA}' },
  { id: 'gym', label: 'Home Gym', icon: '\u{1F4AA}' },
  { id: 'garage', label: 'Garage', icon: '\u{1F697}' },
  { id: 'fireplace', label: 'Fireplace', icon: '\u{1F525}' },
  { id: 'basement', label: 'Basement', icon: '\u{1F3DA}' },
  { id: 'hardwood', label: 'Hardwood Floors', icon: '\u{1FAB5}' },
  { id: 'solar', label: 'Solar Panels', icon: '\u2600' },
  { id: 'smart_home', label: 'Smart Home', icon: '\u{1F4F1}' },
  { id: 'office', label: 'Home Office', icon: '\u{1F4BB}' },
  { id: 'open_floor', label: 'Open Floor Plan', icon: '\u{1F3E0}' },
  { id: 'patio', label: 'Patio / Deck', icon: '\u{1F305}' },
  { id: 'yard', label: 'Large Yard', icon: '\u{1F333}' },
  { id: 'updated_kitchen', label: 'Modern Kitchen', icon: '\u{1F373}' },
  { id: 'walk_in_closet', label: 'Walk-in Closet', icon: '\u{1F45A}' },
  { id: 'laundry', label: 'In-unit Laundry', icon: '\u{1F9FA}' },
  { id: 'heated_floors', label: 'Heated Floors', icon: '\u{1F321}' },
  { id: 'ev_charger', label: 'EV Charger', icon: '\u26A1' },
  { id: 'waterfront', label: 'Waterfront', icon: '\u{1F30A}' },
];

const EXAMPLE_PROMPTS = [
  "I work from home and need a quiet office space with good internet",
  "Growing family, need 4 beds near good schools with a big yard",
  "Fitness enthusiast — need a garage gym with high ceilings",
  "Looking to invest in a rental property under 400k with good ROI",
];

const LIFESTYLE_CHIPS = [
  { id: 'fitness', label: 'Fitness Enthusiast', icon: '\u{1F4AA}' },
  { id: 'family', label: 'Growing Family', icon: '\u{1F46A}' },
  { id: 'remote_work', label: 'Remote Worker', icon: '\u{1F4BB}' },
  { id: 'entertainer', label: 'Love Hosting', icon: '\u{1F37E}' },
  { id: 'outdoors', label: 'Outdoor Lover', icon: '\u{1F3DE}\uFE0F' },
  { id: 'investor', label: 'Investor Mindset', icon: '\u{1F4C8}' },
  { id: 'pets', label: 'Pet Parent', icon: '\u{1F436}' },
  { id: 'sustainability', label: 'Eco-Conscious', icon: '\u2600\uFE0F' },
  { id: 'creative', label: 'Creative/Artist', icon: '\u{1F3A8}' },
  { id: 'downsizer', label: 'Downsizing', icon: '\u{1F33F}' },
];

function PreferenceForm({
  preferences, onChange, onReset, onSearch, onAISearch,
  onSaveSearch, savedSearches = [], onDeleteSavedSearch,
  loading, clickHistory = [],
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [searchMode, setSearchMode] = useState('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [selectedLifestyles, setSelectedLifestyles] = useState([]);

  // Location bar state
  const [locationInput, setLocationInput] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const locationTimeoutRef = useRef(null);

  // Initialize location bar from preferences
  useEffect(() => {
    if (preferences.city && preferences.stateCode && !locationInput && !resolvedLocation) {
      setLocationInput(`${preferences.city}, ${preferences.stateCode}`);
      setResolvedLocation({ city: preferences.city, stateCode: preferences.stateCode });
    }
  }, [preferences.city, preferences.stateCode]);

  // Debounced location resolution
  const handleLocationChange = (value) => {
    setLocationInput(value);
    setLocationError(null);

    // Clear previous timeout
    if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setResolvedLocation(null);
      return;
    }

    // Only auto-resolve for zip codes (5 digits) or if user types comma
    const isZip = /^\d{5}$/.test(trimmed);
    const hasComma = trimmed.includes(',');
    const hasState = /\s+[A-Z]{2}$/i.test(trimmed);

    if (isZip || hasComma || hasState) {
      locationTimeoutRef.current = setTimeout(() => resolveLocation(trimmed), 400);
    } else {
      setResolvedLocation(null);
    }
  };

  const resolveLocation = async (query) => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const res = await fetch(`${API_BASE}/api/location/resolve?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.city && data.stateCode) {
        setResolvedLocation(data);
        // Update the preferences so search uses the resolved location
        onChange({ city: data.city, stateCode: data.stateCode });
      } else {
        setLocationError(data.error || 'Location not found');
        setResolvedLocation(null);
      }
    } catch {
      setLocationError('Could not look up location');
      setResolvedLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = locationInput.trim();
      if (trimmed) {
        resolveLocation(trimmed);
      }
    }
  };

  const clearLocation = () => {
    setLocationInput('');
    setResolvedLocation(null);
    setLocationError(null);
    onChange({ city: '', stateCode: '' });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    onSearch(selectedFeatures);
  };

  const toggleLifestyle = (chipId) => {
    setSelectedLifestyles(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    );
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;

    // Must have a location set
    if (!resolvedLocation) {
      setLocationError('Please enter your zip code or city first');
      return;
    }

    setAiLoading(true);
    setParsedPreview(null);
    try {
      // Build enriched prompt with lifestyle context
      let enrichedPrompt = aiPrompt.trim();
      if (selectedLifestyles.length > 0) {
        const lifestyleLabels = selectedLifestyles
          .map(id => LIFESTYLE_CHIPS.find(c => c.id === id)?.label)
          .filter(Boolean);
        enrichedPrompt += ` (lifestyle: ${lifestyleLabels.join(', ')})`;
      }

      const res = await fetch(`${API_BASE}/api/assistant/parse-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enrichedPrompt }),
      });
      const data = await res.json();

      if (data.searchParams) {
        // Override location with the resolved location bar value
        data.searchParams.city = resolvedLocation.city;
        data.searchParams.stateCode = resolvedLocation.stateCode;

        setParsedPreview(data);

        // Fetch lifestyle analysis from intelligence engine
        try {
          const lifestyleRes = await fetch(`${API_BASE}/api/intelligence/analyze-lifestyle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: enrichedPrompt,
              lifestyles: selectedLifestyles,
            }),
          });
          const lifestyleData = await lifestyleRes.json();
          data.lifestyleAnalysis = lifestyleData;
          setParsedPreview({ ...data });

          // Apply lifestyle-based feature boosts
          if (lifestyleData.searchBoosts) {
            const boostedFeatures = [...(data.features || [])];
            Object.entries(lifestyleData.searchBoosts).forEach(([key, val]) => {
              if (val === true && FEATURES.find(f => f.id === key) && !boostedFeatures.includes(key)) {
                boostedFeatures.push(key);
              }
            });
            data.features = boostedFeatures;
            setSelectedFeatures(boostedFeatures);
          }
        } catch (err) {
          console.error('Lifestyle analysis failed:', err);
        }

        // Apply to form
        onChange({
          city: resolvedLocation.city,
          stateCode: resolvedLocation.stateCode,
          priceMin: data.searchParams.priceMin || '',
          priceMax: data.searchParams.priceMax || '',
          beds: data.searchParams.beds || '',
          baths: data.searchParams.baths || '',
          propType: data.searchParams.propType || '',
        });

        if (data.features && data.features.length > 0) {
          setSelectedFeatures(data.features);
        }

        // Always search when we have location from the bar
        onAISearch(data.searchParams, data.features || [], data.aiNote);
      }
    } catch (err) {
      console.error('AI parse failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveCurrentSearch = () => {
    if (onSaveSearch && parsedPreview && aiPrompt) {
      onSaveSearch(aiPrompt, parsedPreview.searchParams, parsedPreview.features);
    }
  };

  const handleLoadSavedSearch = (saved) => {
    setAiPrompt(saved.prompt);
    setShowSaved(false);
    if (saved.params && saved.params.city) {
      setLocationInput(`${saved.params.city}, ${saved.params.stateCode}`);
      setResolvedLocation({ city: saved.params.city, stateCode: saved.params.stateCode });
      onChange(saved.params);
      if (saved.features) setSelectedFeatures(saved.features);
      onAISearch(saved.params, saved.features || [], null);
    }
  };

  const removePreviewTag = (type, value) => {
    if (type === 'feature') {
      const updated = selectedFeatures.filter(f => f !== value);
      setSelectedFeatures(updated);
      setParsedPreview(prev => prev ? { ...prev, features: updated } : null);
    }
  };

  const toggleFeature = (featureId) => {
    setSelectedFeatures(prev =>
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  return (
    <div className="search-hero">
      <div className="hero-bg">
        <div className="hero-overlay" />
        <div className="hero-content">
          {searchMode === 'ai' ? (
            <>
              <div className="hero-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Powered by AI
              </div>
              <h1 className="hero-title">Describe Your<br/>Dream Home</h1>
              <p className="hero-subtitle">Tell our AI what you want in plain English — it handles the rest</p>
            </>
          ) : (
            <>
              <div className="hero-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                HomeMatch
              </div>
              <h1 className="hero-title">Find Your<br/>Perfect Home</h1>
              <p className="hero-subtitle">Search thousands of listings by location, price, beds, baths, and more</p>
            </>
          )}

          {/* ===== LOCATION BAR ===== */}
          <div className="location-bar-wrapper">
            <div className={`location-bar ${resolvedLocation ? 'resolved' : ''} ${locationError ? 'error' : ''}`}>
              <div className="location-bar-icon">
                {locationLoading ? (
                  <span className="location-spinner" />
                ) : resolvedLocation ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                )}
              </div>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => handleLocationChange(e.target.value)}
                onKeyDown={handleLocationSubmit}
                placeholder="Enter zip code or city, state (e.g. 46220 or Austin, TX)"
                className="location-bar-input"
              />
              {resolvedLocation && (
                <div className="location-resolved-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {resolvedLocation.city}, {resolvedLocation.stateCode}
                  {resolvedLocation.zip && <span className="location-zip">({resolvedLocation.zip})</span>}
                </div>
              )}
              {(locationInput || resolvedLocation) && (
                <button type="button" className="location-clear-btn" onClick={clearLocation} title="Clear location">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            {locationError && (
              <div className="location-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                {locationError}
              </div>
            )}
            {!resolvedLocation && !locationError && locationInput.length === 0 && (
              <div className="location-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                Start by entering where you want to live
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="search-mode-toggle">
            <button className={`mode-btn ${searchMode === 'ai' ? 'active' : ''}`} onClick={() => setSearchMode('ai')} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              AI Search
            </button>
            <button className={`mode-btn ${searchMode === 'manual' ? 'active' : ''}`} onClick={() => setSearchMode('manual')} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
              Filters
            </button>
          </div>

          {/* === AI SEARCH MODE === */}
          {searchMode === 'ai' && (
            <div className="ai-search-section">
              <form className="ai-prompt-bar" onSubmit={handleAISubmit}>
                <div className="ai-prompt-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={resolvedLocation
                    ? `Describe your dream home in ${resolvedLocation.city}...`
                    : 'First set your location above, then describe your dream home...'
                  }
                  className="ai-prompt-input"
                  disabled={aiLoading}
                />
                <button type="submit" className="ai-prompt-submit" disabled={aiLoading || !aiPrompt.trim() || !resolvedLocation}>
                  {aiLoading ? (
                    <span className="btn-loading" />
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      Find Homes
                    </>
                  )}
                </button>
              </form>

              {/* Example prompts + saved searches */}
              <div className="prompt-actions">
                <div className="example-prompts">
                  <span className="example-label">Try:</span>
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} type="button" className="example-chip" onClick={() => setAiPrompt(p)}>{p}</button>
                  ))}
                </div>
                {savedSearches.length > 0 && (
                  <button type="button" className="btn-saved-searches" onClick={() => setShowSaved(!showSaved)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    Saved ({savedSearches.length})
                  </button>
                )}
              </div>

              {/* Lifestyle context chips */}
              <div className="lifestyle-chips-row">
                <span className="lifestyle-label">I'm looking for:</span>
                <div className="lifestyle-chips">
                  {LIFESTYLE_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`lifestyle-chip ${selectedLifestyles.includes(chip.id) ? 'active' : ''}`}
                      onClick={() => toggleLifestyle(chip.id)}
                    >
                      <span className="lc-icon">{chip.icon}</span>
                      <span className="lc-label">{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved searches dropdown */}
              {showSaved && savedSearches.length > 0 && (
                <div className="saved-searches-panel">
                  <h4>Saved AI Searches</h4>
                  {savedSearches.map(s => (
                    <div key={s.id} className="saved-search-item">
                      <button className="saved-search-text" onClick={() => handleLoadSavedSearch(s)}>
                        {s.prompt}
                      </button>
                      <button className="saved-search-delete" onClick={() => onDeleteSavedSearch(s.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI parsed preview with removable chips */}
              {parsedPreview && (
                <div className="ai-preview">
                  <div className="ai-preview-header">
                    <div className="ai-preview-left">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                      AI understood your request
                    </div>
                    {onSaveSearch && (
                      <button type="button" className="btn-save-search" onClick={handleSaveCurrentSearch}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        Save
                      </button>
                    )}
                  </div>
                  <div className="ai-preview-tags">
                    {parsedPreview.searchParams.city && (
                      <span className="preview-tag location">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {parsedPreview.searchParams.city}, {parsedPreview.searchParams.stateCode}
                      </span>
                    )}
                    {parsedPreview.searchParams.priceMax && (
                      <span className="preview-tag budget">
                        ${Number(parsedPreview.searchParams.priceMax).toLocaleString()}
                        {parsedPreview.searchParams.priceMin ? ` (min $${Number(parsedPreview.searchParams.priceMin).toLocaleString()})` : ' max'}
                      </span>
                    )}
                    {parsedPreview.searchParams.beds && (<span className="preview-tag">{parsedPreview.searchParams.beds} bed</span>)}
                    {parsedPreview.searchParams.baths && (<span className="preview-tag">{parsedPreview.searchParams.baths} bath</span>)}
                    {parsedPreview.searchParams.propType && (<span className="preview-tag type">{parsedPreview.searchParams.propType}</span>)}
                    {parsedPreview.searchParams.lotSqftMin && (
                      <span className="preview-tag">
                        {'\u{1F33E}'} {Math.round(Number(parsedPreview.searchParams.lotSqftMin) / 43560 * 10) / 10} acre{Number(parsedPreview.searchParams.lotSqftMin) > 43560 ? 's' : ''} min
                      </span>
                    )}
                    {parsedPreview.features && parsedPreview.features.map(f => {
                      const feat = FEATURES.find(ft => ft.id === f);
                      return feat ? (
                        <span key={f} className="preview-tag feature removable" onClick={() => removePreviewTag('feature', f)}>
                          {feat.icon} {feat.label}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Lifestyle analysis display */}
              {parsedPreview && parsedPreview.lifestyleAnalysis && (
                <div className="lifestyle-analysis">
                  <div className="la-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    AI Life Strategy Insights
                  </div>
                  {parsedPreview.lifestyleAnalysis.personalInsight && (
                    <p className="la-insight">{parsedPreview.lifestyleAnalysis.personalInsight}</p>
                  )}
                  {parsedPreview.lifestyleAnalysis.nicheTips && parsedPreview.lifestyleAnalysis.nicheTips.length > 0 && (
                    <div className="la-tips">
                      {parsedPreview.lifestyleAnalysis.nicheTips.map((tip, i) => (
                        <div key={i} className="la-tip">
                          <span className="la-tip-icon">{tip.icon}</span>
                          <div>
                            <strong>{tip.title}</strong>
                            <span>{tip.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {parsedPreview.lifestyleAnalysis.futureNeeds && parsedPreview.lifestyleAnalysis.futureNeeds.length > 0 && (
                    <div className="la-future">
                      <span className="la-future-label">{'\u{1F52E}'} 5-Year Outlook:</span>
                      {parsedPreview.lifestyleAnalysis.futureNeeds.map((need, i) => (
                        <span key={i} className="la-future-item">{need}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === MANUAL SEARCH MODE === */}
          {searchMode === 'manual' && (
            <>
              <form className="hero-search-bar" onSubmit={handleManualSubmit}>
                <div className="search-bar-main">
                  <div className="search-field search-field-price">
                    <label>Price Range</label>
                    <div className="price-inputs">
                      <input type="number" value={preferences.priceMin} onChange={(e) => onChange({ priceMin: e.target.value })} placeholder="Min" min="0" step="10000" />
                      <span className="price-dash">&ndash;</span>
                      <input type="number" value={preferences.priceMax} onChange={(e) => onChange({ priceMax: e.target.value })} placeholder="Max" min="0" step="10000" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !resolvedLocation} className="btn-hero-search">
                    {loading ? <span className="btn-loading" /> : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    )}
                  </button>
                </div>
              </form>

              {!resolvedLocation && (
                <div className="manual-location-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  Set your location above to enable search
                </div>
              )}

              <div className="quick-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Beds</label>
                    <div className="pill-group">
                      {['', '1', '2', '3', '4', '5'].map(v => (
                        <button key={v} type="button" className={`pill ${preferences.beds === v ? 'active' : ''}`} onClick={() => onChange({ beds: v })}>
                          {v || 'Any'}{v && '+'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-group">
                    <label>Baths</label>
                    <div className="pill-group">
                      {['', '1', '2', '3', '4'].map(v => (
                        <button key={v} type="button" className={`pill ${preferences.baths === v ? 'active' : ''}`} onClick={() => onChange({ baths: v })}>
                          {v || 'Any'}{v && '+'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-group">
                    <label>Type</label>
                    <div className="pill-group">
                      {[{ v: '', l: 'Any' }, { v: 'house', l: 'House' }, { v: 'condo', l: 'Condo' }, { v: 'townhome', l: 'Townhome' }].map(({ v, l }) => (
                        <button key={v} type="button" className={`pill ${preferences.propType === v ? 'active' : ''}`} onClick={() => onChange({ propType: v })}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className={`btn-more-filters ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
                    {showFilters ? 'Less' : 'More'}
                    {selectedFeatures.length > 0 && <span className="filter-count">{selectedFeatures.length}</span>}
                  </button>
                  <button type="button" onClick={() => { onReset(); setSelectedFeatures([]); clearLocation(); }} className="btn-clear">Clear All</button>
                </div>
              </div>

              {showFilters && (
                <div className="feature-filters">
                  <h3>Must-Have Features</h3>
                  <div className="feature-grid">
                    {FEATURES.map(f => (
                      <button key={f.id} type="button" className={`feature-chip ${selectedFeatures.includes(f.id) ? 'active' : ''}`} onClick={() => toggleFeature(f.id)}>
                        <span className="feature-icon">{f.icon}</span>
                        <span className="feature-label">{f.label}</span>
                        {selectedFeatures.includes(f.id) && <span className="feature-check">{'\u2713'}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PreferenceForm;
