// server.js – Vauntico Fulfillment using your “Digital Products” schema

// 1) Load .env at the very top
require('dotenv').config({ override: true });

// Validate AIRTABLE_TABLE_NAME
if (!process.env.AIRTABLE_TABLE_NAME) {
  throw new Error('Missing AIRTABLE_TABLE_NAME in .env');
}
if (process.env.AIRTABLE_TABLE_NAME !== 'Digital Products') {
  throw new Error(`AIRTABLE_TABLE_NAME must be exactly 'Digital Products', got '${process.env.AIRTABLE_TABLE_NAME}'`);
}

console.log(
  '🔑 ENV:',
  `AIRTABLE_API_KEY=${process.env.AIRTABLE_API_KEY?.slice(0,4)}…`,
  `AIRTABLE_BASE_ID=${process.env.AIRTABLE_BASE_ID}`,
  `AIRTABLE_TABLE_NAME=${process.env.AIRTABLE_TABLE_NAME}`
);

// 2) Imports & clients
const express   = require('express');
const Airtable  = require('airtable');
const { Resend } = require('resend');

const app   = express();
const PORT  = process.env.PORT || 5000;

const base   = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
                  .base(process.env.AIRTABLE_BASE_ID);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// 3) Health check
app.get('/api/status', (_req, res) => {
  console.log('✅ GET /api/status');
  res.json({ status: 'ok', message: 'Vauntico Fulfillment Engine is live' });
});

// 4) Fulfillment endpoint
app.post('/api/fulfillment/run', async (req, res) => {
  // For test run, use hard-coded recordId; in production, use req.body.recordId
  let recordId = req.body.recordId;
  const extraData = req.body.extraData;
  // TEST ONLY: hard-coded recordId for dry-run
  if (!recordId && process.env.NODE_ENV !== 'production') {
    recordId = 'recgAH641xCwxCmlS';
    console.log('⚠️ Using test recordId for dry-run:', recordId);
  }
  console.log('📥 Incoming payload:', req.body);

  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }

  // Use encodeURIComponent for table name
  const tableName = encodeURIComponent(process.env.AIRTABLE_TABLE_NAME);
  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}/${recordId}`;

  try {
    // Use direct fetch with PAT
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Airtable fetch error:', resp.status, text);
      return res.status(resp.status).json({
        error: `Airtable fetch failed: ${resp.status} ${text}`,
        stack: (new Error()).stack
      });
    }
    const data = await resp.json();
    const fields = data.fields || {};

    // Map all fields from “Digital Products”
    const productName               = fields['Product Name'];
    const productType               = fields['Product Type'];
    const priceZAR                  = fields['Price (ZAR)'];
    const productDescription        = fields['Product Description'];
    const tags                      = fields['Tags'];
    const deliveryFormat            = fields['Delivery Format'];
    const downloadLink              = fields['Download Link'];
    const downloadFile              = fields['Download File'];
    const status                    = fields['Status'];
    const orderId                   = fields['Order ID'];
    const deliveredTo               = fields['Delivered To'];
    const grossRevenueZAR           = fields['Gross Revenue (ZAR)'];
    const isHighValue               = fields['Is High Value Product?'];
    const productSummaryAI          = fields['Product Summary (AI)'];
    const suggestedMarketingAngleAI = fields['Suggested Marketing Angle (AI)'];
    const shortDescription          = fields['Short Description'];

    console.log(`🎯 Fetched ${recordId}:`, {
      productName, productType, priceZAR, deliveryFormat, downloadLink, status, orderId
    });

    // Build email HTML
    const htmlContent = `
      <h1>${productName}</h1>
      <p><em>${shortDescription}</em></p>
      <p><strong>Type:</strong> ${productType}</p>
      <p><strong>Price:</strong> ZAR ${priceZAR}</p>
      <p><strong>Description:</strong> ${productDescription}</p>
      <p><strong>Tags:</strong> ${Array.isArray(tags) ? tags.join(', ') : tags}</p>
      <p><strong>Delivery Format:</strong> ${deliveryFormat}</p>
      <p><a href="${downloadLink}">Download your product</a></p>
      ${
        Array.isArray(downloadFile) && downloadFile.length
          ? `<p>Attachment: <a href="${downloadFile[0].url}">${downloadFile[0].filename}</a></p>`
          : ''
      }
      <hr/>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Delivered To:</strong> ${deliveredTo}</p>
      <p><strong>Gross Revenue:</strong> ZAR ${grossRevenueZAR}</p>
      <p><strong>High Value Product:</strong> ${isHighValue}</p>
      <h2>AI-Generated Summary</h2>
      <p>${productSummaryAI}</p>
      <h2>Suggested Marketing Angle</h2>
      <p>${suggestedMarketingAngleAI}</p>
      ${extraData ? `<hr/><p>${extraData}</p>` : ''}
    `;

    // ✉️ Send email via Resend
    const email = await resend.emails.send({
      from:    process.env.SENDER_EMAIL,
      to:      deliveredTo,
      subject: `Your ${productName} is ready!`,
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

// 5) Start server
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});

// For Vercel custom server compatibility
module.exports = app;