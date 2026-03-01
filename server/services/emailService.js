/**
 * Email Service — Sends lead notifications and tour verification links.
 *
 * Uses Resend (resend.com) — set RESEND_API_KEY in .env
 * Fallback: logs to console if no key is configured (dev mode).
 *
 * Free tier: 100 emails/day, 3,000/month — plenty for early-stage.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'HomeMatch <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Simple HTTP-based Resend client (no SDK needed)
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log('──────────────────────────────────────');
    console.log('[EMAIL - DEV MODE] No RESEND_API_KEY set');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${html.substring(0, 200)}...`);
    console.log('──────────────────────────────────────');
    return { success: true, devMode: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[EMAIL] Send failed:', data);
      return { success: false, error: data };
    }

    console.log(`[EMAIL] Sent to ${to}: "${subject}"`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[EMAIL] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Email Templates ────────────────────────────────────────────────

/**
 * Notify agent about a new lead
 */
async function sendLeadNotification({ agentEmail, agentName, lead }) {
  const listings = (lead.selectedListings || [])
    .map((l) => {
      const addr = typeof l.address === 'string' ? l.address : l.address?.full || 'Address';
      const price = l.price ? `$${Number(l.price).toLocaleString()}` : '';
      return `<li>${addr} ${price ? `— ${price}` : ''}</li>`;
    })
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">New Lead from HomeMatch</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi ${agentName || 'there'},</p>
        <p style="margin: 0 0 16px; color: #374151;">A qualified buyer wants to tour homes in your area.</p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Buyer</td><td style="padding: 4px 0; font-weight: 600;">${lead.buyerName || 'Not provided'}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 4px 0;">${lead.buyerEmail}</td></tr>
            ${lead.buyerPhone ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Phone</td><td style="padding: 4px 0;">${lead.buyerPhone}</td></tr>` : ''}
            ${lead.maxBudget ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Budget</td><td style="padding: 4px 0; font-weight: 600;">Up to $${Number(lead.maxBudget).toLocaleString()}</td></tr>` : ''}
            ${lead.readinessScore ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Readiness</td><td style="padding: 4px 0;">${lead.readinessScore}/100</td></tr>` : ''}
            ${lead.preApproved || lead.preapproved ? '<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Pre-Approved</td><td style="padding: 4px 0; color: #059669; font-weight: 600;">Yes</td></tr>' : ''}
            ${lead.timeline ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Timeline</td><td style="padding: 4px 0;">${lead.timeline}</td></tr>` : ''}
          </table>
        </div>

        ${listings ? `
          <p style="margin: 0 0 8px; font-weight: 600; color: #374151; font-size: 14px;">Properties of interest:</p>
          <ul style="margin: 0 0 16px; padding-left: 20px; color: #374151; font-size: 14px;">${listings}</ul>
        ` : ''}

        ${lead.message ? `
          <p style="margin: 0 0 8px; font-weight: 600; color: #374151; font-size: 14px;">Message from buyer:</p>
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px; font-style: italic;">"${lead.message}"</p>
        ` : ''}

        <p style="margin: 0; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          This lead was sent via <a href="${APP_URL}" style="color: #3b82f6; text-decoration: none;">HomeMatch</a>.
          After the tour, both parties will receive a verification link.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: agentEmail,
    subject: `New Lead: ${lead.buyerName || 'Buyer'} wants to tour homes${lead.city ? ` in ${lead.city}` : ''}`,
    html,
  });
}

/**
 * Send tour verification link to agent or buyer
 */
