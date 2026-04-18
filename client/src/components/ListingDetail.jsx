import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import MatchScore from './MatchScore';
import { generateMatchExplanation, generateBadges, checkOverpriced } from '../services/aiExplanations';
import API_BASE from '../utils/apiBase';
import './ListingDetail.css';

function calcMonthly(price, downPct = 20, rate = 6.5, years = 30) {
  const down = price * (downPct / 100);
  const principal = price - down;
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return Math.round(principal / n);
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(payment);
}

function generateAIProsCons(listing) {
  const pros = [];
  const cons = [];

  if (listing.sqft > 2000) pros.push('Spacious layout with plenty of room');
  else if (listing.sqft > 0 && listing.sqft < 800) cons.push('Compact living space');

  if (listing.lot_sqft > 8000) pros.push('Large lot for outdoor activities');
  if (listing.beds >= 4) pros.push(`${listing.beds} bedrooms - great for families`);
  if (listing.baths >= 3) pros.push('Multiple bathrooms for convenience');
  if (listing.baths <= 1) cons.push('Single bathroom may be limiting');

  if (listing.price < 300000) pros.push('Competitive price point');
  if (listing.price > 700000) cons.push('Higher price bracket');

  if (listing.prop_type === 'single_family') pros.push('Single family home with privacy');
  if (listing.prop_type === 'condos' || listing.prop_type === 'condo') {
    pros.push('Low-maintenance condo living');
    cons.push('HOA fees may apply');
  }

  if (listing.photos && listing.photos.length > 5) pros.push('Well-documented with many photos');
  if (!listing.thumbnail) cons.push('Limited photos available');
  if (!listing.description) cons.push('Limited property description');

  return {
    pros: pros.length > 0 ? pros.slice(0, 4) : ['Listed property with active status'],
    cons: cons.length > 0 ? cons.slice(0, 3) : ['No notable concerns identified'],
  };
}

function getAIDecision(matchScore, investmentData) {
  let combinedScore = 0;
  let factors = 0;

  if (matchScore) {
    combinedScore += matchScore;
    factors += 1;
  }

  if (investmentData?.smartScore) {
    combinedScore += investmentData.smartScore;
    factors += 1;
  }

  if (investmentData?.appreciation?.score) {
    combinedScore += investmentData.appreciation.score;
    factors += 1;
  }

  const avgScore = factors > 0 ? Math.round(combinedScore / factors) : 0;

  let recommendation, label, color;
  if (avgScore >= 75) {
    recommendation = 'Buy';
    label = 'Strong match with solid investment potential';
    color = '#22c55e';
  } else if (avgScore >= 50) {
    recommendation = 'Consider';
    label = 'Decent option worth exploring further';
    color = '#eab308';
  } else {
    recommendation = 'Pass';
    label = 'May not align with your goals';
    color = '#ef4444';
  }

  return { score: avgScore, recommendation, label, color };
}

const RENOVATION_OPTIONS = [
  { id: 'kitchen', label: 'Kitchen Remodel', icon: 'kitchen' },
  { id: 'bathroom', label: 'Bathroom Upgrade', icon: 'bathroom' },
  { id: 'basement', label: 'Finish Basement', icon: 'basement' },
  { id: 'pool', label: 'Add Pool', icon: 'pool' },
  { id: 'garage_gym', label: 'Garage Gym', icon: 'gym' },
  { id: 'master_suite', label: 'Master Suite', icon: 'bed' },
  { id: 'solar', label: 'Solar Panels', icon: 'solar' },
  { id: 'deck_patio', label: 'Deck / Patio', icon: 'deck' },
  { id: 'landscaping', label: 'Landscaping', icon: 'tree' },
  { id: 'smart_home', label: 'Smart Home', icon: 'smart' },
  { id: 'adu', label: 'ADU / Guest House', icon: 'house' },
  { id: 'flooring', label: 'New Flooring', icon: 'floor' },
];

