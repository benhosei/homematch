import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export async function searchListings(params) {
  const response = await api.get('/listings/search', { params });
  return response.data;
}
