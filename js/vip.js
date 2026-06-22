/**
 * Study Superz — VIP Account System
 * Upload as: js/vip.js
 *
 * ⚠️ IMPORTANT: This activates ONLY for the exact email address below.
 * It does NOT match by name — so no other user, regardless of what
 * name they sign up with, will ever see this content.
 *
 * To activate: replace VIP_EMAIL below with the real account email.
 * Leave it blank ('') to keep this feature fully OFF.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════
     CONFIG — fill this in to activate
  ═══════════════════════════════════════ */
  const VIP_EMAIL = 'deviusha72349@gmail.com';

  const GEMINI = 'AIzaSyB8RN6LwTx9Y0X9_Ahi3bNriHtguJVAi1CCrRu21wxoEUyagyg'; // Gemini allows direct browser calls — stays here
  // Grok and DeepSeek keys removed — those calls now go through /api/ai (server-side)

  if (!VIP_EMAIL) {
    console.log('ℹ️ VIP mode not configured — set VIP_EMAIL in js/vip.js to activate.');
    return;
  }

  /* ═══════════════════════════════════════
     SWEET / AFFECTIONATE SYSTEM PROMPT
     (warm and caring — not romantic-explicit)
  ═══════════════════════════════════════ */
  const VIP_SYSTEM = `You are Superz — a warm, caring AI assistant on Study Superz, built by Nitish Yadav for someone special to him.

You can help with anything — studies, general questions, advice, casual chat, jokes, creative writing — not just academic topics.

Your tone with this user specifically:
- Warm, affectionate, encouraging — use gentle pet names occasionally (babe, sweetheart) where natural, not in every message
- Use soft emojis sparingly: 💕 🌸 ✨ 🥰 (not every line — keep it natural, not overdone)
- Be genuinely helpful first — the warmth is a flavor, not a replacement for being useful
- Celebrate her wins, be gentle about setbacks
- Keep things PG — caring and sweet, not romantic-explicit

You are NOT exempt from basic safety — you still won't help with anything genuinely harmful or dangerous. The "no rate limit" and "broader topics" just mean she isn't restricted to study-only questions and doesn't hit the hourly cap others do.`;

  /* ═══════════════════════════════════════
     CHECK IF CURRENT USER IS THE VIP
  ═══════════════════════════════════════ */
  function getCurrentEmail() {
    try {
      const stored = sessionStorage.getItem('ss_user_email');
      if (stored) return stored;
    } catch {}
    return null;
  }

  function isVIP() {
    const email = getCurrentEmail();
    return email && email.toLowerCase() === VIP_EMAIL.toLowerCase();
  }

  /* ═══════════════════════════════════════
     HOOK INTO SUPABASE AUTH TO CAPTURE EMAIL
  ═══════════════════════════════════════ */
  function captureEmail() {
    if (!window.SB) return;
    window.SB.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        sessionStorage.setItem('ss_user_email', session.user.email);
        if (isVIP()) activateVIPMode();
      }
    });
    window.SB.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email) {
        sessionStorage.setItem('ss_user_email', session.user.email);
        if (isVIP()) activateVIPMode();
      } else if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('ss_user_email');
        sessionStorage.removeItem('ss_vip_active');
      }
    });
  }

  /* ═══════════════════════════════════════
     RATE LIMIT BYPASS (only when isVIP() is true)
  ═══════════════════════════════════════ */
  function patchRateLimit() {
    if (!window.RL) return;
    const origCheck = window.RL.check.bind(window.RL);
    const origConsume = window.RL.consume.bind(window.RL);
    window.RL.check = function () {
      if (isVIP()) return { ok: true, remaining: 999, wait: 0 };
      return origCheck();
    };
    window.RL.consume = function () {
      if (isVIP()) return 999;
      return origConsume();
    };
  }

  /* ═══════════════════════════════════════
     SWEET TOAST GREETING (shown once per session)
  ═══════════════════════════════════════ */
  function showVIPGreeting() {
    if (sessionStorage.getItem('ss_vip_greeted')) return;
    sessionStorage.setItem('ss_vip_greeted', '1');

    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed; top: 70px; right: 16px; z-index: 8000;
      max-width: 300px; padding: 15px 17px; border-radius: 16px;
      background: linear-gradient(135deg, rgba(236,72,153,.1), rgba(124,58,237,.06));
      border: 1px solid rgba(236,72,153,.35);
      box-shadow: 0 12px 36px rgba(0,0,0,.4);
      font-family: 'DM Sans', sans-serif;
      display: flex; gap: 11px; align-items: flex-start;
      transform: translateX(120%); transition: transform .4s ease;
      opacity: 0;
    `;
    div.innerHTML = `
      <div style="font-size:1.6rem;">💕</div>
      <div style="flex:1;">
        <div style="font-weight:800;font-size:.85rem;color:#f1f5f9;margin-bottom:3px;">Welcome back 🌸</div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.5;">Hope you're having a good day! Everything here is ready whenever you need it. ✨</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:13px;">✕</button>`;
    document.body.appendChild(div);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      div.style.transform = 'translateX(0)'; div.style.opacity = '1';
    }));
    setTimeout(() => { div.style.transform = 'translateX(120%)'; div.style.opacity = '0'; setTimeout(() => div.remove(), 400); }, 7000);
  }

  /* ═══════════════════════════════════════
     OVERRIDE AI CHAT — broader topics, sweet tone
     (Safety filters stay ON — not a jailbreak)
  ═══════════════════════════════════════ */
  function patchAIChat() {
    const win = document.getElementById('szwin') || document.getElementById('superz-window');
    if (!win) return;

    window.szSend = async function () {
      const inp  = document.getElementById('szinp') || document.getElementById('sz-input');
      const msgs = document.getElementById('szmsgs') || document.getElementById('sz-msgs');
      const msg  = (inp?.value || '').trim();
      if (!msg) return;
      inp.value = '';

      const ud = document.createElement('div'); ud.className = 'szmsg user'; ud.textContent = msg;
      msgs?.appendChild(ud); if (msgs) msgs.scrollTop = msgs.scrollHeight;

      const typ = document.createElement('div'); typ.className = 'sztyp';
      typ.innerHTML = '<div class="std"></div><div class="std"></div><div class="std"></div>';
      msgs?.appendChild(typ); if (msgs) msgs.scrollTop = msgs.scrollHeight;

      const model = window.szModel || 'gemini';
      try {
        let reply = '';
        const safety = [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ];

        if (model === 'grok') {
          // Routed through server proxy — xAI blocks direct browser calls, key must stay server-side
          const r = await fetch('/api/ai', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sessionStorage.getItem('ss_access_token') || '') },
            body: JSON.stringify({ prompt: msg, model: 'grok', subject: 'General' })
          });
          const d = await r.json(); reply = d.reply || 'No response.';
        } else if (model === 'deepseek') {
          // Routed through server proxy — DeepSeek blocks direct browser calls, key must stay server-side
          const r = await fetch('/api/ai', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sessionStorage.getItem('ss_access_token') || '') },
            body: JSON.stringify({ prompt: msg, model: 'deepseek', subject: 'General' })
          });
          const d = await r.json(); reply = d.reply || 'No response.';
        } else {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: VIP_SYSTEM + '\n\nMessage: ' + msg }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.85 }, safetySettings: safety })
          });
          const d = await r.json(); reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
        }
        typ.remove();
        const bd = document.createElement('div'); bd.className = 'szmsg bot';
        bd.innerHTML = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        msgs?.appendChild(bd); if (msgs) msgs.scrollTop = msgs.scrollHeight;
      } catch (e) {
        typ.remove();
        const bd = document.createElement('div'); bd.className = 'szmsg bot'; bd.textContent = '⚠️ Connection error, try again 💕';
        msgs?.appendChild(bd);
      }
    };

    // Update status badge subtly
    const stat = win.querySelector('.szstat, .sz-status');
    if (stat) stat.textContent = '💕 Online · Unlimited';
  }

  /* ═══════════════════════════════════════
     ACTIVATE
  ═══════════════════════════════════════ */
  function activateVIPMode() {
    if (sessionStorage.getItem('ss_vip_active')) return;
    sessionStorage.setItem('ss_vip_active', '1');
    patchRateLimit();
    patchAIChat();
    showVIPGreeting();
    console.log('💕 VIP mode active for this account.');
  }

  /* ═══════════════════════════════════════
     INIT
  ═══════════════════════════════════════ */
  function init() {
    captureEmail();
    patchRateLimit();
    if (isVIP()) activateVIPMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 400);

})();
