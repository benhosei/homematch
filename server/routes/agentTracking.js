const express = require('express');
const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// In-memory store (replace with Firestore or Postgres later)
// ──────────────────────────────────────────────────────────────────────────────

let leads = [];
let agreements = [];
let leadCounter = 0;

const LEAD_STATUSES = [
  'new',
  'sent_to_agent',
  'agent_accepted',
  'agent_declined',
  'tour_scheduled',
  'tour_completed_pending_verification',
  'tour_verified',
  'offer_submitted',
  'under_contract',
  'closed',
  'lost',
];

const LEAD_TIERS = {
  qualified_tour: { fee: 150, label: 'Qualified Tour Lead' },
  closing_ready: { fee: 250, label: 'Closing-Ready Lead' },
};

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: Generate lead ID
// ──────────────────────────────────────────────────────────────────────────────

function generateLeadId() {
  leadCounter++;
  const year = new Date().getFullYear();
  return `HM-${year}-${String(leadCounter).padStart(4, '0')}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tracking/leads — Create a new tracked lead
// ──────────────────────────────────────────────────────────────────────────────

router.post('/leads', (req, res) => {
  try {
    const {
      buyerName, buyerEmail, buyerPhone,
      readinessScore, maxBudget, preApproved,
      selectedListings, city, state,
      tier = 'qualified_tour',
    } = req.body;

    if (!buyerName || !buyerEmail) {
      return res.status(400).json({ error: 'buyerName and buyerEmail are required' });
    }

    const leadId = generateLeadId();
    const now = new Date().toISOString();

    const lead = {
      leadId,
      buyerName,
      buyerEmail,
      buyerPhone: buyerPhone || null,
      readinessScore: readinessScore || null,
      maxBudget: maxBudget || null,
      preApproved: preApproved || false,
      selectedListings: selectedListings || [],
      city: city || null,
      state: state || null,

      // Tier + fee
      tier,
      feeAmount: LEAD_TIERS[tier]?.fee || 150,

      // Status tracking
      status: 'new',
      statusHistory: [
        { status: 'new', at: now, by: 'system', note: 'Lead created from buyer funnel' },
      ],

      // Assignment
      assignedBrokerage: null,
      assignedAgent: null,
      assignedAgentEmail: null,
      assignedAt: null,

      // Verification
      agentConfirmedTour: false,
      buyerConfirmedTour: false,
      tourVerified: false,
      tourDate: null,

      // Payment
      paymentStatus: 'unpaid', // unpaid | invoiced | paid
      invoicedAt: null,
      paidAt: null,

      // Metadata
      createdAt: now,
      updatedAt: now,
      lastAgentPing: null,
      lastBuyerPing: null,
    };

    leads.push(lead);

    res.status(201).json({
      success: true,
      lead,
      message: `Lead ${leadId} created successfully`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/tracking/leads/:leadId/status — Update lead status
// ──────────────────────────────────────────────────────────────────────────────

router.put('/leads/:leadId/status', (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, by, note, tourDate } = req.body;

    const lead = leads.find((l) => l.leadId === leadId);
    if (!lead) {
      return res.status(404).json({ error: `Lead ${leadId} not found` });
    }

    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${LEAD_STATUSES.join(', ')}`,
      });
    }

    const now = new Date().toISOString();

    lead.status = status;
    lead.updatedAt = now;
    lead.statusHistory.push({
      status,
      at: now,
      by: by || 'unknown',
      note: note || null,
    });

    if (tourDate) lead.tourDate = tourDate;

    // Auto-actions based on status
    if (status === 'tour_verified' && lead.paymentStatus === 'unpaid') {
      lead.paymentStatus = 'invoiced';
      lead.invoicedAt = now;
    }

    res.json({
      success: true,
      lead,
      message: `Lead ${leadId} updated to "${status}"`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead status', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tracking/leads/:leadId/assign — Assign lead to agent/brokerage
// ──────────────────────────────────────────────────────────────────────────────

router.post('/leads/:leadId/assign', (req, res) => {
  try {
    const { leadId } = req.params;
    const { brokerageName, agentName, agentEmail } = req.body;

    const lead = leads.find((l) => l.leadId === leadId);
    if (!lead) {
      return res.status(404).json({ error: `Lead ${leadId} not found` });
    }

    const now = new Date().toISOString();

    lead.assignedBrokerage = brokerageName || lead.assignedBrokerage;
    lead.assignedAgent = agentName || lead.assignedAgent;
    lead.assignedAgentEmail = agentEmail || lead.assignedAgentEmail;
    lead.assignedAt = now;
    lead.status = 'sent_to_agent';
    lead.updatedAt = now;
    lead.statusHistory.push({
      status: 'sent_to_agent',
      at: now,
      by: 'system',
      note: `Assigned to ${agentName} at ${brokerageName}`,
    });

    res.json({
      success: true,
      lead,
      message: `Lead ${leadId} assigned to ${agentName}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign lead', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tracking/leads/:leadId/verify-tour — Dual verification
// ──────────────────────────────────────────────────────────────────────────────

router.post('/leads/:leadId/verify-tour', (req, res) => {
  try {
    const { leadId } = req.params;
    const { confirmedBy } = req.body; // 'agent' or 'buyer'

    const lead = leads.find((l) => l.leadId === leadId);
    if (!lead) {
      return res.status(404).json({ error: `Lead ${leadId} not found` });
    }

    const now = new Date().toISOString();

    if (confirmedBy === 'agent') {
      lead.agentConfirmedTour = true;
      lead.statusHistory.push({
        status: 'tour_confirmed_by_agent',
        at: now,
        by: lead.assignedAgent || 'agent',
        note: 'Agent confirmed the tour took place',
      });
    } else if (confirmedBy === 'buyer') {
      lead.buyerConfirmedTour = true;
      lead.statusHistory.push({
        status: 'tour_confirmed_by_buyer',
        at: now,
        by: lead.buyerName || 'buyer',
        note: 'Buyer confirmed the tour took place',
      });
    }

    // Dual verification check
    if (lead.agentConfirmedTour && lead.buyerConfirmedTour) {
      lead.tourVerified = true;
      lead.status = 'tour_verified';
      lead.paymentStatus = 'invoiced';
      lead.invoicedAt = now;
      lead.statusHistory.push({
        status: 'tour_verified',
        at: now,
        by: 'system',
        note: `Tour verified by both parties. Invoice: $${lead.feeAmount}`,
      });
    }

    lead.updatedAt = now;

    res.json({
      success: true,
      lead,
      tourVerified: lead.tourVerified,
      agentConfirmed: lead.agentConfirmedTour,
      buyerConfirmed: lead.buyerConfirmedTour,
      message: lead.tourVerified
        ? `Tour verified! Invoice of $${lead.feeAmount} generated.`
        : `${confirmedBy} confirmation recorded. Waiting for ${confirmedBy === 'agent' ? 'buyer' : 'agent'} confirmation.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify tour', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/leads — List leads with filters
// ──────────────────────────────────────────────────────────────────────────────

router.get('/leads', (req, res) => {
  try {
    let filtered = [...leads];

    // Filter by status
    if (req.query.status) {
      filtered = filtered.filter((l) => l.status === req.query.status);
    }

    // Filter by brokerage
    if (req.query.brokerage) {
      filtered = filtered.filter(
        (l) => l.assignedBrokerage?.toLowerCase().includes(req.query.brokerage.toLowerCase())
      );
    }

    // Filter by agent
    if (req.query.agent) {
      filtered = filtered.filter(
        (l) => l.assignedAgent?.toLowerCase().includes(req.query.agent.toLowerCase())
      );
    }

    // Filter by payment status
    if (req.query.paymentStatus) {
      filtered = filtered.filter((l) => l.paymentStatus === req.query.paymentStatus);
    }

    // Filter stale leads (no update in X days)
    if (req.query.staleDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(req.query.staleDays));
      filtered = filtered.filter((l) => new Date(l.updatedAt) < cutoff);
    }

    // Sort by most recent
    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Summary stats
    const stats = {
      total: leads.length,
      byStatus: {},
      totalRevenue: leads
        .filter((l) => l.paymentStatus === 'paid')
        .reduce((sum, l) => sum + l.feeAmount, 0),
      pendingRevenue: leads
        .filter((l) => l.paymentStatus === 'invoiced')
        .reduce((sum, l) => sum + l.feeAmount, 0),
      verifiedTours: leads.filter((l) => l.tourVerified).length,
    };

    LEAD_STATUSES.forEach((s) => {
      const count = leads.filter((l) => l.status === s).length;
      if (count > 0) stats.byStatus[s] = count;
    });

    res.json({
      success: true,
      leads: filtered,
      stats,
      count: filtered.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list leads', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/leads/:leadId — Get single lead with full audit log
// ──────────────────────────────────────────────────────────────────────────────

router.get('/leads/:leadId', (req, res) => {
  const lead = leads.find((l) => l.leadId === req.params.leadId);
  if (!lead) {
    return res.status(404).json({ error: `Lead ${req.params.leadId} not found` });
  }
  res.json({ success: true, lead });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tracking/leads/:leadId/payment — Mark lead as paid
// ──────────────────────────────────────────────────────────────────────────────

router.post('/leads/:leadId/payment', (req, res) => {
  try {
    const lead = leads.find((l) => l.leadId === req.params.leadId);
    if (!lead) {
      return res.status(404).json({ error: `Lead ${req.params.leadId} not found` });
    }

    const now = new Date().toISOString();
    lead.paymentStatus = 'paid';
    lead.paidAt = now;
    lead.updatedAt = now;
    lead.statusHistory.push({
      status: 'payment_received',
      at: now,
      by: req.body.by || 'system',
      note: `Payment of $${lead.feeAmount} received`,
    });

    res.json({
      success: true,
      lead,
      message: `Payment of $${lead.feeAmount} recorded for lead ${lead.leadId}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/stale-check — Find leads needing follow-up
// ──────────────────────────────────────────────────────────────────────────────

router.get('/stale-check', (req, res) => {
  const staleDays = parseInt(req.query.days) || 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const activeStatuses = ['sent_to_agent', 'agent_accepted', 'tour_scheduled', 'tour_completed_pending_verification'];
  const staleLeads = leads.filter(
    (l) => activeStatuses.includes(l.status) && new Date(l.updatedAt) < cutoff
  );

  const agentPingsNeeded = staleLeads.map((l) => ({
    leadId: l.leadId,
    buyerName: l.buyerName,
    agentName: l.assignedAgent,
    agentEmail: l.assignedAgentEmail,
    status: l.status,
    daysSinceUpdate: Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  res.json({
    success: true,
    staleLeads: agentPingsNeeded,
    count: agentPingsNeeded.length,
    message: `Found ${agentPingsNeeded.length} leads needing follow-up (no update in ${staleDays}+ days)`,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tracking/agreements — Register a brokerage agreement
// ──────────────────────────────────────────────────────────────────────────────

router.post('/agreements', (req, res) => {
  try {
    const {
      brokerageName, managingBrokerName, managingBrokerEmail,
      address, phone, signedAt,
    } = req.body;

    if (!brokerageName || !managingBrokerEmail) {
      return res.status(400).json({ error: 'brokerageName and managingBrokerEmail are required' });
    }

    const agreement = {
      id: `AGR-${Date.now()}`,
      brokerageName,
      managingBrokerName: managingBrokerName || null,
      managingBrokerEmail,
      address: address || null,
      phone: phone || null,
      signedAt: signedAt || new Date().toISOString(),
      status: 'active', // active | suspended | terminated
      freeLeadsRemaining: 3,
      totalLeadsDelivered: 0,
      totalRevenue: 0,
      createdAt: new Date().toISOString(),
    };

    agreements.push(agreement);

    res.status(201).json({
      success: true,
      agreement,
      message: `Agreement with ${brokerageName} created. 3 free leads included.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create agreement', details: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/agreements — List all brokerage agreements
// ──────────────────────────────────────────────────────────────────────────────

router.get('/agreements', (req, res) => {
  res.json({
    success: true,
    agreements,
    count: agreements.length,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/tracking/dashboard — KPI dashboard summary
// ──────────────────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentLeads = leads.filter((l) => new Date(l.createdAt) > thirtyDaysAgo);

  const dashboard = {
    // Pipeline
    totalLeads: leads.length,
    leadsThisMonth: recentLeads.length,
    byStatus: {},

    // Conversion
    toursScheduled: leads.filter((l) => ['tour_scheduled', 'tour_completed_pending_verification', 'tour_verified', 'offer_submitted', 'under_contract', 'closed'].includes(l.status)).length,
    toursVerified: leads.filter((l) => l.tourVerified).length,
    offersSubmitted: leads.filter((l) => ['offer_submitted', 'under_contract', 'closed'].includes(l.status)).length,
    underContract: leads.filter((l) => l.status === 'under_contract').length,
    closed: leads.filter((l) => l.status === 'closed').length,
    lost: leads.filter((l) => l.status === 'lost').length,

    // Revenue
    totalRevenue: leads.filter((l) => l.paymentStatus === 'paid').reduce((s, l) => s + l.feeAmount, 0),
    pendingInvoices: leads.filter((l) => l.paymentStatus === 'invoiced').reduce((s, l) => s + l.feeAmount, 0),
    averageFee: leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.feeAmount, 0) / leads.length) : 0,

    // Agents
    activeAgreements: agreements.filter((a) => a.status === 'active').length,
    totalAgreements: agreements.length,

    // Health
    staleLeads: leads.filter((l) => {
      const daysSince = (now - new Date(l.updatedAt)) / (1000 * 60 * 60 * 24);
      return daysSince > 7 && !['closed', 'lost'].includes(l.status);
    }).length,
  };

  LEAD_STATUSES.forEach((s) => {
    const count = leads.filter((l) => l.status === s).length;
    if (count > 0) dashboard.byStatus[s] = count;
  });

  res.json({ success: true, dashboard });
});

module.exports = router;
