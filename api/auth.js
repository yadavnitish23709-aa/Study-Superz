/**
 * /api/auth — Secure Auth Proxy (Vercel Serverless Function)
 * Handles login, signup, logout via Supabase Admin (service key server-side only)
 */
const LOGIN_ATTEMPTS = new Map();

function getIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function sanitize(v, max = 255) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function isValidEmail(e) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e) && e.length <= 254;
}

function isValidPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}

function isValidClass(c) {
  return ['Nursery','KG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'].includes(c);
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const ip   = getIP(req);
  const path = req.url?.replace('/api/auth', '') || '';

  // Dynamic Supabase admin client
  const { createClient } = require('@supabase/supabase-js');
  const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── SIGNUP ──────────────────────────────────────────────────
  if (path === '/signup') {
    // Rate limit: 3 signups/hour per IP
    const key = `su:${ip}`;
    const now = Date.now();
    const prev = LOGIN_ATTEMPTS.get(key) || { count: 0, start: now };
    if (now - prev.start > 3600000) { prev.count = 0; prev.start = now; }
    prev.count++;
    LOGIN_ATTEMPTS.set(key, prev);
    if (prev.count > 3) return res.status(429).json({ error: 'Too many signups from this IP. Try again in 1 hour.' });

    const name    = sanitize(req.body?.name, 100);
    const email   = sanitize(req.body?.email, 254).toLowerCase();
    const pass    = req.body?.password;
    const cls     = sanitize(req.body?.class, 20);
    const agreed  = req.body?.agreedToTerms === true;

    if (name.length < 2)       return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    if (!isValidEmail(email))  return res.status(400).json({ error: 'Invalid email address.' });
    if (!isValidPassword(pass))return res.status(400).json({ error: 'Password must be 8–128 characters.' });
    if (!isValidClass(cls))    return res.status(400).json({ error: 'Invalid class.' });
    if (!agreed)               return res.status(400).json({ error: 'You must accept the Terms & Conditions.' });

    const DISPOSABLE = ['mailinator.com','tempmail.com','guerrillamail.com','yopmail.com','throwaway.email'];
    if (DISPOSABLE.includes(email.split('@')[1])) return res.status(400).json({ error: 'Disposable emails not allowed.' });

    const { data, error } = await SB.auth.admin.createUser({
      email, password: pass, email_confirm: false,
      user_metadata: { full_name: name, class: cls, agreed_to_terms: true, agreed_at: new Date().toISOString() }
    });

    if (error) {
      if (error.message.includes('already registered')) return res.status(409).json({ error: 'Email already registered.' });
      return res.status(500).json({ error: 'Signup failed. Please try again.' });
    }

    await SB.from('profiles').upsert({ id: data.user.id, full_name: name, email, class: cls, agreed_to_terms: true, created_at: new Date().toISOString(), is_admin: false });
    return res.status(201).json({ message: 'Account created! Check your email to verify.' });
  }

  // ── LOGIN ───────────────────────────────────────────────────
  if (path === '/login') {
    const email = sanitize(req.body?.email, 254).toLowerCase();
    const pass  = req.body?.password;

    if (!isValidEmail(email) || !pass) return res.status(400).json({ error: 'Email and password required.' });

    // Rate limit: 5 attempts per 15 min per IP+email combo
    const key = `li:${ip}:${email}`;
    const now = Date.now();
    const prev = LOGIN_ATTEMPTS.get(key) || { count: 0, start: now };
    if (now - prev.start > 900000) { prev.count = 0; prev.start = now; }

    if (prev.count >= 5) {
      const wait = Math.ceil((900000 - (now - prev.start)) / 1000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${wait} seconds.`, retryAfter: wait });
    }

    const { data, error } = await SB.auth.signInWithPassword({ email, password: pass });
    if (error) {
      prev.count++; LOGIN_ATTEMPTS.set(key, prev);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' });
    }

    LOGIN_ATTEMPTS.delete(key);
    await SB.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);

    return res.status(200).json({
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in },
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name, class: data.user.user_metadata?.class, isAdmin: data.user.email === process.env.ADMIN_EMAIL }
    });
  }

  // ── PASSWORD RESET ──────────────────────────────────────────
  if (path === '/forgot') {
    const email = sanitize(req.body?.email, 254).toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email.' });
    const key = `pr:${ip}:${email}`;
    const now = Date.now();
    const prev = LOGIN_ATTEMPTS.get(key) || { count: 0, start: now };
    if (now - prev.start > 3600000) { prev.count = 0; prev.start = now; }
    prev.count++; LOGIN_ATTEMPTS.set(key, prev);
    if (prev.count > 3) return res.status(429).json({ error: 'Too many reset attempts. Try in 1 hour.' });
    await SB.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.FRONTEND_URL}/legal/reset-password.html` }).catch(() => {});
    return res.status(200).json({ message: 'If this email exists, a reset link has been sent. Links expire in 1 hour.' });
  }

  return res.status(404).json({ error: 'Not found.' });
};
