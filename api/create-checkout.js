const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured yet' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const booking = req.body;
    const depositAmount = Math.round(booking.subtotal * 0.2); // 20% deposit
    const bookingRef = `BASH-${booking.eventDate.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: booking.customerEmail,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Bash Events — ${booking.menuTitle} (${booking.packageName})`,
            description: `${booking.guestCount} guests · ${booking.eventDate} · Ref: ${bookingRef}`,
          },
          unit_amount: depositAmount * 100, // Stripe uses pence
        },
        quantity: 1,
      }],
      metadata: {
        bookingRef,
        bookingData: JSON.stringify(booking),
      },
      success_url: `${process.env.SITE_URL || 'http://localhost:3000'}/success.html?ref=${bookingRef}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL || 'http://localhost:3000'}/#quote-cancelled`,
    });

    res.status(200).json({
      sessionId: session.id,
      sessionUrl: session.url,
      bookingRef,
      depositAmount,
    });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
};
