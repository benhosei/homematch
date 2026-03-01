import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateFavorites } from '../utils/userApi';

export function useFavorites() {
  const { user } = useAuth();

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('reFavorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Exposed for the sync-on-login flow in App.jsx
  const setFavoritesFromSync = useCallback((favs) => {
    setFavorites(favs);
  }, []);

  const persistFavorites = useCallback((next) => {
    if (user) {
      updateFavorites(next).catch((err) => console.error('Failed to sync favorites:', err));
    } else {
      localStorage.setItem('reFavorites', JSON.stringify(next));
    }
  }, [user]);

  const addFavorite = useCallback((listing) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.property_id === listing.property_id)) {
        return prev;
      }
      const next = [...prev, listing];
      persistFavorites(next);
      return next;
    });
  }, [persistFavorites]);

  const removeFavorite = useCallback((propertyId) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.property_id !== propertyId);
      persistFavorites(next);
      return next;
    });
  }, [persistFavorites]);

  const isFavorite = useCallback(
    (propertyId) => favorites.some((f) => f.property_id === propertyId),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, setFavoritesFromSync };
}
