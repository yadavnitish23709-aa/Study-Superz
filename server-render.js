/**
 * Study Superz — Render-compatible Express Server
 * Serves static frontend + minimal secure API proxy
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

/* ── Security & perf middleware ── */
app.use(helmet({
  contentSecurityPolicy: false, // configured via static headers if needed
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

/* ── Global rate limit ── */
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true }));

/* ── AI rate limit (stricter) ── */
const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: { error: 'AI rate limit reached (20/hour).' } });

/* ── Health check (required by Render) ── */
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date().toISOString() }));

/* ── AI Proxy — keeps keys server-side ── */
app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  const { prompt, model = 'gemini' } = req.body || {};
  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: 'Invalid prompt.' });

  try {
    let reply = '';
    if (model === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800 } })
      });
      const d = await r.json();
      reply = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (model === 'grok') {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
        body: JSON.stringify({ model: 'grok-beta', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || '';
    } else if (model === 'deepseek') {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || '';
    }
    res.json({ reply, model });
  } catch (err) {
    console.error('[AI Proxy]', err.message);
    res.status(503).json({ error: 'AI service unavailable.' });
  }
});

/* ── Serve static frontend ── */
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

/* ── Fallback to index.html for SPA-style routing ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`✅ Study Superz running on port ${PORT}`));