async function sendVerificationEmail({ to, name, leadId, verifyToken, party, lead }) {
  const verifyUrl = `${APP_URL}/verify/${leadId}?token=${verifyToken}&party=${party}`;
  const otherParty = party === 'agent' ? 'buyer' : 'agent';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Confirm Your Tour</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi ${name || 'there'},</p>
        <p style="margin: 0 0 20px; color: #374151;">
          Please confirm that the home tour took place. Both the ${otherParty} and you need to confirm before the tour is marked as verified.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Confirm Tour Happened
          </a>
        </div>

        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
          Or copy this link: <br/>
          <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all; font-size: 12px;">${verifyUrl}</a>
        </p>

        <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          This verification is for lead ${leadId}. If you did not participate in this tour, please ignore this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Confirm your HomeMatch tour — ${lead?.buyerName || leadId}`,
    html,
  });
}

/**
 * Send confirmation email to buyer after they request a tour
 */
async function sendBuyerConfirmation({ buyerEmail, buyerName, lead }) {
  const listings = (lead.selectedListings || [])
    .map((l) => {
      const addr = typeof l.address === 'string' ? l.address : l.address?.full || 'Address';
      const price = l.price ? `$${Number(l.price).toLocaleString()}` : '';
      return `<li>${addr} ${price ? `— ${price}` : ''}</li>`;
    })
    .join('');

  const dateStr = lead.preferredDate
    ? new Date(lead.preferredDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const timeStr = lead.preferredTime
    ? lead.preferredTime.charAt(0).toUpperCase() + lead.preferredTime.slice(1)
    : null;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Tour Request Received!</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi ${buyerName || 'there'},</p>
        <p style="margin: 0 0 16px; color: #374151;">
          Thank you for scheduling a tour with HomeMatch! We've received your request and a local agent will be reaching out to you shortly to confirm the details.
        </p>

        ${dateStr || timeStr ? `
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-weight: 600;">Your Preferred Schedule</p>
            ${dateStr ? `<p style="margin: 4px 0; color: #1e293b; font-size: 15px;">${dateStr}</p>` : ''}
            ${timeStr ? `<p style="margin: 4px 0; color: #1e293b; font-size: 15px;">${timeStr}</p>` : ''}
          </div>
        ` : ''}

        ${listings ? `
          <p style="margin: 0 0 8px; font-weight: 600; color: #374151; font-size: 14px;">Properties you're interested in:</p>
          <ul style="margin: 0 0 16px; padding-left: 20px; color: #374151; font-size: 14px;">${listings}</ul>
        ` : ''}

        <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">
          If you have any questions in the meantime, feel free to reply to this email.
        </p>

        <p style="margin: 0; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Sent by <a href="${APP_URL}" style="color: #3b82f6; text-decoration: none;">HomeMatch</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: buyerEmail,
    subject: `Your tour request has been received — HomeMatch`,
    html,
  });
}

/**
 * Send invoice notification to brokerage
 */
async function sendInvoiceEmail({ to, brokerageName, lead, invoiceUrl }) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Tour Verified — Invoice</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi ${brokerageName || 'there'},</p>
        <p style="margin: 0 0 16px; color: #374151;">
          The tour for lead <strong>${lead.buyerName || lead.leadId || lead.id}</strong> has been verified by both parties.
        </p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">Amount Due</p>
          <p style="margin: 0; font-size: 28px; font-weight: 800; color: #1e293b;">$${lead.feeAmount || 150}</p>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">${lead.tier === 'closing_ready' ? 'Closing-Ready Lead' : 'Qualified Tour Lead'}</p>
        </div>

        ${invoiceUrl ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${invoiceUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              Pay Invoice
            </a>
          </div>
        ` : `
          <p style="margin: 0 0 16px; color: #374151; text-align: center; font-size: 14px;">
            You will receive a separate Stripe invoice link shortly.
          </p>
        `}

        <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Thank you for partnering with <a href="${APP_URL}" style="color: #3b82f6; text-decoration: none;">HomeMatch</a>.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `HomeMatch Invoice: $${lead.feeAmount || 150} — Tour Verified for ${lead.buyerName || 'Lead'}`,
    html,
  });
}

module.exports = {
  sendEmail,
  sendLeadNotification,
  sendBuyerConfirmation,
  sendVerificationEmail,
  sendInvoiceEmail,
};
