import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ListingGrid from './ListingGrid';
import { scoreListing } from '../utils/scoring';
import './Favorites.css';

function Favorites({ favorites, preferences, onRemove }) {
  const scored = useMemo(() => {
    const prefs = {
      priceMin: preferences.priceMin ? Number(preferences.priceMin) : null,
      priceMax: preferences.priceMax ? Number(preferences.priceMax) : null,
      beds: preferences.beds ? Number(preferences.beds) : null,
      baths: preferences.baths ? Number(preferences.baths) : null,
      propType: preferences.propType || null,
    };

    return favorites
      .map((f) => ({ ...f, match: scoreListing(f, prefs) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [favorites, preferences]);

  return (
    <section className="favorites-page">
      <div className="favorites-header">
        <h2>
          Saved Listings{' '}
          <span className="favorites-count">({favorites.length})</span>
        </h2>
        {favorites.length > 0 && (
          <p className="favorites-hint">
            Scores update based on your current search preferences
          </p>
        )}
      </div>
      {favorites.length === 0 ? (
        <div className="favorites-empty">
          <p>No saved listings yet.</p>
          <p>Search for homes and click the heart icon to save them here.</p>
          <Link to="/homes" className="btn-start-search">
            Browse Homes
          </Link>
        </div>
      ) : (
        <ListingGrid
          listings={scored}
          onFavorite={() => {}}
          onUnfavorite={onRemove}
          isFavorite={() => true}
        />
      )}
    </section>
  );
}

export default Favorites;
