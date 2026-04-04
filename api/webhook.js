const Stripe = require('stripe');

// Vercel needs raw body for webhook verification
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const booking = JSON.parse(session.metadata.bookingData);
      booking.bookingRef = session.metadata.bookingRef;
      booking.depositAmount = Math.round(session.amount_total / 100);
      booking.balanceDue = booking.subtotal - booking.depositAmount;
      booking.bookedAt = new Date().toISOString();

      // Generate PDFs
      const { generateFunctionSheet, generateKitchenPrepSheet } = require('../lib/pdf');
      const ingredients = require('../lib/ingredients');

      const [functionSheetPdf, kitchenPrepPdf] = await Promise.all([
        generateFunctionSheet(booking),
        generateKitchenPrepSheet(booking, ingredients),
      ]);

      // Send emails
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const { sendBookingEmail } = require('../lib/email');
        await sendBookingEmail(booking, functionSheetPdf, kitchenPrepPdf);
        console.log(`Booking ${booking.bookingRef}: emails sent to ${booking.customerEmail} and info@bashevents.co.uk`);
      } else {
        console.log(`Booking ${booking.bookingRef}: email not configured, skipping`);
      }
    } catch (err) {
      console.error('Error processing booking:', err);
      // Don't return error to Stripe — they'll retry
    }
  }

  res.status(200).json({ received: true });
};
