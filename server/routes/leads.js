const express = require('express');
const router = express.Router();
const { sendLeadNotification, sendBuyerConfirmation } = require('../services/emailService');

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------
const leads = [];
const agents = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateLeadId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `LEAD-${ts}-${rand}`;
}

function generateAgentId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `AGT-${ts}-${rand}`;
}

function calculateIntentScore(data) {
  let score = 10; // base for submitting at all

  if (data.buyerPhone) score += 20;

  if (data.affordability && data.affordability.income) score += 15;

  if (data.parsedIntent) {
    if (data.parsedIntent.budget || data.parsedIntent.maxPrice) score += 20;
    if (data.parsedIntent.location || data.parsedIntent.city) score += 10;
  }

  if (data.lifestyleProfile) score += 10;

  if (data.selectedListings && data.selectedListings.length > 0) score += 15;

  return Math.min(score, 100);
}

function urgencyFromScore(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cool';
}

function omitPhone(lead) {
  const { buyerPhone, ...rest } = lead;
  return rest;
}

// ---------------------------------------------------------------------------
// Seed demo leads
// ---------------------------------------------------------------------------

leads.push(
  {
    id: 'LEAD-seed-0001',
    buyerName: 'Marcus Johnson',
    buyerEmail: 'marcus.j@email.com',
    buyerPhone: '512-555-0147',
    prompt: 'Remote worker wanting 3bed house with office in Austin TX under 450k',
    parsedIntent: {
      budget: 450000,
      maxPrice: 450000,
      beds: 3,
      location: 'Austin, TX',
      city: 'Austin',
      state: 'TX',
      propertyType: 'house',
      features: ['office', 'home office'],
    },
    lifestyleProfile: {
      workStyle: 'remote',
      priorities: ['dedicated office space', 'quiet neighborhood', 'good internet'],
    },
    affordability: { income: 120000, preApproved: true },
    selectedListings: ['listing-101', 'listing-102'],
    source: 'website-chat',
    intentScore: 85,
    urgency: 'hot',
    status: 'new',
    tourDate: null,
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
  },
  {
    id: 'LEAD-seed-0002',
    buyerName: 'Sarah & David Chen',
    buyerEmail: 'chen.family@email.com',
    buyerPhone: '317-555-0239',
    prompt: 'Growing family needs 4bed 3bath near good schools in Indianapolis under 350k',
    parsedIntent: {
      budget: 350000,
      maxPrice: 350000,
      beds: 4,
      baths: 3,
      location: 'Indianapolis, IN',
      city: 'Indianapolis',
      state: 'IN',
      propertyType: 'house',
      features: ['good schools', 'family-friendly'],
    },
    lifestyleProfile: {
      familySize: 'growing',
      priorities: ['school district', 'safe neighborhood', 'backyard'],
    },
    affordability: { income: 105000, preApproved: true },
    selectedListings: ['listing-201'],
    source: 'platform',
    intentScore: 72,
    urgency: 'hot',
    status: 'new',
    tourDate: null,
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
  },
  {
    id: 'LEAD-seed-0003',
    buyerName: 'Jessica Rivera',
    buyerEmail: 'jrivera@email.com',
    buyerPhone: null,
    prompt: 'First time buyer, make 85k, need something affordable in Miami',
    parsedIntent: {
      location: 'Miami, FL',
      city: 'Miami',
      state: 'FL',
      buyerType: 'first-time',
    },
    lifestyleProfile: {
      buyerType: 'first-time',
      priorities: ['affordability', 'close to work'],
    },
    affordability: { income: 85000, preApproved: false },
    selectedListings: [],
    source: 'website-chat',
    intentScore: 55,
    urgency: 'warm',
    status: 'new',
    tourDate: null,
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
  },
  {
    id: 'LEAD-seed-0004',
    buyerName: 'Robert Kim',
    buyerEmail: 'rkim.invest@email.com',
    buyerPhone: '404-555-0188',
    prompt: 'Investor looking for multi-family rental properties',
    parsedIntent: {
      propertyType: 'multi-family',
      purpose: 'investment',
      features: ['rental income', 'multi-unit'],
    },
    lifestyleProfile: null,
    affordability: null,
    selectedListings: [],
    source: 'landing-page',
    intentScore: 40,
    urgency: 'warm',
    status: 'new',
    tourDate: null,
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
  },
  {
    id: 'LEAD-seed-0005',
    buyerName: null,
    buyerEmail: 'poolbrowser@email.com',
    buyerPhone: null,
    prompt: 'Just browsing homes with pools',
    parsedIntent: {
      features: ['pool'],
    },
    lifestyleProfile: null,
    affordability: null,
    selectedListings: [],
    source: 'organic',
    intentScore: 25,
    urgency: 'cool',
    status: 'new',
    tourDate: null,
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    claimedBy: null,
    claimedAt: null,
  }
);

