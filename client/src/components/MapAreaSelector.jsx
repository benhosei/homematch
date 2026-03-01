import React, { useEffect, useRef, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATE_CENTERS } from '../utils/stateCenters';
import API_BASE from '../utils/apiBase';
import './MapAreaSelector.css';

// ── Fix Leaflet default marker icons (webpack/CRA issue) ──
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ── Format price for marker popups ──
const fmtPrice = (p) => {
  if (!p) return '';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `$${Math.round(p / 1_000)}k`;
  return `$${p}`;
};

/**
 * MapFlyTo — inner component that reacts to state changes and flies the map.
 */
function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], zoom, { duration: 1 });
    }
  }, [map, center, zoom]);
  return null;
}

/**
 * MapEvents — listens for moveend and calls onBoundsChange + reverse geocode.
 */
function MapEvents({ onBoundsChange, onCenterChange, onMapMoved }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const isFirstMove = useRef(true);

  useEffect(() => {
    const handler = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();

      onBoundsChange({
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      });

      // Show "Search this area" after user interacts (not on first mount)
      if (isFirstMove.current) {
        isFirstMove.current = false;
      } else if (onMapMoved) {
        onMapMoved();
      }

      // Debounce reverse geocode
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onCenterChange(center.lat, center.lng);
      }, 600);
    };

    map.on('moveend', handler);
    // Fire once on mount
    handler();

    return () => {
      map.off('moveend', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [map, onBoundsChange, onCenterChange, onMapMoved]);

  return null;
}

/**
 * MapAreaSelector — Zillow/Redfin-style map search selector.
 *
 * Props:
 *   selectedState      — 2-char state code
 *   onCityResolved     — callback(city, stateCode)
 *   onBoundsChange     — callback({ northEast, southWest })
 *   markers            — array of listing objects with { lat, lng, price, address, property_id }
 *   onMarkerClick      — callback(listing)
 *   onSearchThisArea   — callback() fired when "Search this area" is clicked
 *   searchLoading      — boolean, shows spinner on search button
 *   isFullscreen       — boolean, controls fullscreen mode
 *   onToggleFullscreen — callback()
 */