function RenoIcon({ type }) {
  switch (type) {
    case 'kitchen':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>;
    case 'bathroom':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/><path d="M4 21l1-1.5"/><path d="M20 21l-1-1.5"/></svg>;
    case 'basement':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/><path d="M9 15v6"/><path d="M15 15v6"/></svg>;
    case 'pool':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 15c6.667-6 13.333 0 20 0"/><path d="M2 19c6.667-6 13.333 0 20 0"/><path d="M9 3v12"/><path d="M15 6v9"/><circle cx="9" cy="3" r="1"/><circle cx="15" cy="3" r="1"/></svg>;
    case 'gym':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><path d="M12 6.5v11"/><rect x="2" y="4" width="4" height="16" rx="1"/><rect x="18" y="4" width="4" height="16" rx="1"/></svg>;
    case 'bed':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v2"/></svg>;
    case 'solar':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>;
    case 'deck':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 6v12"/><path d="M2 12h20"/></svg>;
    case 'tree':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22v-6"/><path d="M12 16l-4-4 2 0-3-4 2 0-3-5h12l-3 5 2 0-3 4 2 0z"/></svg>;
    case 'smart':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>;
    case 'house':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'floor':
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/></svg>;
    default:
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function ListingDetail({ listings, onFavorite, onUnfavorite, isFavorite, preferences, onTrackClick }) {
  const { id } = useParams();
  const location = useLocation();
  const [activePhoto, setActivePhoto] = useState(0);
  const [fullPhotos, setFullPhotos] = useState(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [downPayment, setDownPayment] = useState(20);
  const [investmentData, setInvestmentData] = useState(null);
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [offerData, setOfferData] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [whatIfData, setWhatIfData] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [selectedRenos, setSelectedRenos] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [visionData, setVisionData] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [matchPanelOpen, setMatchPanelOpen] = useState(false);

  // Tour request form state
  const [tourForm, setTourForm] = useState({
    name: '',
    email: '',
    phone: '',
    preferredDate: '',
    preferredTime: '',
    message: '',
  });
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [tourSubmitted, setTourSubmitted] = useState(false);

  const listing = listings.find(l => l.property_id === id) || location.state?.listing || null;
  const backPath = location.state?.from || '/start';

  // AI Match explanation (client-side, deterministic)
  const matchExplanation = useMemo(() => {
    if (!listing || !preferences) return null;
    return generateMatchExplanation(listing, {
      priceMax: preferences.maxPrice || preferences.priceMax,
      beds: preferences.beds,
      baths: preferences.baths,
      sqft: preferences.minSqft,
      city: preferences.city,
    });
  }, [listing, preferences]);

  const listingBadges = useMemo(() => {
    if (!listing) return [];
    return generateBadges(listing, listings);
  }, [listing, listings]);

  const overpricedCheck = useMemo(() => {
    if (!listing) return null;
    return checkOverpriced(listing, listings);
  }, [listing, listings]);

  // Fetch photos on mount
  useEffect(() => {
    if (listing && listing.property_id) {
      setPhotosLoading(true);
      fetch(`${API_BASE}/api/listings/photos/${listing.property_id}`)
        .then(res => res.json())
        .then(data => { if (data.photos && data.photos.length > 0) setFullPhotos(data.photos); })
        .catch(() => {})
        .finally(() => setPhotosLoading(false));
      if (onTrackClick) onTrackClick(listing);
    }
  }, [listing?.property_id]);

  // Fetch Vision analysis on mount
  useEffect(() => {
    if (listing && listing.property_id) {
      setVisionLoading(true);
      fetch(`${API_BASE}/api/vision/analyze-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: listing.property_id,
          photos: listing.photos || [],
          thumbnail: listing.thumbnail,
          address: listing.address,
        }),
      })
        .then(res => res.json())
        .then(data => setVisionData(data))
        .catch(() => {})
        .finally(() => setVisionLoading(false));
    }
  }, [listing?.property_id]);

  // Fetch investment + offer intelligence
  useEffect(() => {
    if (listing && listing.property_id) {
      setInvestmentLoading(true);
      fetch(`${API_BASE}/api/intelligence/property-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: {
            price: listing.price,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            lot_sqft: listing.lot_sqft,
            prop_type: listing.prop_type,
            year_built: listing.year_built,
            address: listing.address,
          },
          city: listing.address?.city || '',
          stateCode: listing.address?.state || '',
        }),
      })
        .then(res => res.json())
        .then(data => setInvestmentData(data))
        .catch(() => {})
        .finally(() => setInvestmentLoading(false));

      setOfferLoading(true);
      fetch(`${API_BASE}/api/intelligence/offer-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: {
            price: listing.price,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            prop_type: listing.prop_type,
          },
          daysOnMarket: listing.list_date
            ? Math.floor((Date.now() - new Date(listing.list_date).getTime()) / 86400000)
            : 30,
        }),
      })
        .then(res => res.json())
        .then(data => setOfferData(data))
        .catch(() => {})
        .finally(() => setOfferLoading(false));
    }
  }, [listing?.property_id]);

  const toggleReno = (renoId) => {
    setSelectedRenos(prev =>
      prev.includes(renoId) ? prev.filter(r => r !== renoId) : [...prev, renoId]
    );
  };

  const runWhatIf = async () => {
    if (selectedRenos.length === 0) return;
    setWhatIfLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/intelligence/what-if`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: { price: listing.price, sqft: listing.sqft, year_built: listing.year_built, prop_type: listing.prop_type },
          renovations: selectedRenos,
        }),
      });
      const data = await res.json();
      setWhatIfData(data);
    } catch (err) {
      console.error('What-if failed:', err);
    } finally {
      setWhatIfLoading(false);
    }
  };

  const handleTourSubmit = async (e) => {
    e.preventDefault();
    if (!tourForm.email) return;
    setTourSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: tourForm.name,
          buyerEmail: tourForm.email,
          buyerPhone: tourForm.phone,
          prompt: tourForm.message || `Tour request for ${listing.address.full} ($${listing.price?.toLocaleString()})`,
          parsedIntent: {
            location: { city: listing.address?.city, state: listing.address?.state },
            budget: { max: listing.price },
            beds: listing.beds,
            baths: listing.baths,
            propertyType: listing.prop_type,
          },
          selectedListings: [{ id: listing.property_id, address: listing.address.full, price: listing.price }],
          source: 'tour_request',
          tourPreferences: {
            preferredDate: tourForm.preferredDate,
            preferredTime: tourForm.preferredTime,
          },
        }),
      });
      const data = await res.json();
      if (data.success) setTourSubmitted(true);
    } catch (err) {
      console.error('Tour request failed:', err);
    } finally {
      setTourSubmitting(false);
    }
  };

  if (!listing) {
    return (
      <div className="detail-not-found">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <h2>Listing not found</h2>
        <p>This listing may no longer be available.</p>
        <Link to={backPath} className="btn-back">Back to Search</Link>
      </div>
    );
  }

  const favorited = isFavorite(listing.property_id);
  const photos = fullPhotos || (listing.photos.length > 0 ? listing.photos : []);
  const monthly = listing.price ? calcMonthly(listing.price, downPayment) : 0;
  const aiAnalysis = generateAIProsCons(listing);
  const aiDecision = getAIDecision(listing.match?.score, investmentData);

  // Derive match score for hero
  const heroMatchScore = matchExplanation?.score || listing.match?.score || 0;
  const heroMatchColor = heroMatchScore >= 75 ? '#22c55e' : heroMatchScore >= 50 ? '#eab308' : '#ef4444';

  // Offer strength derivations for sidebar card
  const offerCompetitiveLevel = offerData
    ? (offerData.suggestedOffer >= listing.price * 0.98 ? 'High' : offerData.suggestedOffer >= listing.price * 0.93 ? 'Medium' : 'Low')
    : null;
  const offerCompetitiveColor = offerCompetitiveLevel === 'High' ? '#22c55e' : offerCompetitiveLevel === 'Medium' ? '#eab308' : '#ef4444';

  // Market snapshot derivations
  const daysOnMarket = listing.list_date
    ? Math.floor((Date.now() - new Date(listing.list_date).getTime()) / 86400000)
    : (offerData?.daysOnMarket || 28);
  const priceTrend = investmentData?.appreciation?.score >= 65 ? 'up' : investmentData?.appreciation?.score >= 40 ? 'flat' : 'down';
  const similarHomesCount = investmentData?.investment ? Math.max(3, Math.min(25, Math.floor((investmentData.smartScore || 50) / 4))) : null;

  return (
    <div className="listing-detail">
      <Link to={backPath} className="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to results
      </Link>

      {/* Immersive Hero Gallery */}
      <div className="detail-gallery">
        <div className="gallery-main">
          {photos.length > 0 ? (
            <img src={photos[activePhoto]} alt={`Property photo ${activePhoto + 1}`} />
          ) : (
            <div className="gallery-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="gallery-placeholder-text">
                {photosLoading ? 'Loading photos...' : 'No photos available'}
              </span>
            </div>
          )}
          {photosLoading && photos.length > 0 && <div className="gallery-loading">Loading HD photos...</div>}

          {/* Gradient overlay for immersive hero */}
          <div className="ld-hero-gradient" />

          {/* Vision Verified badge overlay */}
          {visionData && visionData.overallPhotoScore >= 70 && (
            <div className="vision-verified-badge-overlay">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              Vision Verified
            </div>
          )}

          {/* Floating hero info card */}
          <div className="ld-hero-info">
            <div className="ld-hero-info-left">
              <div className="ld-hero-price">${listing.price?.toLocaleString() || 'N/A'}</div>
              <div className="ld-hero-address">{listing.address.full}</div>
              <div className="ld-hero-monthly">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
                Est. ${monthly.toLocaleString()}/mo
              </div>
            </div>
            <div className="ld-hero-match-gauge">
              <svg viewBox="0 0 80 80" width="68" height="68">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={heroMatchColor}
                  strokeWidth="5"
                  strokeDasharray={`${(heroMatchScore / 100) * 213.6} 213.6`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="ld-hero-match-value">{heroMatchScore}</div>
              <div className="ld-hero-match-label">Match</div>
            </div>
          </div>

          {/* Listing badges */}
          {listingBadges.length > 0 && (
            <div className="ld-hero-badges">
              {listingBadges.map((badge, i) => (
                <span key={i} className={`ld-hero-badge ld-hero-badge--${badge.type}`} title={badge.tooltip}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button className="gallery-nav gallery-prev" onClick={() => setActivePhoto(p => (p - 1 + photos.length) % photos.length)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className="gallery-nav gallery-next" onClick={() => setActivePhoto(p => (p + 1) % photos.length)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <div className="gallery-counter">{activePhoto + 1} / {photos.length}</div>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="gallery-thumbs">
            {photos.slice(0, 8).map((url, i) => (
              <button key={i} className={`thumb ${i === activePhoto ? 'active' : ''}`} onClick={() => setActivePhoto(i)}>
                <img src={url} alt={`Thumb ${i + 1}`} />
              </button>
            ))}
            {photos.length > 8 && <span className="thumb-more">+{photos.length - 8}</span>}
          </div>
        )}
      </div>

      <div className="detail-content">
        <div className="detail-main">
          {/* Header (simplified since hero has price/address) */}
          <div className="detail-header">
            <div>
              <h1 className="detail-price">${listing.price?.toLocaleString() || 'N/A'}</h1>
              <p className="detail-address">{listing.address.full}</p>
            </div>
            <div className="detail-actions">
              <button className={`btn-favorite-lg ${favorited ? 'favorited' : ''}`} onClick={() => favorited ? onUnfavorite(listing.property_id) : onFavorite(listing)}>
                {favorited ? '\u2665 Saved' : '\u2661 Save'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="detail-stats">
            <div className="stat-item"><span className="stat-value">{listing.beds}</span><span className="stat-label">Beds</span></div>
            <div className="stat-item"><span className="stat-value">{listing.baths}</span><span className="stat-label">Baths</span></div>
            {listing.sqft > 0 && <div className="stat-item"><span className="stat-value">{listing.sqft.toLocaleString()}</span><span className="stat-label">Sq Ft</span></div>}
            <div className="stat-item"><span className="stat-value" style={{ textTransform: 'capitalize' }}>{listing.prop_type.replace(/_/g, ' ')}</span><span className="stat-label">Type</span></div>
            {listing.lot_sqft > 0 && <div className="stat-item"><span className="stat-value">{listing.lot_sqft.toLocaleString()}</span><span className="stat-label">Lot Sq Ft</span></div>}
          </div>

          {/* "Why This Home Matches You" Expandable Panel */}
          {matchExplanation && (
            <div className={`ld-match-panel ${matchPanelOpen ? 'ld-match-panel--open' : ''}`}>
              <button className="ld-match-panel-toggle" onClick={() => setMatchPanelOpen(prev => !prev)}>
                <div className="ld-match-panel-toggle-left">
                  <div className="ld-match-panel-mini-gauge">
                    <svg viewBox="0 0 40 40" width="32" height="32">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="20" cy="20" r="16" fill="none"
                        stroke={heroMatchColor}
                        strokeWidth="3"
                        strokeDasharray={`${(matchExplanation.score / 100) * 100.5} 100.5`}
                        strokeLinecap="round"
                        transform="rotate(-90 20 20)"
                      />
                    </svg>
                    <span className="ld-match-panel-mini-score">{matchExplanation.score}</span>
                  </div>
                  <div className="ld-match-panel-toggle-text">
                    <span className="ld-match-panel-title">Why This Home Matches You</span>
                    <span className="ld-match-panel-headline">{matchExplanation.headline}</span>
                  </div>
                </div>
                <svg className={`ld-match-panel-chevron ${matchPanelOpen ? 'ld-match-panel-chevron--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div className="ld-match-panel-body" style={{ maxHeight: matchPanelOpen ? '600px' : '0px' }}>
                <div className="ld-match-panel-body-inner">
                  {/* Score gauge */}
                  <div className="ld-match-gauge-row">
                    <div className="ld-match-gauge-large">
                      <svg viewBox="0 0 100 100" width="90" height="90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={heroMatchColor}
                          strokeWidth="6"
                          strokeDasharray={`${(matchExplanation.score / 100) * 263.9} 263.9`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="ld-match-gauge-center">
                        <span className="ld-match-gauge-number">{matchExplanation.score}</span>
                        <span className="ld-match-gauge-label">/ 100</span>
                      </div>
                    </div>
                    <div className="ld-match-gauge-info">
                      <h4 className="ld-match-gauge-headline">{matchExplanation.headline}</h4>
                      {overpricedCheck && overpricedCheck.overpriced && (
                        <div className="ld-overpriced-warning">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <span>{overpricedCheck.reasoning}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reasons */}
                  {matchExplanation.reasons.length > 0 && (
                    <div className="ld-match-reasons">
                      <h5 className="ld-match-section-label">What works for you</h5>
                      {matchExplanation.reasons.map((reason, i) => (
                        <div key={i} className="ld-match-reason-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Concerns */}
                  {matchExplanation.concerns.length > 0 && (
                    <div className="ld-match-concerns">
                      <h5 className="ld-match-section-label">Things to consider</h5>
                      {matchExplanation.concerns.map((concern, i) => (
                        <div key={i} className="ld-match-concern-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <span>{concern}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vision Verified Section */}
          <div className="vision-verified-section">
            {visionLoading ? (
              <div className="vision-loading">
                <span className="intel-spinner" />
                Analyzing property photos...
              </div>
            ) : visionData ? (
              <div className="vision-results">
                <div className="vision-header">
                  <div className="vision-title-row">
                    <h3>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Photo Verification
                    </h3>
                    {visionData.overallPhotoScore >= 70 && (
                      <span className="vision-verified-inline-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                        Vision Verified
                      </span>
                    )}
                  </div>
                  <div className="vision-score-bar-wrap">
                    <div className="vision-score-label">Photo Score: <strong>{visionData.overallPhotoScore}/100</strong></div>
                    <div className="vision-score-bar">
                      <div
                        className={`vision-score-fill ${visionData.overallPhotoScore >= 70 ? 'high' : visionData.overallPhotoScore >= 40 ? 'mid' : 'low'}`}
                        style={{ width: `${visionData.overallPhotoScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Vision Tags */}
                {visionData.tags && visionData.tags.length > 0 && (
                  <div className="vision-tags">
                    {visionData.tags.map((tag, i) => (
                      <span key={i} className="vision-tag">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Vision Notes / Insights */}
                {visionData.notes && visionData.notes.length > 0 && (
                  <div className="vision-notes">
                    {visionData.notes.map((note, i) => (
                      <div key={i} className="vision-note">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Intelligence Tabs */}
          <div className="intel-tabs">
            {[
              { id: 'overview', label: 'Overview', iconSvg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
              { id: 'insights', label: 'AI Insights', iconSvg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              { id: 'renovate', label: 'Renovations', iconSvg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
            ].map(tab => (
              <button
                key={tab.id}
                className={`intel-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="ld-tab-icon">{tab.iconSvg}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* AI Pros & Cons */}
              <div className="ai-analysis">
                <h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  AI Analysis
                </h3>
                <div className="pros-cons">
                  <div className="pros">
                    <h4>Pros</h4>
                    {aiAnalysis.pros.map((p, i) => (
                      <div key={i} className="pro-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className="cons">
                    <h4>Considerations</h4>
                    {aiAnalysis.cons.map((c, i) => (
                      <div key={i} className="con-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {listing.description && (
                <div className="detail-description">
                  <h3>About this property</h3>
                  <p>{listing.description}</p>
                </div>
              )}

              {listing.rdc_web_url && (
                <a href={listing.rdc_web_url} target="_blank" rel="noopener noreferrer" className="btn-external">
                  View full listing
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              )}
            </>
          )}

          {/* AI Insights Tab (combined Investment Intel + Offer Strategy) */}
          {activeTab === 'insights' && (
            <div className="intel-section">
              {investmentLoading && offerLoading ? (
                <div className="intel-loading">
                  <span className="intel-spinner" />
                  Analyzing investment potential and market conditions...
                </div>
              ) : (
                <>
                  {/* Investment Intelligence */}
                  {investmentLoading ? (
                    <div className="intel-loading">
                      <span className="intel-spinner" />
                      Analyzing investment potential...
                    </div>
                  ) : investmentData ? (
                    <>
                      {/* Appreciation Prediction */}
                      <div className="intel-card appreciation-card">
                        <div className="intel-card-header">
                          <h3>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            Future Value Prediction
                          </h3>
                          <div className={`appreciation-badge ${investmentData.appreciation?.score >= 70 ? 'strong' : investmentData.appreciation?.score >= 50 ? 'moderate' : 'low'}`}>
                            {investmentData.appreciation?.label || 'Analyzing'}
                          </div>
                        </div>
                        <div className="appreciation-score-bar">
                          <div className="appreciation-fill" style={{ width: `${investmentData.appreciation?.score || 0}%` }} />
                        </div>
                        <div className="appreciation-details">
                          <div className="appreciation-stat">
                            <span className="appreciation-label">5-Year Estimate</span>
                            <span className="appreciation-value">{investmentData.appreciation?.fiveYearEstimate || 'N/A'}</span>
                          </div>
                          <div className="appreciation-stat">
                            <span className="appreciation-label">Confidence</span>
                            <span className="appreciation-value">{investmentData.appreciation?.score || 0}%</span>
                          </div>
                        </div>
                        <p className="appreciation-reasoning">{investmentData.appreciation?.reasoning}</p>
                      </div>

                      {/* Investment Metrics */}
                      <div className="intel-card">
                        <h3>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                          Investment Metrics
                        </h3>
                        <div className="metrics-grid">
                          <div className="metric-item">
                            <span className="metric-value">${investmentData.investment?.pricePerSqft || 0}</span>
                            <span className="metric-label">Price/Sq Ft</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">${(investmentData.investment?.estMonthlyRent || 0).toLocaleString()}</span>
                            <span className="metric-label">Est. Monthly Rent</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">{investmentData.investment?.grossYield || 0}%</span>
                            <span className="metric-label">Gross Yield</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">{investmentData.investment?.capRateEstimate || 0}%</span>
                            <span className="metric-label">Cap Rate Est.</span>
                          </div>
                        </div>
                      </div>

                      {/* Smart Score */}
                      <div className="intel-card">
                        <h3>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><path d="M9 21h6"/><path d="M10 17v4"/><path d="M14 17v4"/></svg>
                          AI Smart Score
                        </h3>
                        <div className="smart-score-display">
                          <div className="smart-score-circle">
                            <svg viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                              <circle cx="50" cy="50" r="45" fill="none" stroke={investmentData.smartScore >= 70 ? '#22c55e' : investmentData.smartScore >= 50 ? '#eab308' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(investmentData.smartScore || 0) * 2.83} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                            </svg>
                            <span className="smart-score-number">{investmentData.smartScore || 0}</span>
                          </div>
                          <div className="smart-score-insights">
                            {investmentData.areaInsights && investmentData.areaInsights.map((insight, i) => (
                              <div key={i} className="smart-insight">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                                {insight}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Top Renovation Suggestions from investment data */}
                      {investmentData.renovationPotential && (
                        <div className="intel-card">
                          <h3>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                            Renovation Potential
                          </h3>
                          <div className="reno-suggestions">
                            {investmentData.renovationPotential.suggestions?.map((s, i) => (
                              <div key={i} className="reno-suggestion">
                                <div className="reno-suggestion-header">
                                  <span className="reno-project">{s.project}</span>
                                  <span className="reno-roi">{s.roi} ROI</span>
                                </div>
                                <div className="reno-costs">
                                  <span>Cost: {s.cost}</span>
                                  <span>Value Added: {s.valueAdd}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="intel-empty">Unable to load investment data</div>
                  )}

                  {/* Offer Strategy Section (merged into AI Insights) */}
                  {offerLoading ? (
                    <div className="intel-loading" style={{ marginTop: '1rem' }}>
                      <span className="intel-spinner" />
                      Analyzing market conditions...
                    </div>
                  ) : offerData ? (
                    <>
                      {/* Suggested offer */}
                      <div className="intel-card offer-card">
                        <h3>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                          AI Offer Strategy
                        </h3>
                        <div className="offer-main">
                          <div className="offer-suggested">
                            <span className="offer-label">Suggested Opening Offer</span>
                            <span className="offer-price">${(offerData.suggestedOffer || 0).toLocaleString()}</span>
                          </div>
                          <div className="offer-range">
                            <div className="offer-range-item">
                              <span className="range-label">Low Ball</span>
                              <span className="range-value">${(offerData.offerRange?.low || 0).toLocaleString()}</span>
                            </div>
                            <div className="offer-range-item fair">
                              <span className="range-label">Fair Offer</span>
                              <span className="range-value">${(offerData.offerRange?.fair || 0).toLocaleString()}</span>
                            </div>
                            <div className="offer-range-item">
                              <span className="range-label">Competitive</span>
                              <span className="range-value">${(offerData.offerRange?.aggressive || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Escalation clause */}
                      {offerData.escalationClause?.suggested && (
                        <div className="intel-card">
                          <h3>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            Escalation Clause
                          </h3>
                          <p className="offer-escalation-text">
                            Offer ${(offerData.suggestedOffer || 0).toLocaleString()} with automatic escalation of ${(offerData.escalationClause.increment || 0).toLocaleString()} increments, capped at ${(offerData.escalationClause.cap || 0).toLocaleString()}.
                          </p>
                        </div>
                      )}

                      {/* Seller motivation */}
                      {offerData.sellerMotivation && (
                        <div className="intel-card">
                          <h3>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                            Seller Motivation
                          </h3>
                          <div className={`motivation-badge ${offerData.sellerMotivation.level}`}>
                            {offerData.sellerMotivation.level === 'high' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0118 11a6 6 0 01-12 0c0-2 .5-3 2-5 .5-.5 1.5-1.5 2-3a1 1 0 012-.5z"/></svg>
                            ) : offerData.sellerMotivation.level === 'moderate' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-10"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4l3 8 4-16 3 8h4"/></svg>
                            )}
                            {' '}{(offerData.sellerMotivation.level || 'unknown').charAt(0).toUpperCase() + (offerData.sellerMotivation.level || '').slice(1)} Motivation
                          </div>
                          <div className="motivation-signals">
                            {offerData.sellerMotivation.signals?.map((s, i) => (
                              <div key={i} className="motivation-signal">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4"/></svg>
                                {' '}{s}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Negotiation tips */}
                      {offerData.tips && (
                        <div className="intel-card">
                          <h3>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><path d="M9 21h6"/></svg>
                            Negotiation Tips
                          </h3>
                          <div className="offer-tips">
                            {offerData.tips.map((tip, i) => (
                              <div key={i} className="offer-tip">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                                {tip}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* Renovations Tab (formerly What-If) */}
          {activeTab === 'renovate' && (
            <div className="intel-section">
              <div className="intel-card">
                <h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                  Renovation Simulator
                </h3>
                <p className="whatif-subtitle">Select renovations to see how they affect your property value</p>
                <div className="reno-options-grid">
                  {RENOVATION_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      className={`reno-option ${selectedRenos.includes(opt.id) ? 'active' : ''}`}
                      onClick={() => toggleReno(opt.id)}
                    >
                      <span className="reno-opt-icon"><RenoIcon type={opt.icon} /></span>
                      <span className="reno-opt-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="btn-run-whatif"
                  onClick={runWhatIf}
                  disabled={selectedRenos.length === 0 || whatIfLoading}
                >
                  {whatIfLoading ? 'Calculating...' : `Simulate ${selectedRenos.length} Renovation${selectedRenos.length !== 1 ? 's' : ''}`}
                </button>
              </div>

              {whatIfData && (
                <div className="whatif-results">
                  {/* Value comparison */}
                  <div className="intel-card whatif-summary">
                    <div className="whatif-comparison">
                      <div className="whatif-before">
                        <span className="whatif-label">Current Value</span>
                        <span className="whatif-amount">${(whatIfData.currentValue || 0).toLocaleString()}</span>
                      </div>
                      <div className="whatif-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                      </div>
                      <div className="whatif-after">
                        <span className="whatif-label">After Renovation</span>
                        <span className="whatif-amount">${(whatIfData.newValueEstimate?.high || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="whatif-stats-row">
                      <div className="whatif-stat">
                        <span className="whatif-stat-label">Total Cost</span>
                        <span className="whatif-stat-value">${(whatIfData.totalCostRange?.low || 0).toLocaleString()} - ${(whatIfData.totalCostRange?.high || 0).toLocaleString()}</span>
                      </div>
                      <div className="whatif-stat">
                        <span className="whatif-stat-label">ROI</span>
                        <span className="whatif-stat-value whatif-roi">{whatIfData.totalROI || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Individual renovations breakdown */}
                  {whatIfData.renovations && whatIfData.renovations.map(reno => (
                    <div key={reno.id} className="intel-card reno-detail-card">
                      <div className="reno-detail-header">
                        <span className="reno-detail-icon"><RenoIcon type={reno.icon || reno.id} /></span>
                        <span className="reno-detail-name">{reno.label}</span>
                        <span className="reno-detail-time">{reno.timeWeeks} weeks</span>
                      </div>
                      <div className="reno-detail-bars">
                        <div className="reno-bar-row">
                          <span className="reno-bar-label">Cost</span>
                          <span className="reno-bar-value">${reno.costLow?.toLocaleString()} - ${reno.costHigh?.toLocaleString()}</span>
                        </div>
                        <div className="reno-bar-row">
                          <span className="reno-bar-label">Value Add</span>
                          <span className="reno-bar-value value-add">+${reno.valueAddLow?.toLocaleString()} - ${reno.valueAddHigh?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {whatIfData.aiAdvice && (
                    <div className="intel-card whatif-advice">
                      <span className="whatif-advice-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><path d="M9 21h6"/></svg>
                      </span>
                      <p>{whatIfData.aiAdvice}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          {/* AI Decision Score */}
          <div className="sidebar-card decision-score-card">
            <h3>AI Decision Score</h3>
            <div className="decision-score-display">
              <div className="decision-score-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={aiDecision.color}
                    strokeWidth="8"
                    strokeDasharray={`${(aiDecision.score) * 2.83} 283`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="decision-score-number">{aiDecision.score}</span>
              </div>
              <div className="decision-recommendation" style={{ color: aiDecision.color }}>
                {aiDecision.recommendation}
              </div>
              <p className="decision-label">{aiDecision.label}</p>
              <p className="ld-ai-disclaimer">AI scores are educational estimates, not professional advice.</p>
            </div>

            {/* Match score breakdown (compact) */}
            {listing.match && (
              <div className="decision-match-detail">
                <MatchScore score={listing.match.score} showBreakdown={true} breakdown={listing.match.breakdown} />
              </div>
            )}
          </div>

          {/* Offer Strength Simulator */}
          <div className="sidebar-card ld-offer-strength-card">
            <h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              Offer Strength
            </h3>
            {offerData ? (
              <div className="ld-offer-strength-body">
                <div className="ld-offer-strength-price">
                  <span className="ld-offer-strength-label">Suggested Offer</span>
                  <span className="ld-offer-strength-value">${(offerData.suggestedOffer || 0).toLocaleString()}</span>
                </div>
                <div className="ld-offer-strength-level-row">
                  <span className="ld-offer-strength-level-label">Competitive Level</span>
                  <span className="ld-offer-strength-level-badge" style={{ background: offerCompetitiveColor + '18', color: offerCompetitiveColor }}>
                    {offerCompetitiveLevel}
                  </span>
                </div>
                <div className="ld-offer-strength-risk">
                  <span className="ld-offer-strength-risk-label">Risk Indicator</span>
                  <div className="ld-offer-risk-bar">
                    <div className="ld-offer-risk-fill" style={{
                      width: offerCompetitiveLevel === 'High' ? '30%' : offerCompetitiveLevel === 'Medium' ? '60%' : '85%',
                      background: offerCompetitiveLevel === 'High' ? '#22c55e' : offerCompetitiveLevel === 'Medium' ? '#eab308' : '#ef4444',
                    }} />
                  </div>
                  <span className="ld-offer-risk-note">
                    {offerCompetitiveLevel === 'High' ? 'Low risk' : offerCompetitiveLevel === 'Medium' ? 'Moderate risk' : 'Higher risk'}
                  </span>
                </div>
                <p className="ld-ai-disclaimer">This estimate is for educational purposes based on available data. Final strategy should be reviewed with your licensed HomeMatch Partner Agent.</p>
              </div>
            ) : (
              <div className="ld-offer-strength-skeleton">
                <div className="ld-skeleton-line ld-skeleton-lg" />
                <div className="ld-skeleton-line ld-skeleton-md" />
                <div className="ld-skeleton-line ld-skeleton-sm" />
              </div>
            )}
          </div>

          {/* Tour Request CTA */}
          <div className="sidebar-card tour-request-card">
            {tourSubmitted ? (
              <div className="tour-success">
                <div className="tour-success-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <h3>Tour Requested!</h3>
                <p className="tour-success-text">We'll confirm your tour within a few hours. A local expert will reach out to finalize details.</p>
              </div>
            ) : (
              <form onSubmit={handleTourSubmit} className="tour-request-form">
                <h3>Request a Tour</h3>
                <p className="tour-subtitle">See this home in person. A verified HomeMatch Partner Agent will confirm your visit.</p>
                <p className="ld-ai-disclaimer" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>Complete your <Link to="/start">buyer qualification</Link> for priority scheduling.</p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={tourForm.name}
                  onChange={e => setTourForm(f => ({ ...f, name: e.target.value }))}
                  className="lead-input"
                />
                <input
                  type="email"
                  placeholder="Email address *"
                  value={tourForm.email}
                  onChange={e => setTourForm(f => ({ ...f, email: e.target.value }))}
                  className="lead-input"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={tourForm.phone}
                  onChange={e => setTourForm(f => ({ ...f, phone: e.target.value }))}
                  className="lead-input"
                />
                <div className="tour-datetime-row">
                  <input
                    type="date"
                    value={tourForm.preferredDate}
                    onChange={e => setTourForm(f => ({ ...f, preferredDate: e.target.value }))}
                    className="lead-input"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <select
                    value={tourForm.preferredTime}
                    onChange={e => setTourForm(f => ({ ...f, preferredTime: e.target.value }))}
                    className="lead-input"
                  >
                    <option value="">Preferred time</option>
                    <option value="morning">Morning (9am-12pm)</option>
                    <option value="afternoon">Afternoon (12pm-4pm)</option>
                    <option value="evening">Evening (4pm-7pm)</option>
                  </select>
                </div>
                <textarea
                  placeholder="Any questions or notes for the agent?"
                  value={tourForm.message}
                  onChange={e => setTourForm(f => ({ ...f, message: e.target.value }))}
                  className="lead-textarea"
                  rows={3}
                />
                <button type="submit" className="btn-tour-request" disabled={tourSubmitting || !tourForm.email}>
                  {tourSubmitting ? 'Submitting...' : 'Request a Tour'}
                </button>
              </form>
            )}
          </div>

          {/* Monthly payment calculator */}
          {listing.price > 0 && (
            <div className="sidebar-card calculator-card">
              <h3>Est. Monthly Payment</h3>
              <div className="calc-amount">${monthly.toLocaleString()}<span>/mo</span></div>
              <div className="calc-slider">
                <label>Down Payment: {downPayment}%</label>
                <input type="range" min="5" max="50" step="5" value={downPayment} onChange={e => setDownPayment(Number(e.target.value))} />
                <div className="calc-details">
                  <span>Down: ${(listing.price * downPayment / 100).toLocaleString()}</span>
                  <span>Loan: ${(listing.price * (1 - downPayment / 100)).toLocaleString()}</span>
                </div>
              </div>
              <p className="calc-note">Based on 6.5% rate, 30-year fixed</p>
            </div>
          )}

          {/* Quick facts */}
          <div className="sidebar-card">
            <h3>Quick Facts</h3>
            <div className="quick-facts">
              {listing.mls_id && <div className="fact-row"><span>MLS #</span><span>{listing.mls_id}</span></div>}
              <div className="fact-row"><span>Property ID</span><span>{listing.property_id}</span></div>
              {listing.list_date && <div className="fact-row"><span>Listed</span><span>{new Date(listing.list_date).toLocaleDateString()}</span></div>}
            </div>
          </div>

          {/* Market Snapshot */}
          <div className="sidebar-card ld-market-snapshot-card">
            <h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-10"/></svg>
              Market Snapshot
            </h3>
            <div className="ld-market-snapshot-body">
              <div className="ld-market-snapshot-item">
                <div className="ld-market-snapshot-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="ld-market-snapshot-info">
                  <span className="ld-market-snapshot-value">{daysOnMarket} days</span>
                  <span className="ld-market-snapshot-label">Avg. days on market</span>
                </div>
              </div>
              <div className="ld-market-snapshot-item">
                <div className="ld-market-snapshot-icon">
                  {priceTrend === 'up' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M7 17l9.2-9.2M17 17V7.8H7.8"/></svg>
                  ) : priceTrend === 'down' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M7 7l9.2 9.2M17 7v9.2H7.8"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  )}
                </div>
                <div className="ld-market-snapshot-info">
                  <span className="ld-market-snapshot-value" style={{ color: priceTrend === 'up' ? '#22c55e' : priceTrend === 'down' ? '#ef4444' : '#eab308' }}>
                    {priceTrend === 'up' ? 'Trending Up' : priceTrend === 'down' ? 'Trending Down' : 'Stable'}
                  </span>
                  <span className="ld-market-snapshot-label">Price trend</span>
                </div>
              </div>
              {similarHomesCount !== null && (
                <div className="ld-market-snapshot-item">
                  <div className="ld-market-snapshot-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div className="ld-market-snapshot-info">
                    <span className="ld-market-snapshot-value">{similarHomesCount} homes</span>
                    <span className="ld-market-snapshot-label">Similar nearby</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListingDetail;
