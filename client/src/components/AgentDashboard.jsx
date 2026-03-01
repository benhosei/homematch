import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API_BASE from '../utils/apiBase';
import './AgentDashboard.css';

/* ───────── constants ───────── */
const TOUR_FEE = 200; // flat fee per verified tour

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'tour_scheduled', label: 'Tour Scheduled' },
  { value: 'tour_completed', label: 'Tour Completed' },
  { value: 'no_show', label: 'No Show' },
];

const STATUS_META = {
  new: { label: 'New', cls: 'status-new' },
  tour_scheduled: { label: 'Tour Scheduled', cls: 'status-scheduled' },
  tour_completed: { label: 'Tour Completed', cls: 'status-completed' },
  no_show: { label: 'No Show', cls: 'status-noshow' },
};

/* ───────── helpers ───────── */
function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount) {
  return '$' + Number(amount).toLocaleString();
}

function readinessScore(lead) {
  return lead.intentScore ?? lead.score ?? 0;
}

function readinessLabel(score) {
  if (score >= 70) return { label: 'High', cls: 'readiness-high' };
  if (score >= 40) return { label: 'Medium', cls: 'readiness-medium' };
  return { label: 'Low', cls: 'readiness-low' };
}

function budgetDisplay(lead) {
  const intent = lead.parsedIntent || {};
  if (intent.budget) {
    const val = typeof intent.budget === 'number' ? intent.budget : parseInt(intent.budget, 10);
    if (!isNaN(val)) return formatCurrency(val);
    return intent.budget;
  }
  if (intent.maxPrice) return formatCurrency(intent.maxPrice);
  if (lead.affordability && lead.affordability.maxBudget) return formatCurrency(lead.affordability.maxBudget);
  return '--';
}

/* ───────── sub-components ───────── */

