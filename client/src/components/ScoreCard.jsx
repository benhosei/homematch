import React from 'react';
import { Link } from 'react-router-dom';
import './ScoreCard.css';

function getScoreClass(score) {
  if (score >= 70) return 'score-green';
  if (score >= 40) return 'score-yellow';
  return 'score-red';
}

function formatPrice(price) {
  return price ? `$${price.toLocaleString()}` : 'Price N/A';
}

function ScoreCard({ listing, scoreBreakdown }) {
  const totalScore = scoreBreakdown?.totalScore ?? 0;
  const lifestyleScore = scoreBreakdown?.lifestyleScore ?? null;
  const investmentScore = scoreBreakdown?.investmentScore ?? null;
  const riskScore = scoreBreakdown?.riskScore ?? null;
  const reasons = scoreBreakdown?.reasons || [];
  const matchedMustHaves = scoreBreakdown?.matchedMustHaves || [];
  const missingMustHaves = scoreBreakdown?.missingMustHaves || [];

  return (
    <Link
      to={`/listing/${listing.property_id}`}
      className="score-card"
    >
      {/* Image */}
      <div className="sc-image">
        {listing.thumbnail ? (
          <img src={listing.thumbnail} alt={listing.address?.full || 'Listing'} loading="lazy" />
        ) : (
          <div className="sc-no-image">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            No Image
          </div>
        )}
        {/* Total score overlay */}
        <div className={`sc-total-score ${getScoreClass(totalScore)}`}>
          <span className="sc-total-number">{totalScore}</span>
          <span className="sc-total-label">Score</span>
        </div>
      </div>

      {/* Body */}
      <div className="sc-body">
        {/* Price + Address */}
        <div className="sc-price">{formatPrice(listing.price)}</div>
        <div className="sc-address">{listing.address?.full || 'Address unavailable'}</div>

        {/* Details row */}
        <div className="sc-details">
          <span>{listing.beds} bd</span>
          <span className="sc-sep">|</span>
          <span>{listing.baths} ba</span>
          {listing.sqft > 0 && (
            <>
              <span className="sc-sep">|</span>
              <span>{listing.sqft.toLocaleString()} sqft</span>
            </>
          )}
        </div>

        {/* Score badges row */}
        <div className="sc-scores-row">
          {lifestyleScore !== null && (
            <div className={`sc-score-badge ${getScoreClass(lifestyleScore)}`}>
              <span className="sc-badge-num">{lifestyleScore}</span>
              <span className="sc-badge-label">Lifestyle</span>
            </div>
          )}
          {investmentScore !== null && (
            <div className={`sc-score-badge ${getScoreClass(investmentScore)}`}>
              <span className="sc-badge-num">{investmentScore}</span>
              <span className="sc-badge-label">Investment</span>
            </div>
          )}
          {riskScore !== null && (
            <div className={`sc-score-badge ${getScoreClass(riskScore)}`}>
              <span className="sc-badge-num">{riskScore}</span>
              <span className="sc-badge-label">Risk</span>
            </div>
          )}
        </div>

        {/* Why this home */}
        {reasons.length > 0 && (
          <div className="sc-reasons">
            <div className="sc-reasons-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Why this home
            </div>
            <ul className="sc-reasons-list">
              {reasons.slice(0, 4).map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Must-haves */}
        {(matchedMustHaves.length > 0 || missingMustHaves.length > 0) && (
          <div className="sc-musthaves">
            {matchedMustHaves.map((item, i) => (
              <span key={`matched-${i}`} className="sc-musthave-badge matched">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </span>
            ))}
            {missingMustHaves.map((item, i) => (
              <span key={`missing-${i}`} className="sc-musthave-badge missing">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Property type */}
        {listing.prop_type && (
          <div className="sc-type">{listing.prop_type.replace(/_/g, ' ')}</div>
        )}
      </div>
    </Link>
  );
}

export default ScoreCard;
