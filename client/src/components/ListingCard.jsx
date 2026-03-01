import React from 'react';
import { Link } from 'react-router-dom';
import MatchScore from './MatchScore';
import './ListingCard.css';

function formatLotSize(lotSqft) {
  if (!lotSqft || lotSqft <= 0) return null;
  const acres = lotSqft / 43560;
  if (acres >= 10) return `${Math.round(acres)} acres`;
  if (acres >= 1) return `${acres.toFixed(1).replace(/\.0$/, '')} acres`;
  return `${acres.toFixed(2).replace(/0$/, '')} acres`;
}

function getAIMatchSummary(listing) {
  if (!listing.match || !listing.match.breakdown) return null;
  const { breakdown, score } = listing.match;
  const parts = [];

  if (breakdown.price >= 90) parts.push('right in your budget');
  else if (breakdown.price >= 70) parts.push('close to your price range');

  if (breakdown.beds >= 90) parts.push(`has ${listing.beds} bedrooms as requested`);
  if (breakdown.baths >= 90 && listing.baths) parts.push(`${listing.baths} bathrooms`);

  if (breakdown.propType >= 90 && listing.prop_type) {
    parts.push(`it's a ${listing.prop_type.replace(/_/g, ' ')}`);
  }

  if (listing.sqft > 2500) parts.push('spacious layout');
  if (listing.lot_sqft > 10000) parts.push('large lot');

  if (parts.length === 0 && score >= 60) parts.push('good overall match for your criteria');
  if (parts.length === 0) return null;

  return `This home matches because ${parts.slice(0, 3).join(', ')}.`;
}

function ListingCard({ listing, onFavorite, onUnfavorite, isFavorited, onCardClick }) {
  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isFavorited ? onUnfavorite(listing.property_id) : onFavorite(listing);
  };

  const handleClick = () => {
    if (onCardClick) onCardClick(listing);
  };

  const formatPrice = (price) => price ? `$${price.toLocaleString()}` : 'Price N/A';
  const aiSummary = getAIMatchSummary(listing);

  return (
    <Link to={`/listing/${listing.property_id}`} className="listing-card" onClick={handleClick}>
      <div className="card-image">
        {listing.thumbnail ? (
          <img src={listing.thumbnail} alt={listing.address.full} loading="lazy" />
        ) : (
          <div className="card-no-image">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            No Image
          </div>
        )}
        <button className={`btn-favorite ${isFavorited ? 'favorited' : ''}`} onClick={handleFavoriteClick} aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}>
          {isFavorited ? '\u2665' : '\u2661'}
        </button>
        {listing.match && (
          <div className="card-score">
            <MatchScore score={listing.match.score} />
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-price">{formatPrice(listing.price)}</div>
        <div className="card-address">{listing.address.full}</div>
        <div className="card-details">
          <span>{listing.beds} bd</span>
          <span className="detail-sep">|</span>
          <span>{listing.baths} ba</span>
          {listing.sqft > 0 && (
            <>
              <span className="detail-sep">|</span>
              <span>{listing.sqft.toLocaleString()} sqft</span>
            </>
          )}
          {formatLotSize(listing.lot_sqft) && (
            <>
              <span className="detail-sep">|</span>
              <span>{formatLotSize(listing.lot_sqft)}</span>
            </>
          )}
        </div>
        {aiSummary && (
          <div className="card-ai-reason">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            {aiSummary}
          </div>
        )}
        {listing.price && listing.sqft > 0 && (
          <div className="card-investment-hint">
            <span className="card-ppsf">${Math.round(listing.price / listing.sqft)}/sqft</span>
            {listing.price / listing.sqft < 200 && <span className="card-value-tag">Good Value</span>}
            {listing.price / listing.sqft >= 200 && listing.price / listing.sqft < 350 && <span className="card-value-tag moderate">Market Rate</span>}
            {listing.price / listing.sqft >= 350 && <span className="card-value-tag premium">Premium</span>}
          </div>
        )}
        <div className="card-type">{listing.prop_type.replace(/_/g, ' ')}</div>
      </div>
    </Link>
  );
}

export default ListingCard;