// ---------------------------------------------------------------------------
// POST /capture
// ---------------------------------------------------------------------------
router.post('/capture', (req, res) => {
  try {
    const {
      buyerName,
      buyerEmail,
      buyerPhone,
      prompt,
      parsedIntent,
      lifestyleProfile,
      affordability,
      selectedListings,
      source,
      timeline,
      preapproved,
      preferredDate,
      preferredTime,
      message,
    } = req.body;

    if (!buyerEmail) {
      return res.status(400).json({ error: 'buyerEmail is required' });
    }

    const id = generateLeadId();
    const intentScore = calculateIntentScore(req.body);
    const urgency = urgencyFromScore(intentScore);

    const lead = {
      id,
      buyerName: buyerName || null,
      buyerEmail,
      buyerPhone: buyerPhone || null,
      prompt: prompt || message || `Tour request from ${buyerName || buyerEmail}`,
      parsedIntent: parsedIntent || null,
      lifestyleProfile: lifestyleProfile || null,
      affordability: affordability || null,
      selectedListings: selectedListings || [],
      source: source || 'unknown',
      timeline: timeline || null,
      preapproved: preapproved || false,
      preferredDate: preferredDate || null,
      preferredTime: preferredTime || null,
      intentScore,
      urgency,
      status: 'new',
      tourDate: preferredDate || null,
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      claimedBy: null,
      claimedAt: null,
    };

    leads.push(lead);

    // Send response immediately — don't block on emails
    res.status(201).json({ success: true, leadId: id, intentScore, urgency });

    // Fire off notification emails in the background (non-blocking)
    const notificationEmail = process.env.NOTIFICATION_EMAIL;

    // 1) Notify agent / site owner about the new lead
    if (notificationEmail) {
      sendLeadNotification({
        agentEmail: notificationEmail,
        agentName: process.env.NOTIFICATION_NAME || 'HomeMatch Team',
        lead,
      }).catch((err) => console.error('[EMAIL] Agent notification failed:', err));
    } else {
      console.warn('[EMAIL] No NOTIFICATION_EMAIL set — agent was NOT notified of new lead', id);
    }

    // 2) Send confirmation email to the buyer
    if (buyerEmail) {
      sendBuyerConfirmation({
        buyerEmail,
        buyerName: buyerName || null,
        lead,
      }).catch((err) => console.error('[EMAIL] Buyer confirmation failed:', err));
    }
  } catch (err) {
    console.error('Lead capture error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// ---------------------------------------------------------------------------
// Realtor leads storage
// ---------------------------------------------------------------------------
const realtorLeads = [];

// ---------------------------------------------------------------------------
// GET / (alias for /feed without pagination for dashboard)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const sorted = [...leads].sort((a, b) => {
      if (b.intentScore !== a.intentScore) return b.intentScore - a.intentScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    res.json(sorted);
  } catch (err) {
    console.error('Lead list error:', err);
    res.status(500).json({ error: 'Failed to retrieve leads' });
  }
});

// ---------------------------------------------------------------------------
// POST /realtor-interest
// ---------------------------------------------------------------------------
router.post('/realtor-interest', (req, res) => {
  try {
    const { name, email, brokerage, markets } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const entry = {
      id: 'RLT-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      name,
      email,
      brokerage: brokerage || null,
      markets: markets || null,
      createdAt: new Date().toISOString(),
    };
    realtorLeads.push(entry);
    res.status(201).json({ success: true, id: entry.id });
  } catch (err) {
    console.error('Realtor interest error:', err);
    res.status(500).json({ error: 'Failed to capture realtor interest' });
  }
});

// ---------------------------------------------------------------------------
// GET /realtor-leads
// ---------------------------------------------------------------------------
router.get('/realtor-leads', (req, res) => {
  try {
    const sorted = [...realtorLeads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ leads: sorted, total: sorted.length });
  } catch (err) {
    console.error('Realtor leads error:', err);
    res.status(500).json({ error: 'Failed to retrieve realtor leads' });
  }
});

