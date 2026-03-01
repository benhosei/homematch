import React, { useState, useRef } from 'react';
import { parseIntent, searchWithIntent } from '../utils/intentApi';
import IntentChips from './IntentChips';
import ScoreCard from './ScoreCard';
import './IntentSearch.css';

const EXAMPLE_QUERIES = [
  "I want a 4 bed home with a garage gym and big yard near good schools",
  "Looking for a modern condo under $500k with a pool and city views",
  "Investment property with 3+ units, good rental yield, low crime area",
  "Quiet suburban home with a home office, fiber internet, and hiking trails nearby",
  "Family-friendly 3 bed townhome with park access and open floor plan",
];

function IntentSearch({ onResults }) {
  const [locationText, setLocationText] = useState('');
  const [queryText, setQueryText] = useState('');
  const [intent, setIntent] = useState(null);
  const [chips, setChips] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [totalResults, setTotalResults] = useState(0);

  const queryRef = useRef(null);

  const handleRemoveChip = (index) => {
    setChips(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!locationText.trim() || !queryText.trim()) return;

    setError(null);
    setParseLoading(true);
    setResults([]);
    setChips([]);
    setIntent(null);
    setConfidence(null);
    setClarifyingQuestions([]);

    try {
      // Step 1: Parse the intent
      const parsed = await parseIntent(locationText.trim(), queryText.trim());

      if (parsed.error) {
        setError(parsed.error);
        setParseLoading(false);
        return;
      }

      setIntent(parsed.intent);
      setConfidence(parsed.confidence ?? null);
      setClarifyingQuestions(parsed.clarifyingQuestions || []);

      // Build chips from parsed intent
      const newChips = [];
      if (parsed.intent?.location) {
        newChips.push({ label: 'Location', value: parsed.intent.location });
      }
      if (parsed.intent?.budgetMax) {
        const budgetStr = parsed.intent.budgetMin
          ? `$${Number(parsed.intent.budgetMin).toLocaleString()} - $${Number(parsed.intent.budgetMax).toLocaleString()}`
          : `Up to $${Number(parsed.intent.budgetMax).toLocaleString()}`;
        newChips.push({ label: 'Budget', value: budgetStr });
      }
      if (parsed.intent?.beds) {
        newChips.push({ label: 'Beds', value: `${parsed.intent.beds}+` });
      }
      if (parsed.intent?.baths) {
        newChips.push({ label: 'Baths', value: `${parsed.intent.baths}+` });
      }
      if (parsed.intent?.propType) {
        newChips.push({ label: 'Type', value: parsed.intent.propType });
      }
      if (parsed.intent?.mustHaves && parsed.intent.mustHaves.length > 0) {
        parsed.intent.mustHaves.forEach(mh => {
          newChips.push({ label: 'Must-have feature', value: mh });
        });
      }
      if (parsed.intent?.niceToHaves && parsed.intent.niceToHaves.length > 0) {
        parsed.intent.niceToHaves.forEach(nth => {
          newChips.push({ label: 'Feature', value: nth });
        });
      }
      setChips(newChips);
      setParseLoading(false);

      // Step 2: Search with the parsed intent
      setLoading(true);
      const searchRes = await searchWithIntent(parsed.intent);

      if (searchRes.error) {
        setError(searchRes.error);
        setLoading(false);
        return;
      }

      setResults(searchRes.results || []);
      setTotalResults(searchRes.total || (searchRes.results || []).length);

      if (onResults) {
        onResults(searchRes.results || []);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Intent search error:', err);
    } finally {
      setParseLoading(false);
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setQueryText(example);
    if (queryRef.current) {
      queryRef.current.focus();
    }
  };

  return (
    <div className="intent-search">
      {/* Hero */}
      <div className="is-hero">
        <div className="is-hero-bg">
          <div className="is-hero-overlay" />
          <div className="is-hero-content">
            <div className="is-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              AI Decision Engine
            </div>
            <h1 className="is-title">Smart Search</h1>
            <p className="is-subtitle">
              Describe exactly what you want -- our AI scores every home on lifestyle fit, investment potential, and risk
            </p>

            {/* Search form */}
            <form className="is-form" onSubmit={handleSubmit}>
              {/* Location input */}
              <div className="is-location-row">
                <div className="is-location-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Enter city, state or zip code (e.g. Austin, TX or 78701)"
                  className="is-location-input"
                />
              </div>

              {/* Query textarea */}
              <div className="is-query-row">
                <div className="is-query-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <textarea
                  ref={queryRef}
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Describe your ideal home in detail. Include budget, lifestyle, features, neighborhood preferences..."
                  className="is-query-textarea"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="is-submit"
                disabled={parseLoading || loading || !locationText.trim() || !queryText.trim()}
              >
                {parseLoading || loading ? (
                  <>
                    <span className="is-btn-loading" />
                    {parseLoading ? 'Analyzing...' : 'Searching...'}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    Find & Score Homes
                  </>
                )}
              </button>
            </form>

            {/* Example prompts */}
            <div className="is-examples">
              <span className="is-examples-label">Try:</span>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className="is-example-chip"
                  onClick={() => handleExampleClick(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Intent chips */}
            {chips.length > 0 && (
              <div className="is-chips-section">
                <div className="is-chips-header">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                  AI parsed your request
                </div>
                <IntentChips chips={chips} onRemove={handleRemoveChip} />
              </div>
            )}

            {/* Confidence warning */}
            {confidence !== null && confidence < 0.6 && (
              <div className="is-confidence-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <strong>AI is uncertain about some details</strong>
                  <span>Try adding more specifics to your query for better results</span>
                </div>
              </div>
            )}

            {/* Clarifying questions */}
            {clarifyingQuestions.length > 0 && (
              <div className="is-clarifying">
                <div className="is-clarifying-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  AI suggests clarifying:
                </div>
                <ul className="is-clarifying-list">
                  {clarifyingQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="is-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="is-loading-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="is-shimmer-card">
              <div className="skeleton is-shimmer-image" />
              <div className="is-shimmer-body">
                <div className="skeleton is-shimmer-price" />
                <div className="skeleton is-shimmer-address" />
                <div className="skeleton is-shimmer-details" />
                <div className="is-shimmer-scores">
                  <div className="skeleton is-shimmer-badge" />
                  <div className="skeleton is-shimmer-badge" />
                  <div className="skeleton is-shimmer-badge" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <section className="is-results">
          <div className="is-results-header">
            <h2>{totalResults.toLocaleString()} {totalResults === 1 ? 'home' : 'homes'} scored</h2>
            <span className="is-results-sort">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Ranked by AI decision score
            </span>
          </div>
          <div className="is-results-grid">
            {results.map((item, i) => (
              <ScoreCard
                key={item.listing?.property_id || i}
                listing={item.listing || item}
                scoreBreakdown={item.scoreBreakdown || item.score || {}}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state after search */}
      {!loading && !error && results.length === 0 && intent && (
        <div className="is-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <h3>No homes matched your criteria</h3>
          <p>Try broadening your search or adjusting your requirements</p>
        </div>
      )}
    </div>
  );
}

export default IntentSearch;
