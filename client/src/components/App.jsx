import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import HomePage from './HomePage';
import StartWizard from './StartWizard';
import PreferenceForm from './PreferenceForm';
import SearchResults from './SearchResults';
import Favorites from './Favorites';
import ListingDetail from './ListingDetail';
import AIAssistant from './AIAssistant';
import AgentDashboard from './AgentDashboard';
import LoginPage from './LoginPage';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import VerifyTour from './VerifyTour';
import OwnerDashboard from './OwnerDashboard';
import { usePreferences } from '../hooks/usePreferences';
import { useListings } from '../hooks/useListings';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../contexts/AuthContext';
import { loadUserData, saveUserData, updateSavedSearches, updateClickHistory } from '../utils/userApi';
import './App.css';

// ─── Merge helpers ──────────────────────────────────────────────────

function mergeFavorites(cloud, local) {
  const ids = new Set(cloud.map(f => f.property_id));
  const newFromLocal = local.filter(f => !ids.has(f.property_id));
  return [...cloud, ...newFromLocal];
}

function mergeSavedSearches(cloud, local) {
  const ids = new Set(cloud.map(s => s.id));
  const newFromLocal = local.filter(s => !ids.has(s.id));
  return [...cloud, ...newFromLocal].slice(0, 20);
}

function mergeClickHistory(cloud, local) {
  const all = [...cloud, ...local];
  const seen = new Set();
  const deduped = all.filter(entry => {
    if (seen.has(entry.ts)) return false;
    seen.add(entry.ts);
    return true;
  });
  return deduped.sort((a, b) => b.ts - a.ts).slice(0, 50);
}

// ─── App Content ────────────────────────────────────────────────────

