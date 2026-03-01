import { useState, useCallback } from 'react';
import { searchListings } from '../utils/api';

export function useListings() {
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (preferences, features = []) => {
    setLoading(true);
    setError(null);
    try {
      // Map feature IDs to keyword strings for the API
      const featureKeywordMap = {
        pool: 'pool',
        gym: 'gym',
        garage: 'garage',
        fireplace: 'fireplace',
        basement: 'basement',
        hardwood: 'hardwood floors',
        solar: 'solar panels',
        smart_home: 'smart home',
        office: 'home office',
        open_floor: 'open floor plan',
        patio: 'patio deck',
        yard: 'large yard',
        updated_kitchen: 'modern kitchen',
        walk_in_closet: 'walk-in closet',
        laundry: 'laundry',
        heated_floors: 'heated floors',
        ev_charger: 'ev charger',
        waterfront: 'waterfront',
      };

      const keywords = features.map(f => featureKeywordMap[f]).filter(Boolean).join(', ');
      const hasPool = features.includes('pool');
      const hasGarage = features.includes('garage');

      const params = {
        city: preferences.city,
        state_code: preferences.stateCode,
        price_min: preferences.priceMin || undefined,
        price_max: preferences.priceMax || undefined,
        beds: preferences.beds || undefined,
        baths: preferences.baths || undefined,
        prop_type: preferences.propType || undefined,
        keywords: keywords || undefined,
        has_pool: hasPool || undefined,
        has_garage: hasGarage || undefined,
        lot_sqft_min: preferences.lotSqftMin || undefined,
      };
      const data = await searchListings(params);
      setListings(data.results);
      setTotal(data.total);
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Something went wrong. Please try again.';
      setError(msg);
      setListings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return { listings, total, loading, error, search };
}
