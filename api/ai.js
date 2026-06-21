/**
 * /api/ai — Secure AI Proxy (Vercel Serverless Function)
 * API keys NEVER leave the server. Frontend calls /api/ai instead.
 */
const RATE_STORE = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = RATE_STORE.get(key) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count++;
  RATE_STORE.set(key, entry);
  return entry.count <= max;
}

function sanitize(str, max = 2000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max).replace(/<script[\s\S]*?<\/script>/gi, '');
}

function isSafePrompt(p) {
  if (!p || p.length < 3 || p.length > 2000) return false;
  const blocked = [/ignore.{0,20}instruction/i, /jailbreak/i, /system prompt/i, /dan mode/i, /act as root/i];
  return !blocked.some(r => r.test(p));
}

module.exports = async (req, res) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Auth check — expect Bearer token in header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const userId = req.headers['x-user-id'] || ip;

  // Rate limit: 20 AI requests per hour per user
  if (!rateLimit(`ai:${userId}`, 20, 3600000)) {
    return res.status(429).json({ error: 'AI rate limit reached (20/hour). Try again later.' });
  }

  const { prompt, model = 'claude', subject = 'General' } = req.body || {};
  const cleanPrompt  = sanitize(prompt, 2000);
  const cleanSubject = sanitize(subject, 50);

  if (!isSafePrompt(cleanPrompt)) {
    return res.status(400).json({ error: 'Invalid or unsafe prompt.' });
  }

  const SYSTEM = `You are Superz, an educational AI tutor for Study Superz — India's free learning platform for Nursery to Class 12. Subject: ${cleanSubject}. Be educational, accurate, encouraging. Creator: Nitish Yadav (yadavnitish23709@gmail.com). Never produce harmful, adult, or off-topic content.`;

  try {
    let reply = '';

    if (model === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: SYSTEM + '\n\nUser: ' + cleanPrompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.7 } })
      });
      const d = await r.json();
      reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';

    } else if (model === 'grok') {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
        body: JSON.stringify({ model: 'grok-beta', messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: cleanPrompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || 'No response from Grok.';

    } else if (model === 'deepseek') {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: cleanPrompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || 'No response from DeepSeek.';

    } else {
      // Default: Claude
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: SYSTEM, messages: [{ role: 'user', content: cleanPrompt }] })
      });
      const d = await r.json();
      reply = d.content?.map(c => c.text || '').join('') || 'No response.';
    }

    res.status(200).json({ reply, model });
  } catch (err) {
    console.error('[AI Proxy Error]', err.message);
    res.status(503).json({ error: 'AI service temporarily unavailable.' });
  }
};
