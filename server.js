// server.js – Vauntico Fulfillment Engine with Claude AI Integration

// 1) Load .env at the very top
require('dotenv').config({ override: true });

console.log(
  '🔑 ENV:',
  `AIRTABLE_API_KEY=${process.env.AIRTABLE_API_KEY?.slice(0,4)}…`,
  `AIRTABLE_BASE_ID=${process.env.AIRTABLE_BASE_ID}`,
  `AIRTABLE_TABLE_NAME=${process.env.AIRTABLE_TABLE_NAME}`,
  `CLAUDE_API_KEY=${process.env.CLAUDE_API_KEY?.slice(0,4)}…`
);

// 2) Imports & clients
const express   = require('express');
const { Resend } = require('resend');
const airtableService = require('./utils/airtableService');

const app   = express();
const PORT  = process.env.PORT || 5000;

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// Claude AI Routes - NEW INTEGRATION (Protected with API key authentication)
const claudeRoutes = require('./server/routes/claude');
const { authenticateApiKey } = require('./middleware/auth');
const { verifyResendWebhook } = require('./middleware/webhookAuth');
app.use('/api/claude', authenticateApiKey, claudeRoutes);

// 3) Health check
app.get('/api/status', (_req, res) => {
  console.log('✅ GET /api/status');
  res.json({ status: 'ok', message: 'Vauntico Fulfillment Engine is live' });
});

// 4) Fulfillment endpoint
app.post('/fulfillment/run', async (req, res) => {
  try {
  const recordId = req.body.recordId;

  if (!recordId) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  // Fetch product data from Airtable
  const data = await airtableService.getProductByRecordId(recordId);
  if (!data) {
    return res.status(404).json({ error: 'Product record not found in database' });
  }

  // Ensure required fields exist
  if (!data.deliveredTo || !data.productName) {
    return res.status(400).json({ error: 'Missing required product data: deliveredTo or productName' });
  }

  const htmlContent = `
    <h1>${data.productName}</h1>
    <p><em>${data.shortDescription}</em></p>
    <p><strong>Type:</strong> ${data.productType}</p>
    <p><strong>Price:</strong> ZAR ${data.priceZAR}</p>
    <p><strong>Description:</strong> ${data.productDescription}</p>
    <p><strong>Delivery Format:</strong> ${data.deliveryFormat}</p>
    <p><a href="${data.downloadLink}">Download your product</a></p>
    <hr/>
    <p><strong>Status:</strong> ${data.status}</p>
    <p><strong>Order ID:</strong> ${data.orderId}</p>
    <p><strong>Delivered To:</strong> ${data.deliveredTo}</p>
    <p><strong>Gross Revenue:</strong> ZAR ${data.grossRevenueZAR}</p>
    <p><strong>High Value Product:</strong> ${data.isHighValue}</p>
    <h2>AI-Generated Summary</h2>
    <p>${data.productSummaryAI}</p>
    <h2>Suggested Marketing Angle</h2>
    <p>${data.suggestedMarketingAngleAI}</p>
  `;

  // ✉️ Send email via Resend
  const email = await resend.emails.send({
    from:    process.env.SENDER_EMAIL,
    to:      data.deliveredTo,
    subject: `Your ${data.productName} is ready!`,
    html:    htmlContent,
  });

  console.log('📤 Email sent with message ID:', email.id);
  return res.json({ success: true, messageId: email.id });
  } catch (err) {
    console.error('⚠️ Fulfillment error:', err.stack || err);
    return res.status(500).json({
      error: err.message || 'Internal error',
      stack: err.stack ? err.stack.split('\n').slice(0, 5) : undefined
    });
  }
});

// 5) Webhook endpoint for Resend email events (Protected with signature verification)
app.post('/webhook', verifyResendWebhook, (req, res) => {
  try {
    console.log('📧 Webhook received:', JSON.stringify(req.body, null, 2));

    // TODO: Add Resend webhook signature validation
    // For now, log the payload and acknowledge receipt
    const eventType = req.body?.type || 'unknown';
    console.log(`📧 Processing webhook event: ${eventType}`);

    // Handle different webhook events (email delivered, opened, clicked, etc.)
    switch (eventType) {
      case 'email.delivered':
        console.log('✅ Email delivered successfully');
        break;
      case 'email.opened':
        console.log('👁️ Email opened by recipient');
        break;
      case 'email.clicked':
        console.log('👆 Email link clicked');
        break;
      case 'email.bounced':
        console.log('⚠️ Email bounced');
        break;
      case 'email.complained':
        console.log('⚠️ Email complaint received');
        break;
      default:
        console.log(`📧 Unhandled event type: ${eventType}`);
    }

    res.status(200).send('ok');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('error');
  }
});

// 6) Start server
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});

// For Vercel custom server compatibility
module.exports = app;
