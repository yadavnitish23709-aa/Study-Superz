/**
 * STUDY SUPERZ — Secure Backend Server
 * All API keys, secrets, and sensitive logic live HERE — never in frontend
 * Author: Nitish Yadav
 */

'use strict';
require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const rateLimit      = require('express-rate-limit');
const slowDown       = require('express-slow-down');
const morgan         = require('morgan');
const cookieParser   = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const winston        = require('winston');
const path           = require('path');
const crypto         = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT VALIDATION — crash early if secrets missing
// ─────────────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET', 'SESSION_SECRET', 'ANTHROPIC_API_KEY'
];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const isProd = process.env.NODE_ENV === 'production';
const PORT   = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────────────────────────
// LOGGER — structured JSON logs, never log sensitive data
// ─────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'study-superz' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/security.log', level: 'warn' })
  ]
});

// ─────────────────────────────────────────────────────────────────
// SUPABASE — service role (server only, never sent to client)
// ─────────────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// IN-MEMORY RATE LIMIT STORES (use Redis in production)
// ─────────────────────────────────────────────────────────────────
const loginAttempts  = new Map(); // ip -> { count, lockedUntil }
const signupTracker  = new Map(); // ip -> { count, window }
const aiUsageTracker = new Map(); // userId -> { count, window }

// ─────────────────────────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────────────────────────
const app = express();

// ── Trust proxy (required for rate limiting behind Vercel/nginx) ──
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────
// SECURITY HEADERS — Helmet
// ─────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https:", "blob:"],
      connectSrc:  ["'self'", "https://*.supabase.co", "https://api.anthropic.com",
                    "https://generativelanguage.googleapis.com", "https://api.x.ai",
                    "https://api.deepseek.com", "https://open.spotify.com"],
      frameSrc:    ["'self'", "https://open.spotify.com"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null,
    }
  },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  frameguard:            { action: 'deny' },
  xssFilter:             true,
  noSniff:               true,
  referrerPolicy:        { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  permittedCrossDomainPolicies: false,
}));

// Remove fingerprinting headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Request-ID', uuidv4());
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ─────────────────────────────────────────────────────────────────
// CORS — strict origin whitelist
// ─────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn('CORS blocked', { origin, ip: '' });
    callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 600
}));

// ─────────────────────────────────────────────────────────────────
// BODY PARSING — strict size limits to prevent DoS
// ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET));

// ─────────────────────────────────────────────────────────────────
// REQUEST LOGGING — never log passwords or tokens
// ─────────────────────────────────────────────────────────────────
morgan.token('req-id', req => req.headers['x-request-id'] || '-');
app.use(morgan(':req-id :method :url :status :response-time ms - :res[content-length]', {
  stream: { write: msg => logger.http(msg.trim()) },
  skip: (req) => req.url === '/api/health'
}));

// ─────────────────────────────────────────────────────────────────
// GLOBAL RATE LIMITER — all routes
// ─────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.ip,
  handler: (req, res) => {
    logger.warn('Global rate limit hit', { ip: req.ip, url: req.url });
    res.status(429).json({ error: 'Too many requests. Please wait 15 minutes.' });
  }
});
app.use('/api/', globalLimiter);

// ─────────────────────────────────────────────────────────────────
// HELPER: Input sanitization
// ─────────────────────────────────────────────────────────────────
function sanitizeString(str, maxLen = 255) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLen)
    .replace(/[<>"'`]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','`':'&#x60;'}[c]));
}

function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase()) && email.length <= 254;
}

function isStrongPassword(pass) {
  return typeof pass === 'string' && pass.length >= 8 && pass.length <= 128;
}