function AppContent() {
  const { user } = useAuth();
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { listings, total, loading, error, search } = useListings();
  const { favorites, addFavorite, removeFavorite, isFavorite, setFavoritesFromSync } = useFavorites();
  const [showAssistant, setShowAssistant] = useState(false);
  const [lastAINote, setLastAINote] = useState(null);
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hm_saved_searches') || '[]'); }
    catch { return []; }
  });
  const [clickHistory, setClickHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hm_click_history') || '[]'); }
    catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const prevUserRef = useRef(null);

  // ── Merge-on-login: sync localStorage data to Firestore ──
  useEffect(() => {
    if (!user) {
      if (prevUserRef.current) {
        const localFavs = JSON.parse(localStorage.getItem('reFavorites') || '[]');
        const localSearches = JSON.parse(localStorage.getItem('hm_saved_searches') || '[]');
        const localHistory = JSON.parse(localStorage.getItem('hm_click_history') || '[]');
        setFavoritesFromSync(localFavs);
        setSavedSearches(localSearches);
        setClickHistory(localHistory);
      }
      prevUserRef.current = user;
      return;
    }
    if (prevUserRef.current?.uid === user.uid) return;
    prevUserRef.current = user;

    async function syncOnLogin() {
      setSyncing(true);
      try {
        const cloudData = await loadUserData();
        const localFavs = JSON.parse(localStorage.getItem('reFavorites') || '[]');
        const localPrefs = JSON.parse(localStorage.getItem('rePreferences') || 'null');
        const localSearches = JSON.parse(localStorage.getItem('hm_saved_searches') || '[]');
        const localHistory = JSON.parse(localStorage.getItem('hm_click_history') || '[]');
        const mergedFavs = mergeFavorites(cloudData.favorites || [], localFavs);
        const mergedPrefs = cloudData.preferences || localPrefs;
        const mergedSearches = mergeSavedSearches(cloudData.savedSearches || [], localSearches);
        const mergedHistory = mergeClickHistory(cloudData.clickHistory || [], localHistory);
        await saveUserData({ favorites: mergedFavs, preferences: mergedPrefs, savedSearches: mergedSearches, clickHistory: mergedHistory });
        setFavoritesFromSync(mergedFavs);
        if (mergedPrefs) updatePreferences(mergedPrefs);
        setSavedSearches(mergedSearches);
        setClickHistory(mergedHistory);
        localStorage.removeItem('reFavorites');
        localStorage.removeItem('rePreferences');
        localStorage.removeItem('hm_saved_searches');
        localStorage.removeItem('hm_click_history');
      } catch (err) {
        console.error('Sync on login failed:', err);
      } finally {
        setSyncing(false);
      }
    }
    syncOnLogin();
  }, [user?.uid]); // eslint-disable-line

  const trackClick = useCallback((listing) => {
    const entry = { price: listing.price, beds: listing.beds, baths: listing.baths, sqft: listing.sqft, propType: listing.prop_type, ts: Date.now() };
    setClickHistory(prev => {
      const updated = [...prev, entry].slice(-50);
      if (user) { updateClickHistory(updated).catch(console.error); }
      else { localStorage.setItem('hm_click_history', JSON.stringify(updated)); }
      return updated;
    });
  }, [user]);

  const saveSearch = useCallback((prompt, params, features) => {
    const entry = { prompt, params, features, ts: Date.now(), id: Date.now().toString() };
    setSavedSearches(prev => {
      const updated = [entry, ...prev].slice(0, 20);
      if (user) { updateSavedSearches(updated).catch(console.error); }
      else { localStorage.setItem('hm_saved_searches', JSON.stringify(updated)); }
      return updated;
    });
  }, [user]);

  const deleteSavedSearch = useCallback((id) => {
    setSavedSearches(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (user) { updateSavedSearches(updated).catch(console.error); }
      else { localStorage.setItem('hm_saved_searches', JSON.stringify(updated)); }
      return updated;
    });
  }, [user]);

  const handleSearch = useCallback((features = []) => {
    if (preferences.city && preferences.stateCode) { setLastAINote(null); search(preferences, features); }
  }, [preferences, search]);

  const handleAIPromptSearch = useCallback((searchParams, features = [], aiNote = null) => {
    if (searchParams.city && searchParams.stateCode) { setLastAINote(aiNote); search(searchParams, features); }
  }, [search]);

  const handleAssistantSearch = useCallback((searchParams) => {
    updatePreferences(searchParams);
    setShowAssistant(false);
    navigate('/homes');
    setTimeout(() => { search(searchParams); }, 100);
  }, [updatePreferences, search, navigate]);

  return (
    <div className="app">
      <Navbar favoritesCount={favorites.length} />

      {syncing && (
        <div className="sync-overlay">
          <div className="sync-message">
            <span className="sync-spinner" />
            Syncing your data...
          </div>
        </div>
      )}

      <main>
        <Routes>
          {/* New primary pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/start" element={<StartWizard />} />

          {/* Browse homes (old search, now secondary) */}
          <Route
            path="/homes"
            element={
              <div className="main-content">
                <PreferenceForm
                  preferences={preferences}
                  onChange={updatePreferences}
                  onReset={resetPreferences}
                  onSearch={handleSearch}
                  onAISearch={handleAIPromptSearch}
                  onSaveSearch={saveSearch}
                  savedSearches={savedSearches}
                  onDeleteSavedSearch={deleteSavedSearch}
                  loading={loading}
                  clickHistory={clickHistory}
                />
                <SearchResults
                  listings={listings}
                  total={total}
                  loading={loading}
                  error={error}
                  onFavorite={addFavorite}
                  onUnfavorite={removeFavorite}
                  isFavorite={isFavorite}
                  aiNote={lastAINote}
                  onCardClick={trackClick}
                />
              </div>
            }
          />

          {/* Listing detail */}
          <Route
            path="/listing/:id"
            element={
              <div className="main-content">
                <ListingDetail
                  listings={listings}
                  onFavorite={addFavorite}
                  onUnfavorite={removeFavorite}
                  isFavorite={isFavorite}
                  preferences={preferences}
                  onTrackClick={trackClick}
                />
              </div>
            }
          />

          {/* Saved / Favorites */}
          <Route
            path="/favorites"
            element={
              <div className="main-content">
                <Favorites
                  favorites={favorites}
                  preferences={preferences}
                  onRemove={removeFavorite}
                />
              </div>
            }
          />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Agent dashboard (internal) */}
          <Route path="/agent" element={<div className="main-content"><AgentDashboard /></div>} />

          {/* Owner dashboard (internal) */}
          <Route path="/owner" element={<div className="main-content"><OwnerDashboard /></div>} />

          {/* Tour verification (from email link) */}
          <Route path="/verify/:leadId" element={<VerifyTour />} />

          {/* Legal pages */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </main>

      {/* Floating AI assistant */}
      <button className="ai-trigger" onClick={() => setShowAssistant(true)} title="AI Assistant">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>

      <AIAssistant
        isOpen={showAssistant}
        onClose={() => setShowAssistant(false)}
        onApplySearch={handleAssistantSearch}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
