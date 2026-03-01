import axios from 'axios';
import { auth } from '../firebase';
import API_BASE from './apiBase';

const userApi = axios.create({
  baseURL: API_BASE + '/api/user',
  timeout: 10000,
});

// Attach Firebase ID token to every request
userApi.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function loadUserData() {
  const res = await userApi.get('/data');
  return res.data;
}

export async function saveUserData(data) {
  const res = await userApi.put('/data', data);
  return res.data;
}

export async function updateFavorites(favorites) {
  const res = await userApi.patch('/favorites', { favorites });
  return res.data;
}

export async function updatePreferences(preferences) {
  const res = await userApi.patch('/preferences', { preferences });
  return res.data;
}

export async function updateSavedSearches(savedSearches) {
  const res = await userApi.patch('/saved-searches', { savedSearches });
  return res.data;
}

export async function updateClickHistory(clickHistory) {
  const res = await userApi.patch('/click-history', { clickHistory });
  return res.data;
}
