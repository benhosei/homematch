import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import './VerifyTour.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function VerifyTour() {
  const { leadId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const party = searchParams.get('party'); // 'agent' or 'buyer'

  const [status, setStatus] = useState('idle'); // idle | loading | success | already | error
  const [result, setResult] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [error, setError] = useState(null);

  // Check current verification status on mount
  useEffect(() => {
    if (!leadId) return;
    fetch(`${API}/api/notify/verify-status/${leadId}`)
      .then((r) => r.json())
      .then((data) => setVerifyStatus(data))
      .catch(() => {});
  }, [leadId]);

  const handleConfirm = useCallback(async () => {
    if (!token) {
      setError('No verification token found. Please use the link from your email.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`${API}/api/notify/verify-tour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, leadId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes('Invalid or expired')) {
          setStatus('already');
        } else {
          setError(data.error || 'Verification failed');
          setStatus('error');
        }
        return;
      }

      setResult(data);
      setStatus('success');
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }, [token, leadId]);

  // No token — just show status
  if (!token && verifyStatus) {
    return (
      <div className="vt-page">
        <div className="vt-card">
          <div className="vt-icon vt-icon-info">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </div>
          <h1 className="vt-title">Verification Status</h1>
          <p className="vt-lead-id">Lead: {leadId}</p>

          <div className="vt-status-grid">
            <div className={`vt-party-status ${verifyStatus.agentConfirmed ? 'confirmed' : 'pending'}`}>
              <span className="vt-party-icon">
                {verifyStatus.agentConfirmed ? '✓' : '○'}
              </span>
              <span className="vt-party-label">Agent</span>
              <span className="vt-party-state">
                {verifyStatus.agentConfirmed ? 'Confirmed' : 'Pending'}
              </span>
            </div>
            <div className={`vt-party-status ${verifyStatus.buyerConfirmed ? 'confirmed' : 'pending'}`}>
              <span className="vt-party-icon">
                {verifyStatus.buyerConfirmed ? '✓' : '○'}
              </span>
              <span className="vt-party-label">Buyer</span>
              <span className="vt-party-state">
                {verifyStatus.buyerConfirmed ? 'Confirmed' : 'Pending'}
              </span>
            </div>
          </div>

          {verifyStatus.tourVerified && (
            <div className="vt-verified-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Tour Verified
            </div>
          )}

          <Link to="/" className="vt-home-link">Back to HomeMatch</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vt-page">
      <div className="vt-card">
        {/* ── Idle: Ready to confirm ── */}
        {status === 'idle' && (
          <>
            <div className="vt-icon vt-icon-tour">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h1 className="vt-title">Confirm Your Tour</h1>
            <p className="vt-subtitle">
              {party === 'agent'
                ? 'As the showing agent, please confirm this tour took place.'
                : 'As the buyer, please confirm you attended this home tour.'}
            </p>
            <p className="vt-lead-id">Lead: {leadId}</p>

            {verifyStatus && (
              <div className="vt-status-grid">
                <div className={`vt-party-status ${verifyStatus.agentConfirmed ? 'confirmed' : party === 'agent' ? 'you' : 'pending'}`}>
                  <span className="vt-party-icon">
                    {verifyStatus.agentConfirmed ? '✓' : party === 'agent' ? '→' : '○'}
                  </span>
                  <span className="vt-party-label">Agent</span>
                  <span className="vt-party-state">
                    {verifyStatus.agentConfirmed ? 'Confirmed' : party === 'agent' ? 'You' : 'Pending'}
                  </span>
                </div>
                <div className={`vt-party-status ${verifyStatus.buyerConfirmed ? 'confirmed' : party === 'buyer' ? 'you' : 'pending'}`}>
                  <span className="vt-party-icon">
                    {verifyStatus.buyerConfirmed ? '✓' : party === 'buyer' ? '→' : '○'}
                  </span>
                  <span className="vt-party-label">Buyer</span>
                  <span className="vt-party-state">
                    {verifyStatus.buyerConfirmed ? 'Confirmed' : party === 'buyer' ? 'You' : 'Pending'}
                  </span>
                </div>
              </div>
            )}

            <button className="vt-confirm-btn" onClick={handleConfirm}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Yes, the Tour Happened
            </button>

            <p className="vt-fine-print">
              By clicking confirm, you verify that this home tour took place.
              Both the agent and buyer must confirm for the tour to be officially verified.
            </p>
          </>
        )}

        {/* ── Loading ── */}
        {status === 'loading' && (
          <>
            <div className="vt-spinner" />
            <h1 className="vt-title">Verifying...</h1>
            <p className="vt-subtitle">Please wait while we record your confirmation.</p>
          </>
        )}

        {/* ── Success ── */}
        {status === 'success' && result && (
          <>
            <div className="vt-icon vt-icon-success">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h1 className="vt-title">
              {result.tourVerified ? 'Tour Verified!' : 'Confirmation Received!'}
            </h1>
            <p className="vt-subtitle">
              {result.tourVerified
                ? 'Both parties have confirmed. The tour is now officially verified and an invoice has been generated.'
                : `Thank you for confirming! We're still waiting for the ${party === 'agent' ? 'buyer' : 'agent'} to confirm.`}
            </p>

            <div className="vt-status-grid">
              <div className={`vt-party-status ${result.agentConfirmed ? 'confirmed' : 'pending'}`}>
                <span className="vt-party-icon">{result.agentConfirmed ? '✓' : '○'}</span>
                <span className="vt-party-label">Agent</span>
                <span className="vt-party-state">{result.agentConfirmed ? 'Confirmed' : 'Pending'}</span>
              </div>
              <div className={`vt-party-status ${result.buyerConfirmed ? 'confirmed' : 'pending'}`}>
                <span className="vt-party-icon">{result.buyerConfirmed ? '✓' : '○'}</span>
                <span className="vt-party-label">Buyer</span>
                <span className="vt-party-state">{result.buyerConfirmed ? 'Confirmed' : 'Pending'}</span>
              </div>
            </div>

            {result.tourVerified && (
              <div className="vt-verified-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Tour Officially Verified
              </div>
            )}

            <Link to="/" className="vt-home-link">Back to HomeMatch</Link>
          </>
        )}

        {/* ── Already confirmed / expired ── */}
        {status === 'already' && (
          <>
            <div className="vt-icon vt-icon-info">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <h1 className="vt-title">Already Confirmed</h1>
            <p className="vt-subtitle">
              This verification link has already been used or has expired.
              Each confirmation link can only be used once.
            </p>

            {verifyStatus && (
              <div className="vt-status-grid">
                <div className={`vt-party-status ${verifyStatus.agentConfirmed ? 'confirmed' : 'pending'}`}>
                  <span className="vt-party-icon">{verifyStatus.agentConfirmed ? '✓' : '○'}</span>
                  <span className="vt-party-label">Agent</span>
                  <span className="vt-party-state">{verifyStatus.agentConfirmed ? 'Confirmed' : 'Pending'}</span>
                </div>
                <div className={`vt-party-status ${verifyStatus.buyerConfirmed ? 'confirmed' : 'pending'}`}>
                  <span className="vt-party-icon">{verifyStatus.buyerConfirmed ? '✓' : '○'}</span>
                  <span className="vt-party-label">Buyer</span>
                  <span className="vt-party-state">{verifyStatus.buyerConfirmed ? 'Confirmed' : 'Pending'}</span>
                </div>
              </div>
            )}

            <Link to="/" className="vt-home-link">Back to HomeMatch</Link>
          </>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <>
            <div className="vt-icon vt-icon-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </div>
            <h1 className="vt-title">Verification Failed</h1>
            <p className="vt-subtitle vt-error-text">{error}</p>
            <button className="vt-confirm-btn vt-retry-btn" onClick={handleConfirm}>
              Try Again
            </button>
            <Link to="/" className="vt-home-link">Back to HomeMatch</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyTour;
