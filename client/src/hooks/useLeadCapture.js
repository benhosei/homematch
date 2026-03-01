import { useState, useCallback } from 'react';
import API_BASE from '../utils/apiBase';

/**
 * Reusable lead capture hook — captures buyer intent and submits to /api/leads/capture
 */
export function useLeadCapture() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadResult, setLeadResult] = useState(null);
  const [error, setError] = useState(null);

  const submitLead = useCallback(async ({
    buyerName = '',
    buyerEmail = '',
    buyerPhone = '',
    prompt = '',
    parsedIntent = null,
    lifestyleProfile = null,
    affordability = null,
    selectedListings = [],
    source = 'website',
  }) => {
    if (!buyerEmail || !prompt) {
      setError('Email and a description of what you\'re looking for are required.');
      return null;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          buyerPhone,
          prompt,
          parsedIntent,
          lifestyleProfile,
          affordability,
          selectedListings,
          source,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
        setLeadResult(data);
        setShowForm(false);
        // Store in localStorage so we don't show the form again too soon
        localStorage.setItem('hm_lead_submitted', JSON.stringify({
          leadId: data.leadId,
          email: buyerEmail,
          ts: Date.now(),
        }));
        return data;
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
        return null;
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setShowForm(false);
    setSubmitted(false);
    setLeadResult(null);
    setError(null);
  }, []);

  const hasRecentSubmission = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hm_lead_submitted') || 'null');
      if (stored && Date.now() - stored.ts < 24 * 60 * 60 * 1000) return true;
    } catch {}
    return false;
  }, []);

  return {
    showForm,
    setShowForm,
    submitting,
    submitted,
    leadResult,
    error,
    submitLead,
    reset,
    hasRecentSubmission,
  };
}
