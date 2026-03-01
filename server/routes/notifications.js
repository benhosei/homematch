/**
 * Notifications & Verification Routes
 *
 * POST /api/notify/send-verification    — Send verification emails to agent + buyer
 * POST /api/notify/verify-tour          — Verify a tour via token
 * GET  /api/notify/verify-status/:leadId — Check verification status
 * POST /api/notify/send-lead-alert      — Notify agent about a new lead
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendLeadNotification, sendVerificationEmail, sendInvoiceEmail } = require('../services/emailService');
const { createInvoice } = require('../services/stripeService');

// ──────────────────────────────────────────────────────────────────────
// In-memory verification token store
// In production, use Redis or Firestore with TTL
// ──────────────────────────────────────────────────────────────────────

const verifyTokens = new Map(); // token → { leadId, party, createdAt }
const leadVerifications = new Map(); // leadId → { agentConfirmed, buyerConfirmed, agentToken, buyerToken }

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/notify/send-lead-alert — Notify agent about new lead
// ──────────────────────────────────────────────────────────────────────

router.post('/send-lead-alert', async (req, res) => {
  try {
    const { agentEmail, agentName, lead } = req.body;

    if (!agentEmail || !lead) {
      return res.status(400).json({ error: 'agentEmail and lead are required' });
    }

    const result = await sendLeadNotification({ agentEmail, agentName, lead });

    res.json({
      success: result.success,
      devMode: result.devMode || false,
      message: result.success
        ? `Lead notification sent to ${agentEmail}`
        : 'Failed to send notification',
    });
  } catch (err) {
    console.error('Send lead alert error:', err);
    res.status(500).json({ error: 'Failed to send lead alert' });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /api/notify/send-verification — Send verification emails
// ──────────────────────────────────────────────────────────────────────

router.post('/send-verification', async (req, res) => {
  try {
    const { leadId, lead, agentEmail, agentName, buyerEmail, buyerName } = req.body;

    if (!leadId || !agentEmail || !buyerEmail) {
      return res.status(400).json({
        error: 'leadId, agentEmail, and buyerEmail are required',
      });
    }

    // Generate unique tokens for each party
    const agentToken = generateToken();
    const buyerToken = generateToken();

    // Store tokens
    verifyTokens.set(agentToken, { leadId, party: 'agent', createdAt: Date.now() });
    verifyTokens.set(buyerToken, { leadId, party: 'buyer', createdAt: Date.now() });

    // Initialize verification state for this lead
    leadVerifications.set(leadId, {
      agentConfirmed: false,
      buyerConfirmed: false,
      agentToken,
      buyerToken,
      agentEmail,
      buyerEmail,
      agentName: agentName || null,
      buyerName: buyerName || null,
      lead: lead || null,
      createdAt: Date.now(),
    });

    // Send emails to both parties
    const [agentResult, buyerResult] = await Promise.all([
      sendVerificationEmail({
        to: agentEmail,
        name: agentName,
        leadId,
        verifyToken: agentToken,
        party: 'agent',
        lead,
      }),
      sendVerificationEmail({
        to: buyerEmail,
        name: buyerName,
        leadId,
        verifyToken: buyerToken,
        party: 'buyer',
        lead,
      }),
    ]);

    res.json({
      success: true,
      agentEmailSent: agentResult.success,
      buyerEmailSent: buyerResult.success,
      message: 'Verification emails sent to both parties',
    });
  } catch (err) {
    console.error('Send verification error:', err);
    res.status(500).json({ error: 'Failed to send verification emails' });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /api/notify/verify-tour — Confirm a tour via token
// ──────────────────────────────────────────────────────────────────────

router.post('/verify-tour', async (req, res) => {
  try {
    const { token, leadId } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Look up token
    const tokenData = verifyTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Ensure leadId matches (extra safety)
    if (leadId && tokenData.leadId !== leadId) {
      return res.status(400).json({ error: 'Token does not match this lead' });
    }

    const verification = leadVerifications.get(tokenData.leadId);
    if (!verification) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    // Mark the appropriate party as confirmed
    if (tokenData.party === 'agent') {
      verification.agentConfirmed = true;
    } else if (tokenData.party === 'buyer') {
      verification.buyerConfirmed = true;
    }

    // Invalidate used token (one-time use)
    verifyTokens.delete(token);

    // Check if both parties confirmed
    const tourVerified = verification.agentConfirmed && verification.buyerConfirmed;

    let invoiceResult = null;
    if (tourVerified) {
      // Both confirmed — tour is verified!
      // Try to create Stripe invoice
      const lead = verification.lead || { leadId: tokenData.leadId, feeAmount: 150, tier: 'qualified_tour' };
      const brokerageEmail = verification.agentEmail;
      const brokerageName = verification.agentName || 'Agent';

      invoiceResult = await createInvoice(lead, { email: brokerageEmail, name: brokerageName });

      // Send invoice email
      await sendInvoiceEmail({
        to: brokerageEmail,
        brokerageName,
        lead,
        invoiceUrl: invoiceResult.hostedUrl || null,
      });
    }

    res.json({
      success: true,
      party: tokenData.party,
      leadId: tokenData.leadId,
      agentConfirmed: verification.agentConfirmed,
      buyerConfirmed: verification.buyerConfirmed,
      tourVerified,
      invoice: invoiceResult || null,
      message: tourVerified
        ? 'Tour verified by both parties! Invoice has been sent.'
        : `Thank you! Waiting for ${tokenData.party === 'agent' ? 'buyer' : 'agent'} confirmation.`,
    });
  } catch (err) {
    console.error('Verify tour error:', err);
    res.status(500).json({ error: 'Failed to verify tour' });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /api/notify/verify-status/:leadId — Check verification status
// ──────────────────────────────────────────────────────────────────────

router.get('/verify-status/:leadId', (req, res) => {
  const verification = leadVerifications.get(req.params.leadId);

  if (!verification) {
    return res.status(404).json({
      error: 'No verification record found for this lead',
      agentConfirmed: false,
      buyerConfirmed: false,
      tourVerified: false,
    });
  }

  res.json({
    success: true,
    leadId: req.params.leadId,
    agentConfirmed: verification.agentConfirmed,
    buyerConfirmed: verification.buyerConfirmed,
    tourVerified: verification.agentConfirmed && verification.buyerConfirmed,
  });
});

module.exports = router;
