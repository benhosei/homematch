import React, { useState, useEffect, useRef, useCallback } from 'react';
import CITIES_BY_STATE from '../utils/cityData';
import API_BASE from '../utils/apiBase';
import './CityMultiSelect.css';

/**
 * CityMultiSelect — Multi-city picker with click-to-select chips.
 *
 * Props:
 *   stateCode        — 2-char state code (e.g. "IN")
 *   selectedCities   — array of city name strings ["Fishers", "Carmel"]
 *   onChange          — callback(newCitiesArray)
 *   maxCities        — max selectable (default 5)
 */
export default function CityMultiSelect({
  stateCode,
  selectedCities = [],
  onChange,
  maxCities = 5,
}) {
  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [filterText, setFilterText] = useState('');
  const filterRef = useRef(null);

  // Default top-N cities to show initially
  const TOP_COUNT = 15;

  // Load cities when state changes — use embedded data, API as fallback
  useEffect(() => {
    if (!stateCode) {
      setAllCities([]);
      return;
    }

    setShowMore(false);
    setFilterText('');

    // Use embedded city data (works without backend)
    const embedded = CITIES_BY_STATE[stateCode.toUpperCase()];
    if (embedded && embedded.length > 0) {
      setAllCities(embedded);
      setLoading(false);
      return;
    }

    // Fallback: fetch from API if embedded data missing
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/location/cities?state=${stateCode}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setAllCities(data.cities || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllCities([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [stateCode]);

  // Focus filter input when "More cities" opens
  useEffect(() => {
    if (showMore && filterRef.current) {
      filterRef.current.focus();
    }
  }, [showMore]);

  const toggleCity = useCallback(
    (city) => {
      if (selectedCities.includes(city)) {
        onChange(selectedCities.filter((c) => c !== city));
      } else if (selectedCities.length < maxCities) {
        onChange([...selectedCities, city]);
      }
    },
    [selectedCities, onChange, maxCities]
  );

  const removeCity = useCallback(
    (city) => {
      onChange(selectedCities.filter((c) => c !== city));
    },
    [selectedCities, onChange]
  );

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Split cities into top and rest
  const topCities = allCities.slice(0, TOP_COUNT);
  const hasMore = allCities.length > TOP_COUNT;

  // Filter for "More cities" dropdown
  const filteredCities = filterText
    ? allCities.filter((c) => c.toLowerCase().includes(filterText.toLowerCase()))
    : allCities;

  if (!stateCode) return null;

  return (
    <div className="cms-container">
      {/* ── Selected cities chips ── */}
      {selectedCities.length > 0 && (
        <div className="cms-selected">
          <div className="cms-selected-header">
            <span className="cms-selected-label">
              {selectedCities.length} {selectedCities.length === 1 ? 'city' : 'cities'} selected
            </span>
            <button type="button" className="cms-clear-btn" onClick={clearAll}>
              Clear all
            </button>
          </div>
          <div className="cms-chips">
            {selectedCities.map((city) => (
              <span key={city} className="cms-chip cms-chip-selected">
                {city}
                <button
                  type="button"
                  className="cms-chip-remove"
                  onClick={() => removeCity(city)}
                  aria-label={`Remove ${city}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Top cities as clickable chips ── */}
      <div className="cms-picker">
        <label className="cms-picker-label">
          {selectedCities.length > 0 ? 'Add more cities' : 'Select cities'}
          {selectedCities.length >= maxCities && (
            <span className="cms-max-note"> (max {maxCities})</span>
          )}
        </label>

        {loading ? (
          <div className="cms-loading">
            <span className="cms-spinner" />
            Loading cities...
          </div>
        ) : (
          <>
            <div className="cms-chips">
              {topCities.map((city) => {
                const isSelected = selectedCities.includes(city);
                const isDisabled = !isSelected && selectedCities.length >= maxCities;
                return (
                  <button
                    key={city}
                    type="button"
                    className={`cms-chip ${isSelected ? 'cms-chip-active' : ''} ${isDisabled ? 'cms-chip-disabled' : ''}`}
                    onClick={() => !isDisabled && toggleCity(city)}
                    disabled={isDisabled}
                  >
                    {isSelected && (
                      <svg className="cms-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {city}
                  </button>
                );
              })}
            </div>

            {/* More cities toggle */}
            {hasMore && (
              <button
                type="button"
                className="cms-more-btn"
                onClick={() => setShowMore(!showMore)}
              >
                {showMore ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                    Fewer cities
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    More cities ({allCities.length - TOP_COUNT} more)
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Expanded "More cities" searchable list ── */}
      {showMore && (
        <div className="cms-expanded">
          <div className="cms-filter-wrap">
            <svg className="cms-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={filterRef}
              type="text"
              className="cms-filter-input"
              placeholder="Filter cities..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            {filterText && (
              <button type="button" className="cms-filter-clear" onClick={() => setFilterText('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="cms-list">
            {filteredCities.length === 0 ? (
              <div className="cms-no-results">No cities match "{filterText}"</div>
            ) : (
              filteredCities.map((city) => {
                const isSelected = selectedCities.includes(city);
                const isDisabled = !isSelected && selectedCities.length >= maxCities;
                return (
                  <button
                    key={city}
                    type="button"
                    className={`cms-list-item ${isSelected ? 'cms-list-item-selected' : ''} ${isDisabled ? 'cms-list-item-disabled' : ''}`}
                    onClick={() => !isDisabled && toggleCity(city)}
                    disabled={isDisabled}
                  >
                    <span className={`cms-checkbox ${isSelected ? 'cms-checkbox-checked' : ''}`}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {city}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
