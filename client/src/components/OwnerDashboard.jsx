import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../utils/apiBase';
import './OwnerDashboard.css';

const OWNER_EMAIL = (process.env.REACT_APP_OWNER_EMAIL || '').trim().toLowerCase();

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '$0';
  return '$' + Number(amount).toLocaleString();
}

// ─── Sub-Components ──────────────────────────────────────────────

function OdStatCard({ icon, value, label, sublabel, accent, delay }) {
  return (
    <div
      className={`od-stat-card ${accent ? 'od-stat-' + accent : ''}`}
      style={{ animationDelay: `${delay || 0}ms` }}
    >
      <div className="od-stat-icon">{icon}</div>
      <div className="od-stat-body">
        <span className="od-stat-value">{value ?? '—'}</span>
        <span className="od-stat-label">{label}</span>
        {sublabel && <span className="od-stat-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

function OdStatusBadge({ status }) {
  const labels = {
    new: 'New',
    claimed: 'Claimed',
    tour_scheduled: 'Scheduled',
    tour_completed: 'Completed',
    no_show: 'No Show',
  };
  return (
    <span className={`od-status-badge status-${status}`}>
      {labels[status] || status}
    </span>
  );
}

function OdUrgencyBadge({ urgency }) {
  return (
    <span className={`od-urgency-badge urgency-${urgency}`}>
      {urgency === 'hot' ? '🔥 Hot' : urgency === 'warm' ? '🟡 Warm' : '🔵 Cool'}
    </span>
  );
}

function OdSkeletonRow() {
  return (
    <div className="od-table-row od-skeleton-row">
      <div className="od-table-cell"><div className="od-skel od-skel-text" /></div>
      <div className="od-table-cell"><div className="od-skel od-skel-text-sm" /></div>
      <div className="od-table-cell"><div className="od-skel od-skel-badge" /></div>
      <div className="od-table-cell"><div className="od-skel od-skel-badge" /></div>
      <div className="od-table-cell"><div className="od-skel od-skel-text-sm" /></div>
      <div className="od-table-cell"><div className="od-skel od-skel-text-sm" /></div>
    </div>
  );
}

function OdLeadDetailPanel({ lead, onClose }) {
  if (!lead) return null;

  const intent = lead.parsedIntent || {};
  const features = [
    ...(intent.features || []),
    ...(lead.lifestyleProfile?.priorities || []),
  ];

  return (
    <div className="od-detail-panel">
      <div className="od-detail-header">
        <h3>{lead.buyerName || 'Unknown Buyer'}</h3>
        <button className="od-detail-close" onClick={onClose} aria-label="Close details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Buyer info */}
      <div className="od-detail-section">
        <h4>Buyer Information</h4>
        <div className="od-detail-grid">
          <div className="od-detail-item">
            <span className="od-detail-label">Email</span>
            <span className="od-detail-val">{lead.buyerEmail || '—'}</span>
          </div>
          {lead.timeline && (
            <div className="od-detail-item">
              <span className="od-detail-label">Timeline</span>
              <span className="od-detail-val">{lead.timeline}</span>
            </div>
          )}
          {lead.preapproved && (
            <div className="od-detail-item">
              <span className="od-detail-label">Pre-Approved</span>
              <span className="od-detail-val" style={{ color: '#059669' }}>Yes</span>
            </div>
          )}
          <div className="od-detail-item">
            <span className="od-detail-label">Intent Score</span>
            <span className="od-detail-val">{lead.intentScore || '—'}/100</span>
          </div>
          <div className="od-detail-item">
            <span className="od-detail-label">Urgency</span>
            <span className="od-detail-val" style={{ textTransform: 'capitalize' }}>{lead.urgency || '—'}</span>
          </div>
          <div className="od-detail-item">
            <span className="od-detail-label">Source</span>
            <span className="od-detail-val" style={{ textTransform: 'capitalize' }}>{lead.source || '—'}</span>
          </div>
        </div>
      </div>

      {/* Search intent */}
      {(intent.location || intent.budget || intent.beds) && (
        <div className="od-detail-section">
          <h4>Search Intent</h4>
          <div className="od-detail-grid">
            {(intent.location || intent.city) && (
              <div className="od-detail-item">
                <span className="od-detail-label">Location</span>
                <span className="od-detail-val">{intent.location || `${intent.city}, ${intent.state}`}</span>
              </div>
            )}
            {(intent.budget || intent.maxPrice) && (
              <div className="od-detail-item">
                <span className="od-detail-label">Budget</span>
                <span className="od-detail-val">{formatCurrency(intent.budget || intent.maxPrice)}</span>
              </div>
            )}
            {intent.beds && (
              <div className="od-detail-item">
                <span className="od-detail-label">Beds</span>
                <span className="od-detail-val">{intent.beds}+</span>
              </div>
            )}
            {intent.baths && (
              <div className="od-detail-item">
                <span className="od-detail-label">Baths</span>
                <span className="od-detail-val">{intent.baths}+</span>
              </div>
            )}
            {intent.propertyType && (
              <div className="od-detail-item">
                <span className="od-detail-label">Type</span>
                <span className="od-detail-val" style={{ textTransform: 'capitalize' }}>{intent.propertyType}</span>
              </div>
            )}
          </div>
          {features.length > 0 && (
            <div className="od-chip-row" style={{ marginTop: 10 }}>
              {features.map((f, i) => (
                <span key={i} className="od-chip">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Original prompt */}
      {lead.prompt && (
        <div className="od-detail-section">
          <h4>Original Query</h4>
          <div className="od-detail-prompt">{lead.prompt}</div>
        </div>
      )}

      {/* Status & Payment */}
      <div className="od-detail-section">
        <h4>Status</h4>
        <div className="od-detail-grid">
          <div className="od-detail-item">
            <span className="od-detail-label">Lead Status</span>
            <OdStatusBadge status={lead.status} />
          </div>
          <div className="od-detail-item">
            <span className="od-detail-label">Payment</span>
            <span className="od-detail-val" style={{ color: lead.paymentStatus === 'paid' ? '#059669' : '#dc2626', textTransform: 'capitalize' }}>
              {lead.paymentStatus || 'unpaid'}
            </span>
          </div>
          {lead.tourDate && (
            <div className="od-detail-item">
              <span className="od-detail-label">Tour Date</span>
              <span className="od-detail-val">{formatDate(lead.tourDate)}</span>
            </div>
          )}
          <div className="od-detail-item">
            <span className="od-detail-label">Created</span>
            <span className="od-detail-val">{formatDate(lead.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();

  // ── Auth gate: only the owner email can access ──
  const isOwner = OWNER_EMAIL
    ? user?.email?.toLowerCase() === OWNER_EMAIL
    : !!user; // If no OWNER_EMAIL set, allow any logged-in user (dev fallback)

  if (authLoading) {
    return (
      <div className="od-gate">
        <div className="od-gate-card">
          <div className="od-gate-spinner" />
          <p className="od-gate-text">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="od-gate">
        <div className="od-gate-card">
          <div className="od-gate-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="od-gate-title">Owner Access Only</h2>
          <p className="od-gate-text">Sign in with the owner account to access the dashboard.</p>
          <Link to="/login" className="od-gate-btn">Sign In</Link>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="od-gate">
        <div className="od-gate-card">
          <div className="od-gate-icon od-gate-denied">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M4.93 4.93l14.14 14.14" />
            </svg>
          </div>
          <h2 className="od-gate-title">Access Denied</h2>
          <p className="od-gate-text">This dashboard is restricted to the platform owner.</p>
          <Link to="/" className="od-gate-btn od-gate-btn-secondary">Back to Home</Link>
        </div>
      </div>
    );
  }

  return <OwnerDashboardContent />;
}

function OwnerDashboardContent() {
  // ── State ──
  const [dashboard, setDashboard] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [staleLeads, setStaleLeads] = useState([]);
  const [realtorLeads, setRealtorLeads] = useState([]);
  const [agreements, setAgreements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLead, setExpandedLead] = useState(null);

  // ── Fetch all data ──
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [dashRes, statsRes, feedRes, staleRes, agentRes, agrRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/tracking/dashboard`).then(r => r.json()),
      fetch(`${API_BASE}/api/leads/stats`).then(r => r.json()),
      fetch(`${API_BASE}/api/leads/feed?limit=100`).then(r => r.json()),
      fetch(`${API_BASE}/api/tracking/stale-check`).then(r => r.json()),
      fetch(`${API_BASE}/api/leads/realtor-leads`).then(r => r.json()),
      fetch(`${API_BASE}/api/tracking/agreements`).then(r => r.json()),
    ]);

    if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.dashboard || dashRes.value);
    if (statsRes.status === 'fulfilled') setPlatformStats(statsRes.value);
    if (feedRes.status === 'fulfilled') {
      setLeads(feedRes.value.leads || []);
      setLeadsTotal(feedRes.value.total || 0);
    }
    if (staleRes.status === 'fulfilled') setStaleLeads(staleRes.value.staleLeads || []);
    if (agentRes.status === 'fulfilled') setRealtorLeads(agentRes.value.leads || []);
    if (agrRes.status === 'fulfilled') setAgreements(agrRes.value.agreements || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filtered leads ──
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);
    if (urgencyFilter !== 'all') result = result.filter(l => l.urgency === urgencyFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => {
        const text = [l.buyerName, l.buyerEmail, l.parsedIntent?.location, l.parsedIntent?.city, l.prompt]
          .filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      });
    }
    return result;
  }, [leads, statusFilter, urgencyFilter, searchQuery]);

  // ── Funnel data ──
  const funnelData = useMemo(() => {
    if (!dashboard?.byStatus && !leads.length) return [];
    const byStatus = dashboard?.byStatus || {};
    const statusCounts = {};
    if (Object.keys(byStatus).length) {
      Object.assign(statusCounts, byStatus);
    } else {
      leads.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });
    }
    const steps = [
      { key: 'new', label: 'New Leads', count: statusCounts.new || 0, cls: 'funnel-new' },
      { key: 'tour_scheduled', label: 'Tours Scheduled', count: statusCounts.tour_scheduled || (dashboard?.toursScheduled || 0), cls: 'funnel-scheduled' },
      { key: 'tour_completed', label: 'Tours Completed', count: statusCounts.tour_completed || 0, cls: 'funnel-completed' },
      { key: 'tour_verified', label: 'Tours Verified', count: dashboard?.toursVerified || statusCounts.tour_verified || 0, cls: 'funnel-verified' },
      { key: 'closed', label: 'Closed Deals', count: dashboard?.closed || statusCounts.closed || 0, cls: 'funnel-closed' },
    ];
    const max = Math.max(...steps.map(s => s.count), 1);
    return steps.map(s => ({ ...s, pct: Math.max((s.count / max) * 100, 4) }));
  }, [dashboard, leads]);

  // Revenue bar percentages
  const revenueMax = Math.max((dashboard?.totalRevenue || 0) + (dashboard?.pendingInvoices || 0), 1);
  const paidPct = ((dashboard?.totalRevenue || 0) / revenueMax) * 100;
  const invoicedPct = ((dashboard?.pendingInvoices || 0) / revenueMax) * 100;

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="owner-dashboard">
      {/* ── HERO ── */}
      <section className="od-hero-bg">
        <div className="od-hero-content">
          <div className="od-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Owner Dashboard
          </div>
          <h1 className="od-hero-title">
            HomeMatch <span className="od-hero-accent">Command Center</span>
          </h1>
          <p className="od-hero-sub">Platform overview · Real-time KPIs · Lead pipeline</p>
          <button
            className={`od-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchAll(true)}
            disabled={refreshing}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </section>

      <div className="od-body">
        {/* ── KPI STAT CARDS ── */}
        <section className="od-stats-grid">
          <OdStatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            value={formatCurrency(dashboard?.totalRevenue)}
            label="Total Revenue"
            sublabel="Paid invoices"
            accent="green"
            delay={0}
          />
          <OdStatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
            value={formatCurrency(dashboard?.pendingInvoices)}
            label="Pending Invoices"
            sublabel="Awaiting payment"
            accent="warning"
            delay={80}
          />
          <OdStatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            value={platformStats?.totalLeads ?? leadsTotal}
            label="Total Leads"
            sublabel={`${platformStats?.newLeads || 0} new`}
            delay={160}
          />
          <OdStatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
            value={dashboard?.toursVerified ?? 0}
            label="Tours Verified"
            sublabel="Dual-confirmed"
            accent="green"
            delay={240}
          />
          <OdStatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            value={dashboard?.staleLeads ?? staleLeads.length}
            label="Stale Leads"
            sublabel=">7 days idle"
            accent="danger"
            delay={320}
          />
        </section>

        {/* ── MAIN TWO-COLUMN GRID ── */}
        <div className="od-main-grid">
          {/* LEFT: Lead Pipeline */}
          <section className="od-pipeline">
            <div className="od-section-header">
              <h2>Lead Pipeline</h2>
              <span className="od-section-count">{filteredLeads.length} of {leadsTotal}</span>
            </div>

            {/* Filter bar */}
            <div className="od-filter-bar">
              <div className="od-filter-tabs">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'new', label: 'New' },
                  { key: 'claimed', label: 'Claimed' },
                  { key: 'tour_scheduled', label: 'Scheduled' },
                  { key: 'tour_completed', label: 'Completed' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`od-filter-tab ${statusFilter === tab.key ? `active tab-${tab.key}` : ''}`}
                    onClick={() => { setStatusFilter(tab.key); setExpandedLead(null); }}
                  >
                    {tab.label}
                  </button>
                ))}
                <span style={{ width: 1, background: 'var(--color-border)', margin: '4px 4px' }} />
                {['all', 'hot', 'warm', 'cool'].map(u => (
                  <button
                    key={u}
                    className={`od-filter-tab ${urgencyFilter === u ? `active tab-${u}` : ''}`}
                    onClick={() => { setUrgencyFilter(u); setExpandedLead(null); }}
                  >
                    {u === 'all' ? '●' : u === 'hot' ? '🔥' : u === 'warm' ? '🟡' : '🔵'}
                  </button>
                ))}
              </div>
              <div className="od-search-wrap">
                <span className="od-search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  className="od-search-input"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Desktop table */}
            <div className="od-table-wrap">
              <div className="od-table">
                <div className="od-table-header">
                  <div className="od-table-cell">Buyer</div>
                  <div className="od-table-cell">Score</div>
                  <div className="od-table-cell">Urgency</div>
                  <div className="od-table-cell">Status</div>
                  <div className="od-table-cell">Market</div>
                  <div className="od-table-cell">Created</div>
                </div>

                {loading && (
                  <>
                    <OdSkeletonRow />
                    <OdSkeletonRow />
                    <OdSkeletonRow />
                    <OdSkeletonRow />
                  </>
                )}

                {!loading && filteredLeads.length === 0 && (
                  <div className="od-empty-state">
                    <div className="od-empty-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
                        <polyline points="12 15 17 21 7 21 12 15" />
                      </svg>
                    </div>
                    <span className="od-empty-title">No leads match your filters</span>
                    <span className="od-empty-text">Try a different filter or search term.</span>
                  </div>
                )}

                {!loading && filteredLeads.map((lead, i) => {
                  const id = lead._id || lead.id;
                  const isExpanded = expandedLead === id;
                  const market = lead.parsedIntent?.location || lead.parsedIntent?.city
                    ? `${lead.parsedIntent?.city || ''}${lead.parsedIntent?.state ? ', ' + lead.parsedIntent.state : ''}`
                    : '—';
                  const score = lead.intentScore || 0;

                  return (
                    <React.Fragment key={id}>
                      <div
                        className={`od-table-row ${isExpanded ? 'expanded' : ''}`}
                        style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                        onClick={() => setExpandedLead(isExpanded ? null : id)}
                      >
                        <div className="od-table-cell od-cell-name">
                          <span className="od-buyer-avatar">
                            {(lead.buyerName || lead.buyerEmail || '?')[0].toUpperCase()}
                          </span>
                          <div className="od-buyer-info">
                            <span className="od-buyer-name-text">{lead.buyerName || 'Unknown'}</span>
                            <span className="od-buyer-time">{timeAgo(lead.createdAt)}</span>
                          </div>
                        </div>
                        <div className={`od-table-cell od-cell-score ${score >= 70 ? 'score-high' : score >= 40 ? 'score-medium' : 'score-low'}`}>
                          {score}
                        </div>
                        <div className="od-table-cell">
                          <OdUrgencyBadge urgency={lead.urgency} />
                        </div>
                        <div className="od-table-cell">
                          <OdStatusBadge status={lead.status} />
                        </div>
                        <div className="od-table-cell od-cell-date">{market}</div>
                        <div className="od-table-cell od-cell-date">{formatDate(lead.createdAt)}</div>
                      </div>
                      {isExpanded && (
                        <div className="od-table-detail-row">
                          <OdLeadDetailPanel lead={lead} onClose={() => setExpandedLead(null)} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="od-mobile-cards">
              {!loading && filteredLeads.map((lead, i) => {
                const id = lead._id || lead.id;
                const isExpanded = expandedLead === id;
                const market = lead.parsedIntent?.location || lead.parsedIntent?.city
                  ? `${lead.parsedIntent?.city || ''}${lead.parsedIntent?.state ? ', ' + lead.parsedIntent.state : ''}`
                  : '—';

                return (
                  <div key={id} className="od-mobile-card" style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}>
                    <div className="od-mobile-card-header" onClick={() => setExpandedLead(isExpanded ? null : id)}>
                      <div className="od-mobile-card-name-row">
                        <span className="od-buyer-avatar">
                          {(lead.buyerName || '?')[0].toUpperCase()}
                        </span>
                        <div className="od-buyer-info">
                          <span className="od-buyer-name-text">{lead.buyerName || 'Unknown'}</span>
                          <span className="od-buyer-time">{timeAgo(lead.createdAt)}</span>
                        </div>
                      </div>
                      <div className="od-mobile-card-badges">
                        <OdUrgencyBadge urgency={lead.urgency} />
                        <OdStatusBadge status={lead.status} />
                      </div>
                    </div>
                    <div className="od-mobile-card-body">
                      <div className="od-mobile-card-row">
                        <span className="od-mobile-card-label">Score</span>
                        <span className={`od-cell-score ${lead.intentScore >= 70 ? 'score-high' : lead.intentScore >= 40 ? 'score-medium' : 'score-low'}`}>
                          {lead.intentScore || 0}
                        </span>
                      </div>
                      <div className="od-mobile-card-row">
                        <span className="od-mobile-card-label">Market</span>
                        <span>{market}</span>
                      </div>
                      <div className="od-mobile-card-row">
                        <span className="od-mobile-card-label">Payment</span>
                        <span style={{ color: lead.paymentStatus === 'paid' ? '#059669' : '#dc2626', fontWeight: 600, textTransform: 'capitalize' }}>
                          {lead.paymentStatus || 'unpaid'}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="od-mobile-card-detail">
                        <OdLeadDetailPanel lead={lead} onClose={() => setExpandedLead(null)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT: Sidebar */}
          <aside className="od-sidebar">
            {/* Revenue Overview */}
            <div className="od-sidebar-card">
              <h3>Revenue Overview</h3>
              <div className="od-revenue-row">
                <span className="od-revenue-label">Paid</span>
                <div className="od-revenue-bar-wrap">
                  <div className="od-revenue-bar od-bar-green" style={{ width: `${paidPct}%` }} />
                </div>
                <span className="od-revenue-amount">{formatCurrency(dashboard?.totalRevenue)}</span>
              </div>
              <div className="od-revenue-row">
                <span className="od-revenue-label">Invoiced</span>
                <div className="od-revenue-bar-wrap">
                  <div className="od-revenue-bar od-bar-yellow" style={{ width: `${invoicedPct}%` }} />
                </div>
                <span className="od-revenue-amount">{formatCurrency(dashboard?.pendingInvoices)}</span>
              </div>
              <div className="od-revenue-details">
                <span className="od-revenue-detail">Avg Fee: <strong>{formatCurrency(dashboard?.averageFee)}</strong></span>
                <span className="od-revenue-detail">Closed: <strong>{dashboard?.closed ?? 0}</strong></span>
                <span className="od-revenue-detail">Lost: <strong>{dashboard?.lost ?? 0}</strong></span>
              </div>
            </div>

            {/* Lead Urgency */}
            <div className="od-sidebar-card">
              <h3>Lead Urgency</h3>
              <div className="od-urgency-pills">
                <span className="od-pill od-pill-hot">{platformStats?.leadsByUrgency?.hot ?? 0} Hot</span>
                <span className="od-pill od-pill-warm">{platformStats?.leadsByUrgency?.warm ?? 0} Warm</span>
                <span className="od-pill od-pill-cool">{platformStats?.leadsByUrgency?.cool ?? 0} Cool</span>
              </div>
              <div className="od-avg-score">
                Avg Intent Score: <strong>{platformStats?.avgIntentScore ?? '—'}</strong>
              </div>
            </div>

            {/* Agent Network */}
            <div className="od-sidebar-card">
              <h3>Agent Network</h3>
              <div className="od-agent-summary">
                <span><strong>{agreements.length || dashboard?.activeAgreements || 0}</strong> agreements</span>
                <span><strong>{realtorLeads.length}</strong> registered</span>
              </div>
              <div className="od-agent-list">
                {realtorLeads.length === 0 && (
                  <div className="od-agent-empty">No agents registered yet</div>
                )}
                {realtorLeads.slice(0, 6).map((agent, i) => (
                  <div key={agent.id || i} className="od-agent-item">
                    <span className="od-agent-avatar">
                      {(agent.name || '?')[0].toUpperCase()}
                    </span>
                    <div>
                      <span className="od-agent-name">{agent.name}</span>
                      <span className="od-agent-meta">{agent.brokerage || agent.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Markets */}
            <div className="od-sidebar-card">
              <h3>Top Markets</h3>
              {(!platformStats?.topMarkets || platformStats.topMarkets.length === 0) ? (
                <div className="od-agent-empty">No market data yet</div>
              ) : (
                <div className="od-market-list">
                  {platformStats.topMarkets.slice(0, 5).map((m, i) => (
                    <div key={m.market} className="od-market-item">
                      <span className="od-market-rank">#{i + 1}</span>
                      <span className="od-market-name">{m.market}</span>
                      <span className="od-market-count">{m.count} lead{m.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* ── STALE LEADS ── */}
        <section className="od-stale-section">
          <div className="od-section-header">
            <h2>Stale Leads</h2>
            <span className="od-section-badge od-badge-warning">
              {staleLeads.length} need follow-up
            </span>
          </div>
          <div className="od-stale-grid">
            {staleLeads.length === 0 && (
              <div className="od-stale-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 6 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                All leads are active — no follow-up needed
              </div>
            )}
            {staleLeads.map((sl, i) => (
              <div key={sl.leadId || i} className="od-stale-card" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="od-stale-top">
                  <span className="od-stale-id">{sl.leadId}</span>
                  <span className="od-stale-days">{sl.daysSinceUpdate}d idle</span>
                </div>
                <span className="od-stale-buyer">{sl.buyerName || 'Unknown'}</span>
                <span className="od-stale-agent">Agent: {sl.agentName || 'Unassigned'}</span>
                <OdStatusBadge status={sl.status} />
              </div>
            ))}
          </div>
        </section>

        {/* ── CONVERSION FUNNEL ── */}
        {funnelData.length > 0 && (
          <section className="od-funnel-section">
            <h2>Conversion Funnel</h2>
            <div className="od-funnel-bars">
              {funnelData.map((step) => (
                <div key={step.key} className="od-funnel-row">
                  <span className="od-funnel-label">{step.label}</span>
                  <div className="od-funnel-bar-wrap">
                    <div
                      className={`od-funnel-bar ${step.cls}`}
                      style={{ width: `${step.pct}%` }}
                    >
                      <span className="od-funnel-bar-val">{step.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
