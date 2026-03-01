import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updatePreferences as syncPreferences } from '../utils/userApi';

const DEFAULT_PREFS = {
  city: '',
  stateCode: '',
  priceMin: '',
  priceMax: '',
  beds: '',
  baths: '',
  propType: '',
};

export function usePreferences() {
  const { user } = useAuth();
  const debounceRef = useRef(null);

  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('rePreferences');
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const updatePreferences = useCallback((updates) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      if (user) {
        // Debounce Firestore writes (1 second) to avoid per-keystroke API calls
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          syncPreferences(next).catch((err) => console.error('Failed to sync preferences:', err));
        }, 1000);
      } else {
        localStorage.setItem('rePreferences', JSON.stringify(next));
      }
      return next;
    });
  }, [user]);

  const resetPreferences = useCallback(() => {
    if (user) {
      syncPreferences(null).catch((err) => console.error('Failed to reset preferences:', err));
    } else {
      localStorage.removeItem('rePreferences');
    }
    setPreferences(DEFAULT_PREFS);
  }, [user]);

  return { preferences, updatePreferences, resetPreferences };
}
