import React from 'react';
import ListingCard from './ListingCard';
import './ListingGrid.css';

function ListingGrid({ listings, onFavorite, onUnfavorite, isFavorite, onCardClick }) {
  if (listings.length === 0) {
    return (
      <p className="no-results">
        No listings found. Try adjusting your search criteria.
      </p>
    );
  }

  return (
    <div className="listing-grid">
      {listings.map((listing, i) => (
        <div key={listing.property_id} className="listing-grid-item" style={{ animationDelay: `${i * 0.04}s` }}>
          <ListingCard
            listing={listing}
            onFavorite={onFavorite}
            onUnfavorite={onUnfavorite}
            isFavorited={isFavorite(listing.property_id)}
            onCardClick={onCardClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ListingGrid;