function isValidClassName(cls) {
  const valid = ['Nursery','KG','Class 1','Class 2','Class 3','Class 4','Class 5',
    'Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'];
  return valid.includes(cls);
}

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE: Verify JWT from Authorization header
// ─────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'study-superz',
      audience: 'study-superz-users'
    });
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('Invalid token', { ip: req.ip, error: err.message });
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.email !== process.env.ADMIN_EMAIL || !req.user?.isAdmin) {
      logger.warn('Unauthorized admin access attempt', { ip: req.ip, userId: req.user?.sub });
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  });
}

// ─────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────

// Strict login rate limiting: 5 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: req => `login:${req.ip}:${(req.body?.email||'').toLowerCase()}`,
  handler: (req, res) => {
    logger.warn('LOGIN RATE LIMIT', { ip: req.ip, email: req.body?.email });
    res.status(429).json({
      error: 'Too many login attempts. Account temporarily locked for 15 minutes.',
      retryAfter: 900
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Signup rate limiting: 3 signups per hour per IP
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: req => `signup:${req.ip}`,
  handler: (req, res) => {
    logger.warn('SIGNUP RATE LIMIT', { ip: req.ip });
    res.status(429).json({ error: 'Too many accounts created from this IP. Try again in 1 hour.' });
  }
});

// Password reset rate limiting
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: req => `reset:${req.ip}:${(req.body?.email||'').toLowerCase()}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many reset attempts. Try again in 1 hour.' })
});

// POST /api/auth/signup
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  const requestId = res.getHeader('X-Request-ID');
  try {
    // Validate & sanitize input
    const name  = sanitizeString(req.body?.name, 100);
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const pass  = req.body?.password;  // Don't sanitize password — just validate length
    const cls   = sanitizeString(req.body?.class, 20);
    const agreed = req.body?.agreedToTerms === true;

    if (!name || name.length < 2)   return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    if (!isValidEmail(email))       return res.status(400).json({ error: 'Invalid email address.' });
    if (!isStrongPassword(pass))    return res.status(400).json({ error: 'Password must be 8–128 characters.' });
    if (!isValidClassName(cls))     return res.status(400).json({ error: 'Invalid class selection.' });
    if (!agreed)                    return res.status(400).json({ error: 'You must accept the Terms & Conditions to register.' });

    // Block disposable email domains (basic list)
    const disposable = ['mailinator.com','tempmail.com','guerrillamail.com','throwaway.email','yopmail.com'];
    const domain = email.split('@')[1];
    if (disposable.includes(domain)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });

    // Create user via Supabase Admin (server-side only)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: false,  // requires email verification
      user_metadata: { full_name: name, class: cls, agreed_to_terms: true, agreed_at: new Date().toISOString() }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    }

    // Save profile
    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name: name,
      email,
      class: cls,
      agreed_to_terms: true,
      agreed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_admin: false
    });

    // Log signup (never log password)
    logger.info('New user signup', { requestId, userId: data.user.id, email: email.replace(/(.{2}).*(@)/, '$1***$2'), class: cls });

    res.status(201).json({ message: 'Account created! Please check your email to verify your account.' });

  } catch (err) {
    logger.error('Signup error', { requestId, error: err.message });
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const requestId = res.getHeader('X-Request-ID');
  const ip = req.ip;

  try {
    const email = sanitizeString(req.body?.email, 254).toLowerCase();
    const pass  = req.body?.password;

    if (!isValidEmail(email) || !pass) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check if IP is locked
    const lockData = loginAttempts.get(ip);
    if (lockData?.lockedUntil && Date.now() < lockData.lockedUntil) {
      const remainingSecs = Math.ceil((lockData.lockedUntil - Date.now()) / 1000);
      logger.warn('Locked IP login attempt', { ip, email: email.replace(/(.{2}).*(@)/, '$1***$2') });
      return res.status(429).json({ error: `Account locked. Try again in ${remainingSecs} seconds.` });
    }

    // Attempt login via Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password: pass });

    if (error) {
      // Track failed attempts
      const prev = loginAttempts.get(ip) || { count: 0 };
      const count = prev.count + 1;
      if (count >= 5) {
        loginAttempts.set(ip, { count, lockedUntil: Date.now() + 15 * 60 * 1000 });
        logger.warn('IP locked after failed logins', { ip, count });
      } else {
        loginAttempts.set(ip, { count });
      }
      // Generic error (don't reveal if email exists)
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check email verification
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in. Check your inbox.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Clear failed attempts on success
    loginAttempts.delete(ip);

    // Issue short-lived JWT (15 min) + refresh token
    const isAdmin = data.user.email === process.env.ADMIN_EMAIL;
    const accessToken = jwt.sign(
      { sub: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name, isAdmin },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '15m', issuer: 'study-superz', audience: 'study-superz-users' }
    );
    const refreshToken = jwt.sign(
      { sub: data.user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { algorithm: 'HS256', expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', issuer: 'study-superz' }
    );

    // Set refresh token in httpOnly secure cookie
    res.cookie('ss_refresh', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      path: '/api/auth/refresh'
    });

    // Log successful login (mask email)
    logger.info('Successful login', { requestId, userId: data.user.id, email: email.replace(/(.{2}).*(@)/, '$1***$2'), ip });

    // Update last login
    await supabaseAdmin.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);

    res.json({
      accessToken,
      expiresIn: 900,
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name, class: data.user.user_metadata?.class, isAdmin }
    });

  } catch (err) {
    logger.error('Login error', { requestId, error: err.message });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', (req, res) => {
  const token = req.cookies?.ss_refresh;
  if (!token) return res.status(401).json({ error: 'No refresh token.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { issuer: 'study-superz' });
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');
    const newAccess = jwt.sign(
      { sub: decoded.sub },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: 'study-superz', audience: 'study-superz-users' }
    );
    res.json({ accessToken: newAccess, expiresIn: 900 });
  } catch {
    res.clearCookie('ss_refresh', { path: '/api/auth/refresh' });
    res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await supabaseAdmin.auth.admin.signOut(req.user.sub).catch(() => {});
  res.clearCookie('ss_refresh', { path: '/api/auth/refresh' });
  logger.info('Logout', { userId: req.user.sub });
  res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', resetLimiter, async (req, res) => {
  const email = sanitizeString(req.body?.email, 254).toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email.' });
  // Always return same response (don't reveal if email exists)
  await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/legal/reset-password.html`
  }).catch(() => {});
  logger.info('Password reset requested', { email: email.replace(/(.{2}).*(@)/, '$1***$2'), ip: req.ip });
  res.json({ message: 'If this email exists, a reset link has been sent. Links expire in 1 hour.' });
});

