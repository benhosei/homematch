import React, { useState } from 'react';
import ListingGrid from './ListingGrid';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import API_BASE from '../utils/apiBase';
import './SearchResults.css';

function LeadBanner() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Don't show if recently submitted
  try {
    const stored = JSON.parse(localStorage.getItem('hm_lead_submitted') || 'null');
    if (stored && Date.now() - stored.ts < 24 * 60 * 60 * 1000) return null;
  } catch { /* ignore */ }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: name,
          buyerEmail: email,
          prompt: 'Browsing search results — wants agent help',
          source: 'search_results_banner',
        }),
      });
      setSubmitted(true);
      localStorage.setItem('hm_lead_submitted', JSON.stringify({ email, ts: Date.now() }));
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="lead-banner lead-banner-success">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        <span>A local expert will reach out within 24 hours!</span>
      </div>
    );
  }

  return (
    <div className="lead-banner">
      <div className="lead-banner-text">
        <strong>Need help finding the right home?</strong>
        <span>Get matched with a local agent who specializes in what you're looking for.</span>
      </div>
      <form className="lead-banner-form" onSubmit={handleSubmit}>
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="lead-banner-input" />
        <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} className="lead-banner-input" required />
        <button type="submit" className="lead-banner-btn" disabled={submitting || !email}>
          {submitting ? '...' : 'Get Matched'}
        </button>
      </form>
    </div>
  );
}

function SearchResults({
  listings, total, loading, error,
  onFavorite, onUnfavorite, isFavorite,
  aiNote, onCardClick,
}) {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (listings.length === 0 && total === 0) return null;

  return (
    <section className="search-results">
      {aiNote && (
        <div className="ai-summary-banner">
          <div className="ai-summary-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span>{aiNote}</span>
        </div>
      )}
      <div className="results-header">
        <h2>{total.toLocaleString()} {total === 1 ? 'home' : 'homes'} found</h2>
        <span className="results-sort">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Ranked by AI match score
        </span>
      </div>

      {listings.length >= 3 && <LeadBanner />}

      <ListingGrid
        listings={listings}
        onFavorite={onFavorite}
        onUnfavorite={onUnfavorite}
        isFavorite={isFavorite}
        onCardClick={onCardClick}
      />
    </section>
  );
}

export default SearchResults;