// ---------------------------------------------------------------------------
// GET /feed
// ---------------------------------------------------------------------------
router.get('/feed', (req, res) => {
  try {
    const { status, urgency, limit = 20, offset = 0, agentId } = req.query;
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    let filtered = [...leads];

    if (status) {
      filtered = filtered.filter((l) => l.status === status);
    }

    if (urgency) {
      filtered = filtered.filter((l) => l.urgency === urgency);
    }

    if (agentId) {
      filtered = filtered.filter(
        (l) => l.claimedBy && l.claimedBy.agentId === agentId
      );
    }

    // Sort by intentScore desc, then createdAt desc
    filtered.sort((a, b) => {
      if (b.intentScore !== a.intentScore) return b.intentScore - a.intentScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = filtered.length;
    const paged = filtered.slice(offsetNum, offsetNum + limitNum);
    const hasMore = offsetNum + limitNum < total;

    // Omit buyerPhone from feed results
    const sanitized = paged.map(omitPhone);

    res.json({ leads: sanitized, total, hasMore });
  } catch (err) {
    console.error('Lead feed error:', err);
    res.status(500).json({ error: 'Failed to retrieve leads' });
  }
});

// ---------------------------------------------------------------------------
// POST /claim
// ---------------------------------------------------------------------------
router.post('/claim', (req, res) => {
  try {
    const { leadId, agentId, agentName, agentEmail } = req.body;

    if (!leadId || !agentId || !agentName) {
      return res.status(400).json({
        error: 'leadId, agentId, and agentName are required',
      });
    }

    const lead = leads.find((l) => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.claimedBy) {
      return res.status(409).json({ error: 'Lead already claimed' });
    }

    lead.status = 'claimed';
    lead.claimedBy = agentId;
    lead.claimedByName = agentName;
    lead.claimedByEmail = agentEmail || null;
    lead.claimedAt = new Date().toISOString();

    // Return full lead WITH phone
    res.json({ success: true, lead });
  } catch (err) {
    console.error('Lead claim error:', err);
    res.status(500).json({ error: 'Failed to claim lead' });
  }
});

// ---------------------------------------------------------------------------
// POST /agent/register
// ---------------------------------------------------------------------------
router.post('/agent/register', (req, res) => {
  try {
    const { name, email, phone, brokerage, markets, specialties } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const agentId = generateAgentId();

    const agent = {
      agentId,
      name,
      email,
      phone: phone || null,
      brokerage: brokerage || null,
      markets: markets || [],
      specialties: specialties || [],
      registeredAt: new Date().toISOString(),
    };

    agents.push(agent);

    res.status(201).json({ success: true, agentId, agent });
  } catch (err) {
    console.error('Agent registration error:', err);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

// ---------------------------------------------------------------------------
// GET /agent/:agentId/stats
// ---------------------------------------------------------------------------
router.get('/agent/:agentId/stats', (req, res) => {
  try {
    const { agentId } = req.params;

    const claimedLeads = leads.filter(
      (l) => l.claimedBy && l.claimedBy.agentId === agentId
    );

    const leadsByUrgency = { hot: 0, warm: 0, cool: 0 };
    claimedLeads.forEach((l) => {
      if (leadsByUrgency[l.urgency] !== undefined) {
        leadsByUrgency[l.urgency]++;
      }
    });

    // Last 5 claimed leads, most recent first
    const recentLeads = [...claimedLeads]
      .sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt))
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        buyerName: l.buyerName,
        prompt: l.prompt,
        intentScore: l.intentScore,
        urgency: l.urgency,
        claimedAt: l.claimedAt,
      }));

    res.json({
      agentId,
      totalClaimed: claimedLeads.length,
      leadsByUrgency,
      recentLeads,
    });
  } catch (err) {
    console.error('Agent stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve agent stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /stats
// ---------------------------------------------------------------------------
router.get('/stats', (req, res) => {
  try {
    const totalLeads = leads.length;
    const newLeads = leads.filter((l) => l.status === 'new').length;
    const claimedLeads = leads.filter((l) => l.status === 'claimed').length;

    const leadsByUrgency = { hot: 0, warm: 0, cool: 0 };
    leads.forEach((l) => {
      if (leadsByUrgency[l.urgency] !== undefined) {
        leadsByUrgency[l.urgency]++;
      }
    });

    const avgIntentScore =
      totalLeads > 0
        ? Math.round(leads.reduce((sum, l) => sum + l.intentScore, 0) / totalLeads)
        : 0;

    // Top markets based on parsedIntent location/city
    const marketCounts = {};
    leads.forEach((l) => {
      if (l.parsedIntent) {
        const market =
          l.parsedIntent.location || l.parsedIntent.city || null;
        if (market) {
          marketCounts[market] = (marketCounts[market] || 0) + 1;
        }
      }
    });

    const topMarkets = Object.entries(marketCounts)
      .map(([market, count]) => ({ market, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalLeads,
      newLeads,
      claimedLeads,
      leadsByUrgency,
      avgIntentScore,
      topMarkets,
    });
  } catch (err) {
    console.error('Platform stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:leadId/status  — Update lead tour status
// ---------------------------------------------------------------------------
router.patch('/:leadId/status', (req, res) => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'tour_scheduled', 'tour_completed', 'no_show'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    lead.status = status;

    // If scheduling a tour and no tour date exists, set one
    if (status === 'tour_scheduled' && !lead.tourDate) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      lead.tourDate = nextWeek.toISOString();
    }

    // If moving away from tour_completed, reset payment status
    if (status !== 'tour_completed') {
      lead.paymentStatus = 'unpaid';
    }

    res.json({ success: true, lead });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:leadId/payment  — Toggle payment status for verified tours
// ---------------------------------------------------------------------------
router.patch('/:leadId/payment', (req, res) => {
  try {
    const { leadId } = req.params;
    const { paymentStatus } = req.body;

    if (!paymentStatus || !['paid', 'unpaid'].includes(paymentStatus)) {
      return res.status(400).json({
        error: 'Invalid paymentStatus. Must be "paid" or "unpaid".',
      });
    }

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.status !== 'tour_completed') {
      return res.status(400).json({
        error: 'Payment can only be set for leads with tour_completed status.',
      });
    }

    lead.paymentStatus = paymentStatus;

    res.json({ success: true, lead });
  } catch (err) {
    console.error('Payment update error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

module.exports = router;
