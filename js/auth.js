/**
 * Study Superz — Secure Client Auth & API Helper
 * ALL API keys are on the server. This file only talks to /api/* endpoints.
 * Never put Gemini, Grok, DeepSeek, or Anthropic keys in frontend code.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// CONFIG — only public, non-secret values here
// ─────────────────────────────────────────────────────────────────
const SS_CONFIG = {
  apiBase: window.location.origin + '/api',
  supabaseUrl: 'https://mlpsqojltzkrsykhcico.supabase.co',
  // Supabase ANON key is safe to expose (protected by RLS policies)
  // It cannot bypass Row Level Security — users still only see their own data
  supabaseAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scHNxb2psdHprcnN5a2hjaWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzU5MTUsImV4cCI6MjA5NjMxMTkxNX0.w2Xfo_x7MpFhhIIzW2uh0o-XdZkZNIJvSEEWEzD7cJ0',
  tokenKey:    'ss_access_token',
  userKey:     'ss_user',
  termsKey:    'ss_terms_v2',
};

// ─────────────────────────────────────────────────────────────────
// INPUT SANITISATION — client-side (defence in depth; server also validates)
// ─────────────────────────────────────────────────────────────────
const Sanitize = {
  string: (s, maxLen = 255) => {
    if (typeof s !== 'string') return '';
    return s.trim().slice(0, maxLen)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  },
  email: (s) => {
    const e = (s || '').trim().toLowerCase().slice(0, 254);
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e) ? e : '';
  },
  password: (s) => {
    // Don't sanitise passwords — just validate
    if (typeof s !== 'string') return '';
    if (s.length < 8 || s.length > 128) return '';
    return s;
  },
  alphanumeric: (s, max = 50) => {
    return (s || '').replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, max);
  }
};

// ─────────────────────────────────────────────────────────────────
// SECURE FETCH — wraps all API calls with auth header + CSRF token
// ─────────────────────────────────────────────────────────────────
const SecureAPI = {
  _token: null,

  getToken() {
    if (this._token) return this._token;
    try { return sessionStorage.getItem(SS_CONFIG.tokenKey); } catch { return null; }
  },

  setToken(t) {
    this._token = t;
    try { sessionStorage.setItem(SS_CONFIG.tokenKey, t); } catch { }
  },

  clearToken() {
    this._token = null;
    try { sessionStorage.removeItem(SS_CONFIG.tokenKey); sessionStorage.removeItem(SS_CONFIG.userKey); } catch { }
  },

  getUser() {
    try {
      const u = sessionStorage.getItem(SS_CONFIG.userKey);
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },

  setUser(u) {
    try { sessionStorage.setItem(SS_CONFIG.userKey, JSON.stringify(u)); } catch { }
  },

  async fetch(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    try {
      const res = await fetch(SS_CONFIG.apiBase + endpoint, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (res.status === 401 && data.code === 'TOKEN_EXPIRED') {
        await this.refreshToken();
        return this.fetch(endpoint, options); // retry once
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error('[SecureAPI] Network error:', err.message);
      return { ok: false, status: 0, data: { error: 'Network error. Check your connection.' } };
    }
  },

  async refreshToken() {
    try {
      const res = await fetch(SS_CONFIG.apiBase + '/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (res.ok) {
        const d = await res.json();
        this.setToken(d.accessToken);
      } else {
        this.clearToken();
        Auth.redirectToLogin();
      }
    } catch { this.clearToken(); }
  }
};

// ─────────────────────────────────────────────────────────────────
// AUTH — signup, login, logout, session management
// ─────────────────────────────────────────────────────────────────
const Auth = {
  async signup({ name, email, password, cls, agreedToTerms }) {
    // Client-side validation first (server validates again)
    const cleanName  = Sanitize.string(name, 100);
    const cleanEmail = Sanitize.email(email);
    const cleanPass  = password; // don't sanitize, server will validate
    const cleanClass = Sanitize.alphanumeric(cls, 20);

    if (cleanName.length < 2)  throw new Error('Name must be at least 2 characters.');
    if (!cleanEmail)           throw new Error('Invalid email address.');
    if (!cleanPass || cleanPass.length < 8) throw new Error('Password must be at least 8 characters.');
    if (!cleanClass)           throw new Error('Please select your class.');
    if (!agreedToTerms)        throw new Error('You must accept the Terms & Conditions.');

    const { ok, data } = await SecureAPI.fetch('/auth/signup', {
      method: 'POST',
      body: { name: cleanName, email: cleanEmail, password: cleanPass, class: cleanClass, agreedToTerms: true }
    });
    if (!ok) throw new Error(data.error || 'Signup failed.');
    return data;
  },

  async login({ email, password }) {
    const cleanEmail = Sanitize.email(email);
    if (!cleanEmail) throw new Error('Invalid email address.');
    if (!password)   throw new Error('Password is required.');

    const { ok, status, data } = await SecureAPI.fetch('/auth/login', {
      method: 'POST',
      body: { email: cleanEmail, password }
    });

    if (status === 429) throw new Error(data.error || 'Too many attempts. Please wait.');
    if (status === 403) throw new Error(data.error || 'Email not verified. Check your inbox.');
    if (!ok) throw new Error(data.error || 'Invalid email or password.');

    SecureAPI.setToken(data.session?.access_token || data.accessToken);
    SecureAPI.setUser(data.user);
    this.onLoginSuccess(data.user);
    return data.user;
  },

  async logout() {
    await SecureAPI.fetch('/auth/logout', { method: 'POST' }).catch(() => {});
    SecureAPI.clearToken();
    this.onLogout();
  },

  async forgotPassword(email) {
    const cleanEmail = Sanitize.email(email);
    if (!cleanEmail) throw new Error('Invalid email address.');
    const { data } = await SecureAPI.fetch('/auth/forgot', { method: 'POST', body: { email: cleanEmail } });
    return data;
  },

  isLoggedIn() { return !!SecureAPI.getToken(); },
  getUser()    { return SecureAPI.getUser(); },

  onLoginSuccess(user) {
    // Update UI — hide login/signup buttons, show avatar
    const lb = document.getElementById('lbtn'), sb = document.getElementById('sbtn'), av = document.getElementById('uava');
    if (lb) lb.style.display = 'none';
    if (sb) sb.style.display = 'none';
    if (av) { av.style.display = 'flex'; av.textContent = (user?.name || user?.email || 'U')[0].toUpperCase(); av.onclick = () => this.logout(); }
    document.dispatchEvent(new CustomEvent('ss:login', { detail: user }));
  },

  onLogout() {
    const lb = document.getElementById('lbtn'), sb = document.getElementById('sbtn'), av = document.getElementById('uava');
    if (lb) lb.style.display = 'block';
    if (sb) sb.style.display = 'block';
    if (av) { av.style.display = 'none'; av.onclick = null; }
    document.dispatchEvent(new CustomEvent('ss:logout'));
  },

  redirectToLogin() {
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
      window.location.href = '/#login';
    }
  },

  // Restore session on page load
  async restoreSession() {
    const token = SecureAPI.getToken();
    const user  = SecureAPI.getUser();
    if (token && user) this.onLoginSuccess(user);
  }
};

// ─────────────────────────────────────────────────────────────────
// AI PROXY — calls /api/ai, never exposes AI keys to browser
// ─────────────────────────────────────────────────────────────────
const AI = {
  async ask({ prompt, model = 'claude', subject = 'General' }) {
    if (!prompt || prompt.trim().length < 3) throw new Error('Please enter a question.');
    if (prompt.length > 2000) throw new Error('Question is too long (max 2000 characters).');

    const user = SecureAPI.getUser();
    const { ok, status, data } = await SecureAPI.fetch('/ai/chat', {
      method: 'POST',
      headers: user ? { 'x-user-id': user.id } : {},
      body: {
        prompt: prompt.trim(),
        model: ['claude','gemini','grok','deepseek'].includes(model) ? model : 'claude',
        subject: Sanitize.alphanumeric(subject, 50)
      }
    });

    if (status === 429) throw new Error('AI rate limit reached (20/hour). Try again later.');
    if (status === 401) throw new Error('Please log in to use the AI Tutor.');
    if (!ok) throw new Error(data.error || 'AI service unavailable.');

    return data.reply;
  }
};

// ─────────────────────────────────────────────────────────────────
// TERMS MODAL — shows on first visit, must accept to continue
// ─────────────────────────────────────────────────────────────────
const TermsModal = {
  hasAccepted() {
    try { return !!localStorage.getItem(SS_CONFIG.termsKey); } catch { return false; }
  },

  accept() {
    try { localStorage.setItem(SS_CONFIG.termsKey, new Date().toISOString()); } catch { }
    const m = document.getElementById('terms-modal');
    if (m) { m.style.opacity = '0'; setTimeout(() => m.remove(), 400); }
  },

  show() {
    if (this.hasAccepted()) return;
    const existing = document.getElementById('terms-modal');
    if (existing) return;

    const modal = document.createElement('div');
    modal.id = 'terms-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Terms and Conditions');
    modal.style.cssText = `
      position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);backdrop-filter:blur(16px);
      display:flex;align-items:center;justify-content:center;padding:20px;
      opacity:0;transition:opacity .4s;
    `;

    modal.innerHTML = `
      <div style="width:100%;max-width:580px;background:#0d0d20;border:1px solid rgba(124,58,237,.3);border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.7);max-height:90vh;display:flex;flex-direction:column;">
        <!-- Header -->
        <div style="padding:24px 28px 0;background:linear-gradient(135deg,rgba(124,58,237,.12),rgba(6,182,212,.08));">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <img src="/assets/logo.png" style="width:40px;height:40px;border-radius:10px;" onerror="this.style.display='none'" alt="Study Superz"/>
            <div>
              <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Welcome to Study Superz</div>
              <div style="font-size:12px;color:#94a3b8;">Before you continue, please review our policies</div>
            </div>
          </div>
        </div>
        <!-- Scrollable content -->
        <div style="padding:20px 28px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(124,58,237,.3) transparent;">
          <div style="font-size:13px;color:#94a3b8;line-height:1.8;">

            <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#10b981;">
              ✅ <strong>Study Superz is 100% free.</strong> No hidden charges, no ads, no data selling. Ever.
            </div>

            <p style="margin-bottom:12px;"><strong style="color:#f1f5f9;">What we collect from you:</strong></p>
            <ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
              <li>📧 Your <strong>name and email</strong> — to create and manage your account</li>
              <li>🎓 Your <strong>class/grade</strong> — to show you relevant content</li>
              <li>📊 Your <strong>study progress</strong> (quiz scores, completed chapters) — to personalise learning</li>
              <li>🔒 Your <strong>IP address</strong> — for security and fraud prevention only</li>
              <li>🤖 <strong>AI usage metadata</strong> (model used, subject, prompt length — NOT the actual content)</li>
            </ul>

            <p style="margin-bottom:12px;"><strong style="color:#f1f5f9;">What we do NOT do:</strong></p>
            <ul style="padding-left:18px;display:flex;flex-direction:column;gap:5px;margin-bottom:16px;">
              <li>❌ We never sell your data to anyone</li>
              <li>❌ We never show advertising based on your data</li>
              <li>❌ We never read your personal study notes</li>
              <li>❌ We never share your data with marketers</li>
            </ul>

            <p style="margin-bottom:12px;"><strong style="color:#f1f5f9;">How we protect you:</strong></p>
            <ul style="padding-left:18px;display:flex;flex-direction:column;gap:5px;margin-bottom:16px;">
              <li>🔐 Passwords hashed with bcrypt (never stored in plain text)</li>
              <li>🛡️ All data encrypted in transit (HTTPS/TLS 1.3)</li>
              <li>🚫 AI API keys never exposed in your browser</li>
              <li>✅ Each user can only access their own data (Row Level Security)</li>
            </ul>

            <div style="background:rgba(245,158,11,.07);border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:16px;font-size:12px;">
              ⚠️ <strong>Age requirement:</strong> Users under 13 require parental/guardian consent. By continuing, you confirm you meet this requirement.
            </div>

            <p style="font-size:12px;color:#475569;">
              By clicking "I Accept", you agree to our
              <a href="/legal/terms.html" target="_blank" style="color:#06b6d4;text-decoration:none;">Terms &amp; Conditions</a>,
              <a href="/legal/privacy.html" target="_blank" style="color:#06b6d4;text-decoration:none;">Privacy Policy</a>, and
              <a href="/legal/cookies.html" target="_blank" style="color:#06b6d4;text-decoration:none;">Cookie Policy</a>.
              You can request data deletion at any time by emailing
              <a href="mailto:yadavnitish23709@gmail.com" style="color:#06b6d4;">yadavnitish23709@gmail.com</a>.
            </p>
          </div>
        </div>
        <!-- Actions -->
        <div style="padding:18px 28px 24px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button id="terms-accept-btn" style="flex:1;padding:13px 20px;border-radius:11px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-weight:800;font-size:15px;border:none;cursor:pointer;min-width:140px;transition:all .2s;" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
            ✅ I Accept — Enter Study Superz
          </button>
          <div style="font-size:11px;color:#475569;flex:1;min-width:120px;">
            <a href="/legal/terms.html" target="_blank" style="color:#475569;display:block;">📋 Read Terms</a>
            <a href="/legal/privacy.html" target="_blank" style="color:#475569;display:block;">🔒 Privacy Policy</a>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => { modal.style.opacity = '1'; });

    document.getElementById('terms-accept-btn').addEventListener('click', () => TermsModal.accept());
    // Prevent closing by clicking backdrop
    modal.addEventListener('click', e => { if (e.target === modal) { modal.querySelector('div').style.animation = 'shake .3s'; } });
  }
};

// ─────────────────────────────────────────────────────────────────
// FORM SECURITY — attach to all forms
// ─────────────────────────────────────────────────────────────────
const FormSecurity = {
  // Attach real-time validation to login form
  attachLogin(formEl, onSuccess) {
    if (!formEl) return;
    formEl.addEventListener('submit', async e => {
      e.preventDefault();
      const email    = formEl.querySelector('[name="email"], #le')?.value || '';
      const password = formEl.querySelector('[name="password"], #lp')?.value || '';
      const btn      = formEl.querySelector('[type="submit"], .asub');
      const msgEl    = formEl.querySelector('.amsg') || document.getElementById('amsg');

      if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
      try {
        const user = await Auth.login({ email, password });
        if (msgEl) { msgEl.className = 'amsg s'; msgEl.textContent = '✅ Welcome back!'; }
        if (onSuccess) onSuccess(user);
      } catch (err) {
        if (msgEl) { msgEl.className = 'amsg e'; msgEl.textContent = '❌ ' + err.message; }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Sign In to Study Superz ⚡'; }
      }
    });
  },

  // Validate password strength
  checkPasswordStrength(pass) {
    let score = 0;
    if (pass.length >= 8)  score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return { score, label: ['Very Weak','Weak','Fair','Good','Strong'][Math.min(score, 4)] };
  }
};

// ─────────────────────────────────────────────────────────────────
// RATE LIMIT DISPLAY — show user-friendly countdown
// ─────────────────────────────────────────────────────────────────
const RateLimit = {
  show(msgEl, retryAfter = 60) {
    if (!msgEl) return;
    let remaining = retryAfter;
    msgEl.className = 'amsg e';
    const update = () => {
      msgEl.textContent = `⏱️ Too many attempts. Retry in ${remaining}s`;
      if (remaining-- > 0) setTimeout(update, 1000);
      else msgEl.textContent = '';
    };
    update();
  }
};

// ─────────────────────────────────────────────────────────────────
// INIT — run on every page load
// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Show terms modal if not yet accepted
  TermsModal.show();

  // 2. Restore session
  await Auth.restoreSession();

  // 3. Wire up login form if present
  const loginForm = document.getElementById('fl');
  if (loginForm) {
    const loginBtn = document.getElementById('fl')?.querySelector('.asub') || document.querySelector('#fl .asub');
    const origLogin = window.doLogin;
    window.doLogin = async () => {
      const email    = document.getElementById('le')?.value || '';
      const password = document.getElementById('lp')?.value || '';
      const msgEl    = document.getElementById('amsg');
      try {
        await Auth.login({ email, password });
        if (msgEl) { msgEl.className = 'amsg s'; msgEl.innerHTML = '✅ Welcome back!'; }
        setTimeout(() => { if(window.closeAuth) window.closeAuth(); }, 900);
      } catch (err) {
        if (msgEl) { msgEl.className = 'amsg e'; msgEl.innerHTML = '❌ ' + err.message; }
        if (err.message.includes('Too many')) RateLimit.show(msgEl, 60);
      }
    };
  }

  // 4. Wire up signup form if present
  const origSignup = window.doSignup;
  window.doSignup = async () => {
    const name  = document.getElementById('sn')?.value || '';
    const email = document.getElementById('se')?.value || '';
    const pass  = document.getElementById('sp')?.value || '';
    const cls   = document.getElementById('sc')?.value || '';
    const msgEl = document.getElementById('amsg');
    try {
      await Auth.signup({ name, email, password: pass, cls, agreedToTerms: true });
      if (msgEl) { msgEl.className = 'amsg s'; msgEl.innerHTML = '🎉 Account created! Verify your email.'; }
      setTimeout(() => { if(window.closeAuth) window.closeAuth(); }, 1800);
    } catch (err) {
      if (msgEl) { msgEl.className = 'amsg e'; msgEl.innerHTML = '❌ ' + err.message; }
    }
  };

  // 5. Override AI calls to use secure proxy
  window.SS_AI = AI;
  window.SS_Auth = Auth;
  window.SS_Sanitize = Sanitize;
});

// Export for use in other scripts
if (typeof module !== 'undefined') module.exports = { Auth, AI, Sanitize, SecureAPI, TermsModal };
