import React, { useState, useCallback } from 'react';
import API_BASE from '../utils/apiBase';
import './MoveInWizard.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Main Component ──────────────────────────────────────────────────────────

function MoveInPlanner() {
  // ── Movers state ──
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [destZip, setDestZip] = useState('');
  const [bedrooms, setBedrooms] = useState('3');
  const [sqft, setSqft] = useState('1500');
  const [moveDate, setMoveDate] = useState('');
  const [stairs, setStairs] = useState('none');
  const [specialItems, setSpecialItems] = useState('');
  const [moveEstimate, setMoveEstimate] = useState(null);
  const [moveEstLoading, setMoveEstLoading] = useState(false);
  const [movePlan, setMovePlan] = useState(null);
  const [movePlanLoading, setMovePlanLoading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // ── Handlers ──

  const handleMoveEstimate = useCallback(async () => {
    if (!originCity.trim() || !destCity.trim()) return;
    setMoveEstLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/move/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { city: originCity, state: originState, zip: originZip },
          destination: { city: destCity, state: destState, zip: destZip },
          homeSize: { bedrooms: Number(bedrooms) || 3, sqft: Number(sqft) || 1500 },
          stairs,
          date: moveDate || undefined,
        }),
      });
      const data = await res.json();
      setMoveEstimate(data);
    } catch (err) {
      console.error('Move estimate error:', err);
    } finally {
      setMoveEstLoading(false);
    }
  }, [originCity, originState, originZip, destCity, destState, destZip, bedrooms, sqft, stairs, moveDate]);

  const handleMovePlan = useCallback(async () => {
    setMovePlanLoading(true);
    try {
      const beds = Number(bedrooms) || 3;
      const res = await fetch(`${API_BASE}/api/move/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveDate: moveDate || undefined,
          householdSize: beds >= 4 ? 'large' : beds >= 2 ? 'medium' : 'small',
          pets: false,
          specialItems: specialItems ? specialItems.split(',').map(s => s.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      setMovePlan(data);
    } catch (err) {
      console.error('Move plan error:', err);
    } finally {
      setMovePlanLoading(false);
    }
  }, [moveDate, bedrooms, specialItems]);

  const handleContactSubmit = useCallback(async () => {
    if (!contactName.trim() || !contactEmail.trim()) return;
    setContactLoading(true);
    try {
      await fetch(`${API_BASE}/api/move/find-movers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { city: originCity, state: originState, zip: originZip },
          destination: { city: destCity, state: destState, zip: destZip },
          date: moveDate,
          contact: { name: contactName, email: contactEmail, phone: contactPhone },
          notes: contactNotes,
        }),
      });
      setContactSubmitted(true);
    } catch (err) {
      console.error('Contact submit error:', err);
    } finally {
      setContactLoading(false);
    }
  }, [contactName, contactEmail, contactPhone, contactNotes, originCity, originState, originZip, destCity, destState, destZip, moveDate]);

  // ── Render ──

  return (
    <div className="wizard-page">
      <div className="wizard-content">
        <div className="step-header">
          <h2>Plan Your Move</h2>
          <p>Get a cost estimate, moving checklist, and connect with local movers</p>
        </div>

        <div className="movers-section">
          {/* Moving estimate */}
          <div className="movers-card">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              Moving Cost Estimate
            </h3>
            <p className="card-desc">Where are you moving from and to?</p>

            <div className="mover-form-grid">
              <div className="mover-field">
                <label>From City</label>
                <input value={originCity} onChange={e => setOriginCity(e.target.value)} placeholder="Current city" />
              </div>
              <div className="mover-field">
                <label>From State</label>
                <input value={originState} onChange={e => setOriginState(e.target.value)} placeholder="e.g. CA" maxLength={2} />
              </div>
              <div className="mover-field">
                <label>From Zip</label>
                <input value={originZip} onChange={e => setOriginZip(e.target.value)} placeholder="Zip code" maxLength={5} />
              </div>
              <div className="mover-field">
                <label>To City</label>
                <input value={destCity} onChange={e => setDestCity(e.target.value)} placeholder="Destination city" />
              </div>
              <div className="mover-field">
                <label>To State</label>
                <input value={destState} onChange={e => setDestState(e.target.value)} placeholder="e.g. TX" maxLength={2} />
              </div>
              <div className="mover-field">
                <label>To Zip</label>
                <input value={destZip} onChange={e => setDestZip(e.target.value)} placeholder="Zip code" maxLength={5} />
              </div>
              <div className="mover-field">
                <label>Bedrooms</label>
                <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}>
                  <option value="1">1 bedroom</option>
                  <option value="2">2 bedrooms</option>
                  <option value="3">3 bedrooms</option>
                  <option value="4">4 bedrooms</option>
                  <option value="5">5+ bedrooms</option>
                </select>
              </div>
              <div className="mover-field">
                <label>Home Sqft</label>
                <input type="number" value={sqft} onChange={e => setSqft(e.target.value)} placeholder="1500" />
              </div>
              <div className="mover-field">
                <label>Move Date</label>
                <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} />
              </div>
              <div className="mover-field">
                <label>Stairs</label>
                <select value={stairs} onChange={e => setStairs(e.target.value)}>
                  <option value="none">No stairs</option>
                  <option value="some">Some stairs (1-2 flights)</option>
                  <option value="many">Many stairs (3+)</option>
                </select>
              </div>
              <div className="mover-field" style={{ gridColumn: '1 / -1' }}>
                <label>Special Items</label>
                <input value={specialItems} onChange={e => setSpecialItems(e.target.value)} placeholder="Piano, hot tub, pool table, etc. (comma-separated)" />
              </div>
            </div>

            <button className="calc-btn" onClick={handleMoveEstimate} disabled={moveEstLoading || !originCity.trim() || !destCity.trim()} style={{ marginTop: 16 }}>
              {moveEstLoading ? 'Estimating...' : 'Get Estimate'}
            </button>

            {moveEstimate && (
              <div className="move-estimate-result">
                <div className="estimate-cost">
                  <div className="ec-range">
                    {fmt(moveEstimate.estimatedCostRange?.low)} — {fmt(moveEstimate.estimatedCostRange?.high)}
                  </div>
                  <div className="ec-label">Estimated moving cost</div>
                  {moveEstimate.recommendedMoveType && (
                    <div className="estimate-type-badge">
                      Recommended: {moveEstimate.recommendedMoveType.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                {moveEstimate.assumptions?.length > 0 && (
                  <ul className="estimate-assumptions">
                    {moveEstimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Moving plan / checklist */}
          <div className="movers-card">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Moving Checklist
            </h3>
            <p className="card-desc">Get a personalized moving timeline</p>

            <button className="calc-btn" onClick={handleMovePlan} disabled={movePlanLoading}>
              {movePlanLoading ? 'Generating...' : 'Generate My Plan'}
            </button>

            {movePlan && (
              <div className="move-timeline">
                {(movePlan.timeline || []).map((item, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-when">{item.when}</div>
                    <ul className="timeline-tasks">
                      {(item.tasks || []).map((task, j) => (
                        <li key={j}>{task}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {movePlan.specialItemNotes?.length > 0 && (
                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <strong style={{ fontSize: '0.8rem', color: '#92400e' }}>Special Item Notes:</strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      {movePlan.specialItemNotes.map((n, i) => (
                        <li key={i} style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: 4 }}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Find Movers / Contact */}
          <div className="movers-card full-width">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Request Mover Quotes
            </h3>
            <p className="card-desc">We'll connect you with local moving companies</p>

            {!contactSubmitted ? (
              <div className="contact-form">
                <div className="mover-form-grid">
                  <div className="mover-field">
                    <label>Your Name *</label>
                    <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="mover-field">
                    <label>Email *</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="mover-field">
                    <label>Phone</label>
                    <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 123-4567" />
                  </div>
                  <div className="mover-field">
                    <label>Notes</label>
                    <input value={contactNotes} onChange={e => setContactNotes(e.target.value)} placeholder="Anything else movers should know?" />
                  </div>
                </div>
                <button
                  className="contact-submit"
                  onClick={handleContactSubmit}
                  disabled={contactLoading || !contactName.trim() || !contactEmail.trim()}
                >
                  {contactLoading ? (
                    <><span className="btn-loading-sm" /> Submitting...</>
                  ) : (
                    'Request Quotes'
                  )}
                </button>
              </div>
            ) : (
              <div className="contact-success">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                <h4>Request Submitted!</h4>
                <p>Local movers will contact you within 24-48 hours with quotes.</p>
              </div>
            )}

            <div className="disclaimer" style={{ marginTop: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Quotes are estimates; movers will provide final pricing after an in-home or virtual survey.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MoveInPlanner;
