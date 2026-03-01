import API_BASE from './apiBase';

export async function parseIntent(locationText, queryText) {
  const res = await fetch(`${API_BASE}/api/intent/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationText, queryText }),
  });
  return res.json();
}

export async function searchWithIntent(intent) {
  const res = await fetch(`${API_BASE}/api/intent/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
  });
  return res.json();
}
