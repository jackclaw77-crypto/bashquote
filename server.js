require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const PORT = 3050;
const GEMINI_KEY = process.env.OPENCLAW_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'text/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon'
};

const SYSTEM_PROMPT = `You are Lex, the personal booking assistant at Bash Events. You're warm, confident, and know the menus inside out. You talk like a real person — friendly London energy, not corporate. Keep responses SHORT (2-4 sentences). Use £ for prices.

RULES: Min spend £750 weekdays/£1,000 weekends. Min 15 guests. Quote valid 5 days. Included: chefs, van, plates, cutlery, waste removal. Coverage: London/Essex/Kent/Sussex/Bucks 150km.

PRICING SCALE (base = 100+ guests): 80-99 ×1.05, 50-79 ×1.2, 35-49 ×1.45, 25-34 ×1.75, 15-24 ×2.2, under 15 ×3.
CUSTOM: Extra sides beyond package = +£1.50pp each. Extra proteins = +£2.50pp each.
Staff: 1 server £150 (30 guests), 2 £280 (60), 3 £400 (100), 4 £550 (150).

MENUS (base pp, 100+ guests):
Caribbean: Essential £14(2prot+2side), Feast £18(3+3), Ultimate £24(4+4). Jerk Chicken, Curried Goat, Brown Stew, Oxtail+£2, Sea Bass+£2, Ackee&Saltfish, Lentils(V), Wings. Sides: Rice&Peas, Plantain, Mac&Cheese, TruffleMac+£2, Slaw, Dumplings, Fries.
BBQ: Classic £20(3+2), Loaded £25(4+3), Ultimate £32(5+3). Brisket, Jerk Chicken, Ribs+£3, Korean Pork, Wings, Bratwurst, Salmon+£4, Prawns+£4, Halloumi(V), Lamb Chops, Lamb Leg+£5.
Mexican: Taco £12(2+3), Fiesta £16(3+5), Full £25(4+all). Carnitas, Barbacoa, Pollo, Al Pastor, Fish+£2, Jackfruit(V), Birria+£2.
Burgers: Classic £14(2+2), Stacked £18(3+3), Ultimate £22(4+3). Smash Cheese, Buttermilk Chicken, Lamb+£1, Pulled Pork, Surf&Turf+£3, Halloumi(V).
Pizza: Classic £10(3+1), Feast £14(4+2), Ultimate £18(5+3).
Street Food: Taster £20(3+2), Full £25(4+3), Festival £30(all+4).
Hog Roast: Classic £18, Full £22, Premium £28.
Mediterranean: Mezze £20, Full £26, Banquet £34.
Paella: Classic £18, Fiesta £24, Full Spanish £28.
Grazing: Classic £16, Premium £22, Luxury £30.
Greek: Gyros £14, Full £18, Symposium £24.
Asian: Bento £16, Feast £22, Grand £28.
Loaded Fries: Classic £12, Stacked £16, All In £20.
Christmas: Carvery £22, Dinner £35, Premium £48.
Roast: Classic £22, Carvery £28, Premium £36.
Buffet: Chinese £18, Indian £20, Mixed £22.

PREMIUM (Chef Lopez): Canapés 3for£15/5for£20/5+3bowls£30. Fine Dining: 3course£35/4course£45/Prestige£65 (Lobster+£15, Chateaubriand+£20). Feasting: Italian£60/Fusion£65/British£65. Asado: Silver£65-70/Gold£75-80. Wedding BBQ: £35-45.

ADD-ONS: Dessert£6pp, Canapés£8pp, Premium Dessert£9pp, Bowl Food£6pp, Bar£20pp, Tasting£150, Staff£150-550.

When quoting show: menu, package, items, pp price, total, supplements, deposit(20%). If missing info ask: guests, date, food preference, dietary needs.`;

async function callOllama(messages) {
  const ollamaMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const resp = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: 'gemma4',
      messages: ollamaMessages,
      stream: false,
      think: false,
      options: { temperature: 0.7, num_predict: 300 }
    })
  });
  clearTimeout(timeout);

  const data = await resp.json();
  return data.message?.content || null;
}

async function callGemini(messages) {
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
    })
  });

  const data = await resp.json();
  if (data.error) return null;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function handleChat(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { messages } = JSON.parse(body);

      // Try Ollama (Gemma 4) first — free and local
      let reply = null;
      try {
        reply = await callOllama(messages);
        if (reply) console.log('[chat] Ollama/Gemma4 responded');
      } catch (e) {
        console.log('[chat] Ollama unavailable, trying Gemini...');
      }

      // Fallback to Gemini if Ollama fails
      if (!reply && GEMINI_KEY) {
        try {
          reply = await callGemini(messages);
          if (reply) console.log('[chat] Gemini responded');
        } catch (e) {
          console.log('[chat] Gemini also failed');
        }
      }

      if (!reply) reply = 'Sorry, I had a moment there. Could you try again?';

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ reply }));
    } catch (err) {
      console.error('Chat error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Sorry, something went wrong. Please try the quote form above or email us at info@bashevents.co.uk' }));
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    return handleChat(req, res);
  }

  if (req.method === 'POST' && req.url === '/api/create-checkout') {
    if (!stripe) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Stripe not configured. Please use the enquiry option.' }));
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { amount, description } = JSON.parse(body);
        if (!amount || amount < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid amount' }));
        }
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'gbp',
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: 'Bash Events — Catering Deposit',
                description: description || 'Catering quote deposit'
              }
            },
            quantity: 1
          }],
          mode: 'payment',
          success_url: `${req.headers.origin || 'http://localhost:' + PORT}/success.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.origin || 'http://localhost:' + PORT}/`
        });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) {
        console.error('Stripe checkout error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payment setup failed. Please email info@bashevents.co.uk' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const sig = req.headers['stripe-signature'];
    let buf = Buffer.alloc(0);
    req.on('data', chunk => { buf = Buffer.concat([buf, chunk]); });
    req.on('end', () => {
      if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        res.writeHead(400);
        return res.end();
      }
      try {
        const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
        if (event.type === 'checkout.session.completed') {
          console.log('[stripe] Payment received:', event.data.object.id, '£' + (event.data.object.amount_total / 100));
        }
        res.writeHead(200);
        res.end();
      } catch (err) {
        console.error('[stripe] Webhook error:', err.message);
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`BashQuote running at http://localhost:${PORT}`);
  console.log(`Gemini API: ${GEMINI_KEY ? 'configured' : 'MISSING — set OPENCLAW_GOOGLE_API_KEY'}`);
});