export default function MapAreaSelector({
  selectedState,
  onCityResolved,
  onBoundsChange,
  markers = [],
  onMarkerClick,
  onSearchThisArea,
  searchLoading = false,
  isFullscreen = false,
  onToggleFullscreen,
}) {
  const [flyTarget, setFlyTarget] = useState(null);
  const [flyZoom, setFlyZoom] = useState(7);
  const geocodeAbort = useRef(null);

  // Place search state
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const searchBarRef = useRef(null);
  const placeDebounceRef = useRef(null);

  // "Search this area" visibility
  const [showSearchButton, setShowSearchButton] = useState(false);

  // Center on state when selectedState changes
  useEffect(() => {
    const center = STATE_CENTERS[selectedState];
    if (center) {
      setFlyTarget({ lat: center.lat, lng: center.lng });
      setFlyZoom(center.zoom || 7);
      setShowSearchButton(false);
    }
  }, [selectedState]);

  // Reverse geocode map center to city/state
  const handleCenterChange = useCallback(
    async (lat, lng) => {
      if (geocodeAbort.current) geocodeAbort.current.abort();
      const controller = new AbortController();
      geocodeAbort.current = controller;

      try {
        const res = await fetch(
          `${API_BASE}/api/location/reverse-geocode?lat=${lat}&lng=${lng}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.city && data.stateCode) {
          onCityResolved(data.city, data.stateCode);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Reverse geocode failed:', err.message);
        }
      }
    },
    [onCityResolved]
  );

  // Reset to state center
  const handleReset = useCallback(() => {
    const center = STATE_CENTERS[selectedState];
    if (center) {
      setFlyTarget({ lat: center.lat, lng: center.lng });
      setFlyZoom(center.zoom || 7);
    }
  }, [selectedState]);

  // ── Place search logic ──

  const handlePlaceSearch = useCallback(
    (query) => {
      if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);

      if (!query || query.length < 2) {
        setPlaceResults([]);
        setShowPlaceDropdown(false);
        return;
      }

      setPlaceLoading(true);
      placeDebounceRef.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ q: query });
          if (selectedState) params.set('state', selectedState);
          const res = await fetch(`${API_BASE}/api/location/search-places?${params}`);
          const data = await res.json();
          setPlaceResults(data.results || []);
          setShowPlaceDropdown(true);
        } catch (err) {
          console.warn('Place search failed:', err.message);
        } finally {
          setPlaceLoading(false);
        }
      }, 500);
    },
    [selectedState]
  );

  const handlePlaceSelect = useCallback((place) => {
    // Calculate zoom from bounding box if available
    let zoom = 12;
    if (place.boundingbox) {
      const [south, north, west, east] = place.boundingbox.map(Number);
      const latSpan = Math.abs(north - south);
      const lngSpan = Math.abs(east - west);
      const maxSpan = Math.max(latSpan, lngSpan);
      if (maxSpan > 5) zoom = 6;
      else if (maxSpan > 2) zoom = 7;
      else if (maxSpan > 1) zoom = 8;
      else if (maxSpan > 0.5) zoom = 9;
      else if (maxSpan > 0.2) zoom = 10;
      else if (maxSpan > 0.1) zoom = 11;
      else zoom = 12;
    }

    setFlyTarget({ lat: place.lat, lng: place.lng });
    setFlyZoom(zoom);
    setPlaceQuery('');
    setPlaceResults([]);
    setShowPlaceDropdown(false);
  }, []);

  const clearPlaceSearch = useCallback(() => {
    setPlaceQuery('');
    setPlaceResults([]);
    setShowPlaceDropdown(false);
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
  }, []);

  // Click-outside to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target)) {
        setShowPlaceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => () => {
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
  }, []);

  // Handle "Search this area" click
  const handleSearchClick = useCallback(() => {
    if (onSearchThisArea) onSearchThisArea();
    setShowSearchButton(false);
  }, [onSearchThisArea]);

  const initialCenter = STATE_CENTERS[selectedState] || STATE_CENTERS.IN;

  return (
    <div className={`mas-container ${isFullscreen ? 'mas-fullscreen' : ''}`}>
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={initialCenter.zoom || 7}
        className="mas-map-wrap"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFlyTo center={flyTarget} zoom={flyZoom} />
        <MapEvents
          onBoundsChange={onBoundsChange}
          onCenterChange={handleCenterChange}
          onMapMoved={() => setShowSearchButton(true)}
        />

        {/* Result markers */}
        {markers.map((listing) =>
          listing.lat && listing.lng ? (
            <Marker
              key={listing.property_id}
              position={[listing.lat, listing.lng]}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(listing),
              }}
            >
              <Popup>
                <div className="mas-popup">
                  <strong>{fmtPrice(listing.price)}</strong>
                  <span>{listing.beds}bd / {listing.baths}ba</span>
                  <span className="mas-popup-addr">{listing.address?.line || listing.address?.full}</span>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>

      {/* ── Search bar overlay (top of map) ── */}
      <div className="mas-search-bar" ref={searchBarRef}>
        <div className="mas-search-input-wrap">
          <svg className="mas-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="mas-search-input"
            placeholder="Search city, ZIP, or neighborhood"
            value={placeQuery}
            onChange={(e) => {
              setPlaceQuery(e.target.value);
              handlePlaceSearch(e.target.value);
            }}
            onFocus={() => placeResults.length > 0 && setShowPlaceDropdown(true)}
          />
          {placeLoading && <span className="mas-search-spinner" />}
          {placeQuery && !placeLoading && (
            <button type="button" className="mas-search-clear" onClick={clearPlaceSearch} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {showPlaceDropdown && placeResults.length > 0 && (
          <div className="mas-search-dropdown">
            {placeResults.map((place, i) => (
              <button
                key={i}
                type="button"
                className="mas-search-result"
                onClick={() => handlePlaceSelect(place)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{place.displayName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── "Search this area" floating button ── */}
      {(showSearchButton || searchLoading) && (
        <button
          type="button"
          className="mas-search-area-btn"
          onClick={handleSearchClick}
          disabled={searchLoading}
        >
          {searchLoading ? (
            <>
              <span className="mas-btn-spinner" />
              Searching...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              Search this area
            </>
          )}
        </button>
      )}

      {/* ── Controls column (top right) ── */}
      <div className="mas-controls">
        <button type="button" className="mas-ctrl-btn" onClick={handleReset} title="Recenter to state view">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 119 9" />
            <path d="M3 3v9h9" />
          </svg>
        </button>
        {onToggleFullscreen && (
          <button type="button" className="mas-ctrl-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Expand map'}>
            {isFullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Fullscreen "Done" button ── */}
      {isFullscreen && (
        <button type="button" className="mas-done-btn" onClick={onToggleFullscreen}>
          Done
        </button>
      )}
    </div>
  );
}