function StatCard({ icon, value, label, sublabel, delay }) {
  return (
    <div className="ad-stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="ad-stat-icon">{icon}</div>
      <div className="ad-stat-body">
        <span className="ad-stat-value">{value}</span>
        <span className="ad-stat-label">{label}</span>
        {sublabel && <span className="ad-stat-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="ad-table-row ad-skeleton-row-table">
      <div className="ad-table-cell"><div className="skeleton ad-skel-text" /></div>
      <div className="ad-table-cell"><div className="skeleton ad-skel-badge-sm" /></div>
      <div className="ad-table-cell"><div className="skeleton ad-skel-text-sm" /></div>
      <div className="ad-table-cell"><div className="skeleton ad-skel-badge-sm" /></div>
      <div className="ad-table-cell"><div className="skeleton ad-skel-text-sm" /></div>
      <div className="ad-table-cell"><div className="skeleton ad-skel-badge-sm" /></div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.new;
  return (
    <span className={`ad-status-badge ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function ReadinessBadge({ score }) {
  const meta = readinessLabel(score);
  return (
    <span className={`ad-readiness-badge ${meta.cls}`} title={`Readiness score: ${score}`}>
      {score} - {meta.label}
    </span>
  );
}

function PaymentToggle({ isPaid, onToggle, disabled }) {
  return (
    <button
      className={`ad-payment-toggle ${isPaid ? 'paid' : 'unpaid'}`}
      onClick={onToggle}
      disabled={disabled}
      title={isPaid ? 'Paid - click to mark unpaid' : 'Unpaid - click to mark paid'}
    >
      <span className="ad-payment-toggle-track">
        <span className="ad-payment-toggle-thumb" />
      </span>
      <span className="ad-payment-toggle-label">{isPaid ? 'Paid' : 'Unpaid'}</span>
    </button>
  );
}

function StatusDropdown({ currentStatus, onChange, disabled }) {
  return (
    <select
      className={`ad-status-select ${STATUS_META[currentStatus]?.cls || ''}`}
      value={currentStatus}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function LeadDetailPanel({ lead, onClose }) {
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`hm_agent_note_${lead._id || lead.id}`) || ''; }
    catch { return ''; }
  });

  const saveNotes = useCallback((val) => {
    setNotes(val);
    try { localStorage.setItem(`hm_agent_note_${lead._id || lead.id}`, val); } catch {}
  }, [lead]);

  const buyerName = lead.buyerName || lead.buyer?.name || '';
  const buyerEmail = lead.buyerEmail || lead.buyer?.email || lead.email || '';
  const buyerPhone = lead.buyerPhone || lead.buyer?.phone || lead.phone || '';
  const intent = lead.parsedIntent || {};

  return (
    <div className="ad-detail-panel">
      <div className="ad-detail-header">
        <h3>Lead Details</h3>
        <button className="ad-detail-close" onClick={onClose} aria-label="Close details">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="ad-detail-section">
        <h4>Buyer Information</h4>
        <div className="ad-detail-grid">
          {buyerName && <div className="ad-detail-item"><span className="ad-detail-label">Name</span><span className="ad-detail-val">{buyerName}</span></div>}
          {buyerEmail && <div className="ad-detail-item"><span className="ad-detail-label">Email</span><span className="ad-detail-val">{buyerEmail}</span></div>}
          {buyerPhone && <div className="ad-detail-item"><span className="ad-detail-label">Phone</span><span className="ad-detail-val">{buyerPhone}</span></div>}
          {lead.timeline && <div className="ad-detail-item"><span className="ad-detail-label">Timeline</span><span className="ad-detail-val">{lead.timeline}</span></div>}
          {lead.preapproved !== undefined && (
            <div className="ad-detail-item">
              <span className="ad-detail-label">Pre-approved</span>
              <span className="ad-detail-val">{lead.preapproved ? 'Yes' : 'No'}</span>
            </div>
          )}
        </div>
      </div>

      {intent && Object.keys(intent).length > 0 && (
        <div className="ad-detail-section">
          <h4>Search Intent</h4>
          <div className="ad-detail-grid">
            {intent.location && <div className="ad-detail-item"><span className="ad-detail-label">Location</span><span className="ad-detail-val">{intent.location}</span></div>}
            {intent.budget && <div className="ad-detail-item"><span className="ad-detail-label">Budget</span><span className="ad-detail-val">{typeof intent.budget === 'number' ? formatCurrency(intent.budget) : intent.budget}</span></div>}
            {intent.beds && <div className="ad-detail-item"><span className="ad-detail-label">Bedrooms</span><span className="ad-detail-val">{intent.beds}</span></div>}
            {intent.baths && <div className="ad-detail-item"><span className="ad-detail-label">Bathrooms</span><span className="ad-detail-val">{intent.baths}</span></div>}
            {intent.propertyType && <div className="ad-detail-item"><span className="ad-detail-label">Property Type</span><span className="ad-detail-val">{intent.propertyType}</span></div>}
          </div>
          {intent.features && intent.features.length > 0 && (
            <div className="ad-detail-features">
              <span className="ad-detail-label">Features</span>
              <div className="ad-chip-row">
                {intent.features.map((f, i) => <span key={i} className="ad-chip ad-chip-feature">{f}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {lead.prompt && (
        <div className="ad-detail-section">
          <h4>Original Request</h4>
          <p className="ad-detail-prompt">{lead.prompt}</p>
        </div>
      )}

      <div className="ad-detail-section">
        <h4>Tour Status</h4>
        <div className="ad-detail-grid">
          <div className="ad-detail-item">
            <span className="ad-detail-label">Status</span>
            <span className="ad-detail-val"><StatusBadge status={lead.status} /></span>
          </div>
          {lead.tourDate && (
            <div className="ad-detail-item">
              <span className="ad-detail-label">Tour Date</span>
              <span className="ad-detail-val">{formatDate(lead.tourDate)}</span>
            </div>
          )}
          <div className="ad-detail-item">
            <span className="ad-detail-label">Payment</span>
            <span className="ad-detail-val">
              {lead.status === 'tour_completed'
                ? (lead.paymentStatus === 'paid' ? `Paid (${formatCurrency(TOUR_FEE)})` : `Unpaid (${formatCurrency(TOUR_FEE)})`)
                : 'N/A'
              }
            </span>
          </div>
        </div>
      </div>

      <div className="ad-detail-actions">
        {buyerEmail && (
          <a className="ad-btn ad-btn-contact" href={`mailto:${buyerEmail}?subject=Your%20HomeMatch%20Tour`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Email Buyer
          </a>
        )}
        {buyerPhone && (
          <a className="ad-btn ad-btn-phone" href={`tel:${buyerPhone}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call Buyer
          </a>
        )}
      </div>

      <div className="ad-detail-section">
        <h4>Agent Notes</h4>
        <textarea
          className="ad-notes-textarea"
          placeholder="Add your notes about this lead..."
          value={notes}
          onChange={e => saveNotes(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════ */

export default function AgentDashboard() {
  /* --- agent registration state --- */
  const [agent, setAgent] = useState(() => {
    try {
      const stored = localStorage.getItem('hm_agent');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [regForm, setRegForm] = useState({ name: '', email: '', brokerage: '' });
  const [regError, setRegError] = useState('');

  /* --- leads state --- */
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedLead, setExpandedLead] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  /* ---- fetch leads ---- */
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads`);
      if (res.ok) {
        const data = await res.json();
        const leadsArray = Array.isArray(data) ? data : data.leads || [];
        // Initialize client-side tour tracking fields if not present
        const enriched = leadsArray.map(l => ({
          ...l,
          status: l.status || 'new',
          tourDate: l.tourDate || l.preferredDate || null,
          paymentStatus: l.paymentStatus || 'unpaid',
        }));
        setLeads(enriched);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  /* ---- register ---- */
  const handleRegister = useCallback((e) => {
    e.preventDefault();
    const { name, email, brokerage } = regForm;
    if (!name.trim() || !email.trim()) {
      setRegError('Name and email are required.');
      return;
    }
    const agentData = {
      id: 'agent_' + Date.now(),
      name: name.trim(),
      email: email.trim(),
      brokerage: brokerage.trim(),
      registeredAt: new Date().toISOString(),
    };
    localStorage.setItem('hm_agent', JSON.stringify(agentData));
    setAgent(agentData);
    setRegError('');
  }, [regForm]);

  /* ---- update lead status ---- */
  const handleStatusChange = useCallback(async (leadId, newStatus) => {
    setUpdatingId(leadId);

    // Optimistic update
    setLeads(prev => prev.map(l => {
      if ((l._id || l.id) === leadId) {
        const updated = { ...l, status: newStatus };
        // If moving to tour_scheduled, set a tour date if none exists
        if (newStatus === 'tour_scheduled' && !l.tourDate) {
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          updated.tourDate = nextWeek.toISOString();
        }
        // If moving away from tour_completed, reset payment
        if (newStatus !== 'tour_completed') {
          updated.paymentStatus = 'unpaid';
        }
        return updated;
      }
      return l;
    }));

    try {
      await fetch(`${API_BASE}/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      // When tour is completed, auto-send verification emails to agent + buyer
      if (newStatus === 'tour_completed') {
        const lead = leads.find(l => (l._id || l.id) === leadId);
        if (lead && lead.buyerEmail && agent) {
          fetch(`${API_BASE}/api/notify/send-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId,
              lead: {
                buyerName: lead.buyerName,
                feeAmount: 150,
                tier: 'qualified_tour',
              },
              agentEmail: agent.email,
              agentName: agent.name,
              buyerEmail: lead.buyerEmail,
              buyerName: lead.buyerName,
            }),
          }).catch(err => console.warn('Verification email failed:', err));
        }
      }
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingId(null);
    }

    // Persist to localStorage as fallback
    try {
      const stored = JSON.parse(localStorage.getItem('hm_lead_statuses') || '{}');
      stored[leadId] = newStatus;
      localStorage.setItem('hm_lead_statuses', JSON.stringify(stored));
    } catch {}
  }, [leads, agent]);

  /* ---- toggle payment status ---- */
  const handlePaymentToggle = useCallback(async (leadId) => {
    setLeads(prev => prev.map(l => {
      if ((l._id || l.id) === leadId) {
        const newPayment = l.paymentStatus === 'paid' ? 'unpaid' : 'paid';
        return { ...l, paymentStatus: newPayment };
      }
      return l;
    }));

    try {
      const lead = leads.find(l => (l._id || l.id) === leadId);
      const newPayment = lead?.paymentStatus === 'paid' ? 'unpaid' : 'paid';
      await fetch(`${API_BASE}/api/leads/${leadId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newPayment }),
      });
    } catch (err) {
      console.error('Payment toggle failed:', err);
    }

    // Persist to localStorage as fallback
    try {
      const lead = leads.find(l => (l._id || l.id) === leadId);
      const stored = JSON.parse(localStorage.getItem('hm_lead_payments') || '{}');
      stored[leadId] = lead?.paymentStatus === 'paid' ? 'unpaid' : 'paid';
      localStorage.setItem('hm_lead_payments', JSON.stringify(stored));
    } catch {}
  }, [leads]);

  /* ---- filtering ---- */
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => {
        const text = [
          l.buyerName, l.buyerEmail,
          l.buyer?.name, l.buyer?.email,
          l.parsedIntent?.location,
          l.prompt,
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      });
    }

    return result;
  }, [leads, statusFilter, searchQuery]);

  /* ---- derived summary stats ---- */
  const summaryStats = useMemo(() => {
    const total = leads.length;
    const toursScheduled = leads.filter(l => l.status === 'tour_scheduled').length;
    const toursCompleted = leads.filter(l => l.status === 'tour_completed').length;
    const paidCount = leads.filter(l => l.status === 'tour_completed' && l.paymentStatus === 'paid').length;
    const revenue = toursCompleted * TOUR_FEE;

    return { total, toursScheduled, toursCompleted, revenue, paidCount };
  }, [leads]);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="agent-dashboard">
      {/* -- HERO / HEADER -- */}
      <section className="ad-hero">
        <div className="ad-hero-bg">
          <div className="ad-hero-overlay" />
          <div className="ad-hero-content">
            <div className="ad-hero-top">
              <div>
                <div className="ad-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Agent Partner Portal
                </div>
                <h1 className="ad-hero-title">
                  {agent ? <>Welcome back, <span className="ad-hero-name">{agent.name}</span></> : 'Agent Partner Dashboard'}
                </h1>
                {agent && (
                  <p className="ad-hero-sub">
                    {agent.brokerage && <span className="ad-hero-brokerage">{agent.brokerage}</span>}
                    <span className="ad-hero-email">{agent.email}</span>
                  </p>
                )}
              </div>
              {agent && (
                <div className="ad-hero-quick-stats">
                  <div className="ad-hero-qs">
                    <span className="ad-hero-qs-val">{summaryStats.toursCompleted}</span>
                    <span className="ad-hero-qs-label">Verified Tours</span>
                  </div>
                  <div className="ad-hero-qs">
                    <span className="ad-hero-qs-val">{formatCurrency(summaryStats.revenue)}</span>
                    <span className="ad-hero-qs-label">Revenue</span>
                  </div>
                </div>
              )}
            </div>

            {/* Registration Form */}
            {!agent && (
              <form className="ad-reg-form" onSubmit={handleRegister}>
                <p className="ad-reg-description">
                  Register as a partner agent to receive verified tour leads. Earn a flat {formatCurrency(TOUR_FEE)} per completed and verified buyer tour.
                </p>
                <div className="ad-reg-fields">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={regForm.name}
                    onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    className="ad-reg-input"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={regForm.email}
                    onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    className="ad-reg-input"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Brokerage (optional)"
                    value={regForm.brokerage}
                    onChange={e => setRegForm(f => ({ ...f, brokerage: e.target.value }))}
                    className="ad-reg-input"
                  />
                  <button type="submit" className="ad-reg-submit">
                    Register
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>
                {regError && <p className="ad-reg-error">{regError}</p>}
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="ad-body">
        {/* -- SUMMARY STATS -- */}
        {agent && (
          <section className="ad-stats-grid">
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              value={summaryStats.total}
              label="Total Leads"
              delay={0}
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              value={summaryStats.toursScheduled}
              label="Tours Scheduled"
              delay={80}
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              value={summaryStats.toursCompleted}
              label="Tours Completed"
              sublabel="Verified"
              delay={160}
            />
            <StatCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              value={formatCurrency(summaryStats.revenue)}
              label="Revenue"
              sublabel={`${summaryStats.toursCompleted} x ${formatCurrency(TOUR_FEE)}`}
              delay={240}
            />
          </section>
        )}

        {/* -- FILTER BAR -- */}
        {agent && (
          <section className="ad-filter-bar">
            <div className="ad-filter-tabs">
              <button
                className={`ad-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`ad-filter-tab ${statusFilter === opt.value ? 'active' : ''} tab-${opt.value}`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="ad-search-wrap">
              <svg className="ad-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                className="ad-search-input"
                placeholder="Search by name, email, location..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </section>
        )}

        {/* -- LEAD TABLE -- */}
        <section className="ad-lead-feed">
          {loading ? (
            <div className="ad-table-wrap">
              <div className="ad-table">
                <div className="ad-table-header">
                  <div className="ad-table-cell">Buyer Name</div>
                  <div className="ad-table-cell">Readiness</div>
                  <div className="ad-table-cell">Budget</div>
                  <div className="ad-table-cell">Status</div>
                  <div className="ad-table-cell">Tour Date</div>
                  <div className="ad-table-cell">Payment</div>
                </div>
                {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
              </div>
            </div>
          ) : !agent ? (
            <div className="ad-empty-state">
              <div className="ad-empty-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 className="ad-empty-title">Register to View Leads</h3>
              <p className="ad-empty-text">Create your agent profile above to start viewing tour leads and tracking verified tours.</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="ad-empty-state">
              <div className="ad-empty-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="1.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h3 className="ad-empty-title">No Leads Found</h3>
              <p className="ad-empty-text">
                {searchQuery || statusFilter !== 'all'
                  ? 'No leads match your current filters. Try adjusting your search or status filter.'
                  : 'New tour leads will appear here when buyers submit requests.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="ad-table-wrap">
                <div className="ad-table">
                  <div className="ad-table-header">
                    <div className="ad-table-cell">Buyer Name</div>
                    <div className="ad-table-cell">Readiness</div>
                    <div className="ad-table-cell">Budget</div>
                    <div className="ad-table-cell">Status</div>
                    <div className="ad-table-cell">Tour Date</div>
                    <div className="ad-table-cell">Payment</div>
                  </div>
                  {filteredLeads.map((lead, idx) => {
                    const id = lead._id || lead.id;
                    const score = readinessScore(lead);
                    const budget = budgetDisplay(lead);
                    const isExpanded = expandedLead === id;
                    const isVerified = lead.status === 'tour_completed';
                    const buyerName = lead.buyerName || lead.buyer?.name || lead.buyerEmail || '--';

                    return (
                      <React.Fragment key={id}>
                        <div
                          className={`ad-table-row ${isExpanded ? 'expanded' : ''} ${isVerified ? 'verified-row' : ''}`}
                          style={{ animationDelay: `${idx * 40}ms` }}
                          onClick={() => setExpandedLead(isExpanded ? null : id)}
                        >
                          <div className="ad-table-cell ad-cell-name">
                            <span className="ad-buyer-avatar">
                              {(buyerName).charAt(0).toUpperCase()}
                            </span>
                            <div className="ad-buyer-info">
                              <span className="ad-buyer-name-text">{buyerName}</span>
                              <span className="ad-buyer-time">{timeAgo(lead.createdAt || Date.now())}</span>
                            </div>
                            {isVerified && (
                              <span className="ad-verified-indicator" title="Tour Verified">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              </span>
                            )}
                          </div>
                          <div className="ad-table-cell">
                            <ReadinessBadge score={score} />
                          </div>
                          <div className="ad-table-cell ad-cell-budget">
                            {budget}
                          </div>
                          <div className="ad-table-cell" onClick={e => e.stopPropagation()}>
                            <StatusDropdown
                              currentStatus={lead.status}
                              onChange={(newStatus) => handleStatusChange(id, newStatus)}
                              disabled={updatingId === id}
                            />
                          </div>
                          <div className="ad-table-cell ad-cell-date">
                            {lead.tourDate ? formatDate(lead.tourDate) : '--'}
                          </div>
                          <div className="ad-table-cell" onClick={e => e.stopPropagation()}>
                            {lead.status === 'tour_completed' ? (
                              <PaymentToggle
                                isPaid={lead.paymentStatus === 'paid'}
                                onToggle={() => handlePaymentToggle(id)}
                                disabled={updatingId === id}
                              />
                            ) : (
                              <span className="ad-payment-na">--</span>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div className="ad-table-detail-row">
                            <LeadDetailPanel
                              lead={lead}
                              onClose={() => setExpandedLead(null)}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="ad-mobile-cards">
                {filteredLeads.map((lead, idx) => {
                  const id = lead._id || lead.id;
                  const score = readinessScore(lead);
                  const budget = budgetDisplay(lead);
                  const isExpanded = expandedLead === id;
                  const isVerified = lead.status === 'tour_completed';
                  const buyerName = lead.buyerName || lead.buyer?.name || lead.buyerEmail || '--';

                  return (
                    <div
                      key={id}
                      className={`ad-mobile-card ${isVerified ? 'verified-card' : ''}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="ad-mobile-card-header" onClick={() => setExpandedLead(isExpanded ? null : id)}>
                        <div className="ad-mobile-card-name-row">
                          <span className="ad-buyer-avatar">
                            {(buyerName).charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <span className="ad-buyer-name-text">{buyerName}</span>
                            {isVerified && (
                              <span className="ad-verified-indicator" title="Tour Verified">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              </span>
                            )}
                          </div>
                          <span className="ad-buyer-time">{timeAgo(lead.createdAt || Date.now())}</span>
                        </div>
                      </div>
                      <div className="ad-mobile-card-body">
                        <div className="ad-mobile-card-row">
                          <span className="ad-mobile-card-label">Readiness</span>
                          <ReadinessBadge score={score} />
                        </div>
                        <div className="ad-mobile-card-row">
                          <span className="ad-mobile-card-label">Budget</span>
                          <span>{budget}</span>
                        </div>
                        <div className="ad-mobile-card-row">
                          <span className="ad-mobile-card-label">Status</span>
                          <StatusDropdown
                            currentStatus={lead.status}
                            onChange={(newStatus) => handleStatusChange(id, newStatus)}
                            disabled={updatingId === id}
                          />
                        </div>
                        <div className="ad-mobile-card-row">
                          <span className="ad-mobile-card-label">Tour Date</span>
                          <span>{lead.tourDate ? formatDate(lead.tourDate) : '--'}</span>
                        </div>
                        <div className="ad-mobile-card-row">
                          <span className="ad-mobile-card-label">Payment</span>
                          {lead.status === 'tour_completed' ? (
                            <PaymentToggle
                              isPaid={lead.paymentStatus === 'paid'}
                              onToggle={() => handlePaymentToggle(id)}
                              disabled={updatingId === id}
                            />
                          ) : (
                            <span className="ad-payment-na">--</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="ad-mobile-card-detail">
                          <LeadDetailPanel
                            lead={lead}
                            onClose={() => setExpandedLead(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
