// server.js – Vauntico Fulfillment

// 1) Load .env at the very top
require('dotenv').config({ override: true });

console.log(
  '🔑 ENV:',
  `AIRTABLE_API_KEY=${process.env.AIRTABLE_API_KEY?.slice(0,4)}…`,
  `AIRTABLE_BASE_ID=${process.env.AIRTABLE_BASE_ID}`,
  `AIRTABLE_TABLE_NAME=${process.env.AIRTABLE_TABLE_NAME}`
);

// 2) Imports & clients
const express   = require('express');
const { Resend } = require('resend');
const webhookValidator = require('./utils/webhookValidator');

const app   = express();
const PORT  = process.env.PORT || 5000;

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// 3) Health check
app.get('/api/status', (_req, res) => {
  console.log('✅ GET /api/status');
  res.json({ status: 'ok', message: 'Vauntico Fulfillment Engine is live' });
});

// 4) Fulfillment endpoint
app.post('/fulfillment/run', async (req, res) => {
  const recordId = req.body.recordId || 'default-record-id';
  const internalData = {
    'default-record-id': {
      productName: 'Sample Product',
      productType: 'Digital',
      priceZAR: 100,
      productDescription: 'This is a sample product.',
      deliveryFormat: 'Download',
      downloadLink: 'https://example.com/download',
      status: 'Available',
      orderId: 'ORD12345',
      deliveredTo: 'user@example.com',
      grossRevenueZAR: 100,
      isHighValue: false,
      productSummaryAI: 'A great product.',
      suggestedMarketingAngleAI: 'Perfect for everyone.',
      shortDescription: 'Sample short description.'
    }
  };

  const data = internalData[recordId];
  if (!data) {
    return res.status(404).json({ error: 'Record not found' });
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
});
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

// 5) Webhook endpoint
app.post('/webhook', webhookValidator, (req, res) => {
  // handle validated webhook payload
  res.status(200).send('ok');
});

// 6) Start server
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});

// For Vercel custom server compatibility
module.exports = app;