// ─────────────────────────────────────────────────────────────────
// AI PROXY — API keys NEVER leave server
// ─────────────────────────────────────────────────────────────────

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: parseInt(process.env.AI_REQUESTS_PER_HOUR || '20', 10),
  keyGenerator: req => `ai:${req.user?.sub || req.ip}`,
  handler: (req, res) => {
    logger.warn('AI rate limit hit', { userId: req.user?.sub, ip: req.ip });
    res.status(429).json({ error: 'AI usage limit reached (20 requests/hour). Try again later.' });
  }
});

const aiSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 5,
  delayMs: () => 500,
});

function validateAIPrompt(prompt) {
  if (typeof prompt !== 'string') return false;
  if (prompt.trim().length < 3)   return false;
  if (prompt.length > 2000)       return false;
  // Block prompt injection attempts
  const injectionPatterns = [
    /ignore (all |previous )?instructions/i,
    /system prompt/i,
    /you are now/i,
    /act as (a |an )?(?!student|teacher|tutor)/i,
    /jailbreak/i,
    /dan mode/i,
  ];
  return !injectionPatterns.some(p => p.test(prompt));
}

// POST /api/ai/chat — authenticated AI proxy
app.post('/api/ai/chat', requireAuth, aiLimiter, aiSlowDown, async (req, res) => {
  const requestId = res.getHeader('X-Request-ID');
  const { prompt, model = 'claude', subject = 'General' } = req.body || {};

  if (!validateAIPrompt(prompt)) {
    return res.status(400).json({ error: 'Invalid or unsafe prompt.' });
  }

  const cleanPrompt  = sanitizeString(prompt, 2000);
  const cleanSubject = sanitizeString(subject, 50);

  try {
    let reply = '';
    const systemPrompt = `You are Superz, an educational AI tutor for Study Superz — India's free learning platform. You help students (Nursery to Class 12) with ${cleanSubject}. Be educational, accurate, and encouraging. Never generate harmful, adult, or off-topic content. Creator: Nitish Yadav.`;

    if (model === 'gemini') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\nUser: ' + cleanPrompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.7 } }) }
      );
      const d = await r.json();
      reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';

    } else if (model === 'grok') {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROK_API_KEY}` },
        body: JSON.stringify({ model: 'grok-4.3', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: cleanPrompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || 'No response.';

    } else if (model === 'deepseek') {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: cleanPrompt }], max_tokens: 800 })
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || 'No response.';

    } else {
      // Default: Claude
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: cleanPrompt }] })
      });
      const d = await r.json();
      reply = d.content?.map(c => c.text || '').join('') || 'No response.';
    }

    // Log AI usage (not content for privacy)
    await supabaseAdmin.from('ai_usage_log').insert({
      user_id: req.user.sub,
      model,
      subject: cleanSubject,
      prompt_length: cleanPrompt.length,
      created_at: new Date().toISOString()
    }).catch(() => {});

    logger.info('AI request served', { requestId, userId: req.user.sub, model, subject: cleanSubject });
    res.json({ reply });

  } catch (err) {
    logger.error('AI proxy error', { requestId, error: err.message, model });
    res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// USER DATA ROUTES — IDOR-safe (every query scoped to req.user.sub)
// ─────────────────────────────────────────────────────────────────

// GET /api/user/profile — own profile only
app.get('/api/user/profile', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, class, xp, level, streak, created_at, last_login')
    .eq('id', req.user.sub)  // ← IDOR fix: always scope to logged-in user
    .single();
  if (error) return res.status(404).json({ error: 'Profile not found.' });
  res.json(data);
});

// PUT /api/user/profile — update own profile only
app.put('/api/user/profile', requireAuth, async (req, res) => {
  const { name, cls } = req.body || {};
  const updates = {};
  if (name) updates.full_name = sanitizeString(name, 100);
  if (cls && isValidClassName(cls)) updates.class = cls;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.user.sub);  // ← IDOR fix
  if (error) return res.status(500).json({ error: 'Update failed.' });
  res.json({ message: 'Profile updated.' });
});

// GET /api/user/notes — own notes only
app.get('/api/user/notes', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('user_notes')
    .select('id, title, subject_slug, tags, is_pinned, created_at, updated_at')
    .eq('user_id', req.user.sub)  // ← IDOR fix
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: 'Could not fetch notes.' });
  res.json(data);
});

// POST /api/user/notes — create note
app.post('/api/user/notes', requireAuth, async (req, res) => {
  const { title, content, subject } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });

  const { data, error } = await supabaseAdmin
    .from('user_notes')
    .insert({
      user_id:       req.user.sub,
      title:         sanitizeString(title, 200),
      content:       sanitizeString(content, 50000),
      subject_slug:  sanitizeString(subject || 'general', 50),
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString()
    })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: 'Could not save note.' });
  res.status(201).json({ id: data.id, message: 'Note saved.' });
});

// DELETE /api/user/notes/:id — ownership verified before delete
app.delete('/api/user/notes/:id', requireAuth, async (req, res) => {
  const noteId = sanitizeString(req.params.id, 36);
  // Verify ownership BEFORE deleting (IDOR fix)
  const { data: existing } = await supabaseAdmin
    .from('user_notes')
    .select('user_id')
    .eq('id', noteId)
    .single();
  if (!existing) return res.status(404).json({ error: 'Note not found.' });
  if (existing.user_id !== req.user.sub) {
    logger.warn('IDOR attempt — note delete', { attacker: req.user.sub, ownerId: existing.user_id, noteId });
    return res.status(403).json({ error: 'Forbidden.' });
  }
  await supabaseAdmin.from('user_notes').delete().eq('id', noteId);
  res.json({ message: 'Note deleted.' });
});

// GET /api/user/progress — own progress only
app.get('/api/user/progress', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('student_progress')
    .select('subject_slug, progress_pct, is_completed, last_accessed')
    .eq('user_id', req.user.sub)  // ← IDOR fix
    .order('last_accessed', { ascending: false });
  if (error) return res.status(500).json({ error: 'Could not fetch progress.' });
  res.json(data);
});

// ─────────────────────────────────────────────────────────────────
// ADMIN ROUTES — require admin role
// ─────────────────────────────────────────────────────────────────

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, keyGenerator: req => req.ip });

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, adminLimiter, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, class, xp, level, streak, created_at, last_login, is_admin', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: 'Could not fetch users.' });
  logger.info('Admin user list accessed', { adminId: req.user.sub, page });
  res.json({ users: data, total: count, page, limit });
});

// GET /api/admin/export/users — CSV export
app.get('/api/admin/export/users', requireAdmin, adminLimiter, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, class, xp, level, streak, created_at, last_login')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Export failed.' });

  const header = ['ID', 'Name', 'Email', 'Class', 'XP', 'Level', 'Streak', 'Created', 'Last Login'];
  const rows = data.map(u => [u.id, `"${(u.full_name||'').replace(/"/g,'""')}"`, u.email, u.class||'', u.xp||0, u.level||1, u.streak||0, u.created_at, u.last_login||''].join(','));
  const csv = [header.join(','), ...rows].join('\n');

  logger.info('Admin CSV export', { adminId: req.user.sub, count: data.length });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="studysuperz_users_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// DELETE /api/admin/users/:id — admin only, protected
