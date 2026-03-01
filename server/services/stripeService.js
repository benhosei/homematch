/**
 * Stripe Service — Creates invoices for verified tour leads.
 *
 * Set STRIPE_SECRET_KEY in .env (starts with sk_test_ or sk_live_)
 * Fallback: logs to console if no key is configured (dev mode).
 *
 * Flow:
 * 1. Tour verified → createInvoice(lead, brokerage)
 * 2. Stripe creates a draft invoice + sends it to brokerage email
 * 3. Brokerage pays via Stripe-hosted invoice page
 * 4. Webhook (optional) marks lead as paid
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

let stripe = null;
if (STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
    console.log('[STRIPE] Initialized successfully');
  } catch (err) {
    console.warn('[STRIPE] Failed to initialize:', err.message);
    console.warn('[STRIPE] Run: cd server && npm install stripe');
  }
}

/**
 * Create or find a Stripe customer for the brokerage.
 */
async function getOrCreateCustomer({ email, name }) {
  if (!stripe) return null;

  // Search for existing customer by email
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { source: 'homematch' },
  });

  return customer;
}

/**
 * Create and send a Stripe invoice for a verified tour lead.
 *
 * @param {Object} lead - The lead object (from agentTracking)
 * @param {Object} brokerage - { email, name }
 * @returns {Object} { success, invoiceId, invoiceUrl, hostedUrl }
 */
async function createInvoice(lead, brokerage) {
  const amount = lead.feeAmount || 150;
  const description = `HomeMatch Tour Lead Fee — ${lead.buyerName || lead.leadId || lead.id} (${lead.tier === 'closing_ready' ? 'Closing-Ready' : 'Qualified Tour'})`;

  if (!stripe) {
    console.log('──────────────────────────────────────');
    console.log('[STRIPE - DEV MODE] No STRIPE_SECRET_KEY set');
    console.log(`  Brokerage: ${brokerage.name} <${brokerage.email}>`);
    console.log(`  Amount: $${amount}`);
    console.log(`  Description: ${description}`);
    console.log(`  Lead: ${lead.leadId || lead.id}`);
    console.log('──────────────────────────────────────');
    return {
      success: true,
      devMode: true,
      invoiceId: `dev-inv-${Date.now()}`,
      invoiceUrl: null,
      hostedUrl: null,
      amount,
    };
  }

  try {
    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      email: brokerage.email,
      name: brokerage.name,
    });

    if (!customer) {
      return { success: false, error: 'Failed to create Stripe customer' };
    }

    // Create invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
      description,
      metadata: {
        leadId: lead.leadId || lead.id || '',
        buyerName: lead.buyerName || '',
        tier: lead.tier || 'qualified_tour',
      },
    });

    // Create and finalize the invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 14,
      auto_advance: true,
      metadata: {
        leadId: lead.leadId || lead.id || '',
        source: 'homematch',
      },
    });

    // Finalize (locks it for payment)
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    // Send the invoice to the customer
    await stripe.invoices.sendInvoice(finalized.id);

    console.log(`[STRIPE] Invoice ${finalized.id} sent to ${brokerage.email} for $${amount}`);

    return {
      success: true,
      invoiceId: finalized.id,
      invoiceUrl: finalized.invoice_pdf,
      hostedUrl: finalized.hosted_invoice_url,
      amount,
    };
  } catch (err) {
    console.error('[STRIPE] Invoice creation failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check invoice payment status.
 */
async function getInvoiceStatus(invoiceId) {
  if (!stripe) return { status: 'unknown', devMode: true };

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      status: invoice.status, // draft, open, paid, void, uncollectible
      amountDue: invoice.amount_due / 100,
      amountPaid: invoice.amount_paid / 100,
      hostedUrl: invoice.hosted_invoice_url,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

module.exports = {
  createInvoice,
  getInvoiceStatus,
  getOrCreateCustomer,
};
