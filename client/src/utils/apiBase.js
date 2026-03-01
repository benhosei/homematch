/**
 * API base URL — resolves to the backend server.
 *
 * In development: empty string (uses CRA proxy to localhost:5001)
 * In production:  set REACT_APP_API_URL env var to your deployed backend URL
 *                 e.g. "https://homematch-api.onrender.com"
 *
 * Usage:  fetch(`${API_BASE}/api/listings/search-multi`, { ... })
 */
const API_BASE = process.env.REACT_APP_API_URL || '';

export default API_BASE;