app.delete('/api/admin/users/:id', requireAdmin, adminLimiter, async (req, res) => {
  const userId = sanitizeString(req.params.id, 36);
  // Prevent admin from deleting themselves
  if (userId === req.user.sub) return res.status(400).json({ error: 'Cannot delete your own admin account.' });
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
  await supabaseAdmin.from('profiles').delete().eq('id', userId);
  logger.warn('User deleted by admin', { adminId: req.user.sub, deletedUserId: userId });
  res.json({ message: 'User deleted.' });
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [{ count: totalUsers }, { count: todayUsers }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
  ]);
  res.json({ totalUsers, todayNewUsers: todayUsers, timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────
// HEALTH CHECK (public, no auth)
// ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────
// SERVE STATIC FILES (with security headers)
// ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.endsWith('.js'))   res.setHeader('X-Content-Type-Options', 'nosniff');
  },
  index: 'index.html',
  dotfiles: 'deny'  // Block .env, .git, etc.
}));

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLERS
// ─────────────────────────────────────────────────────────────────

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Global error handler — never expose stack traces in production
app.use((err, req, res, next) => {
  const requestId = res.getHeader('X-Request-ID');
  logger.error('Unhandled error', { requestId, error: err.message, stack: err.stack, url: req.url, method: req.method, ip: req.ip });
  res.status(err.status || 500).json({
    error: isProd ? 'An unexpected error occurred.' : err.message,
    requestId
  });
});

// ─────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`Study Superz server started`, { port: PORT, env: process.env.NODE_ENV });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => { logger.info('Server closed'); process.exit(0); });
});

process.on('uncaughtException',  err => { logger.error('Uncaught exception', { error: err.message }); process.exit(1); });
process.on('unhandledRejection', err => { logger.error('Unhandled rejection', { error: String(err) }); });

module.exports = app;
