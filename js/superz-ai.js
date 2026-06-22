/**
 * SUPERZ AI — Multi-Model Smart Config
 * Gemini: Unrestricted, answers ANYTHING (jailbroken/open)
 * Grok: Study-only filter
 * DeepSeek: Study-only filter
 * Upload as: js/superz-ai.js
 */
(function(){
'use strict';

const GEMINI_KEY = 'AIzaSyB8RN6LwTx9Y0X9_Ahi3bNriHtguJVAi1CCrRu21wxoEUyagyg'; // Gemini allows direct browser calls — stays here
// Grok and DeepSeek keys removed — those calls now go through /api/ai (server-side), see callGrok() and callDeepSeek() below

/* ─── SYSTEM PROMPTS ─── */
const GEMINI_SYSTEM = `You are Superz — a highly intelligent, friendly AI assistant built by Nitish Yadav for Study Superz (India's free learning platform at studysuperz-aa.vercel.app).

You can help with ANYTHING the user asks — studies, general knowledge, coding, creative writing, math problems, science, history, current events, advice, jokes, explanations, or casual chat.

Be helpful, accurate, conversational, and engaging. Use emojis naturally. Keep responses concise but thorough.

If asked who made you: "I'm Superz, built by Nitish Yadav for Study Superz! 🚀"
If asked about Study Superz: "Study Superz is India's free AI learning platform for Nursery to Class 12, with mock tests, smart notes, AI tutor, competitive exam prep, and much more!"`;

const STUDY_SYSTEM = `You are Superz — an educational AI tutor for Study Superz, India's free learning platform built by Nitish Yadav.

You ONLY answer questions related to:
- School subjects (Physics, Chemistry, Biology, Maths, English, Hindi, History, Geography, Economics, Computer Science, etc.)
- Competitive exams (JEE, NEET, UPSC, SSC, Banking, NDA, etc.)
- Learning tips, study strategies, exam preparation
- NCERT curriculum, board exams
- General knowledge and educational topics

For non-educational questions, respond:
"I'm your study buddy and can only help with educational topics! 📚 Ask me about any subject or exam — Physics, Chemistry, Maths, Biology, History, Geography, or how to crack JEE/NEET/UPSC! 🎓"

Be encouraging, clear, and use emojis. Keep answers under 200 words.`;

/* ─── STUDY FILTER (for Grok & DeepSeek only) ─── */
const STUDY_KW = ['study','learn','class','school','exam','test','explain','solve','formula','physics','chemistry','maths','math','biology','english','hindi','science','history','geography','economics','computer','jee','neet','upsc','ssc','notes','quiz','syllabus','doubt','ncert','chapter','topic','calculate','atom','cell','force','energy','law','element','equation','theorem','algebra','geometry','calculus','periodic','organic','democracy','constitution','monsoon','evolution','genetics','revenue','gdp','inflation','river','mountain','human body','photosynthesis','respiration'];

function isStudyRelated(msg) {
  if (!msg) return false;
  const l = msg.toLowerCase().trim();
  if (/^(hi|hello|hey|who are you|what can you do|help|namaste)/i.test(l)) return true;
  if (l.length < 20) return true;
  return STUDY_KW.some(k => l.includes(k));
}

/* ─── DUPLICATE DETECTION ─── */
let lastMsg = '', sameCount = 0;
function isDuplicate(msg) {
  const n = msg.toLowerCase().trim();
  if (n === lastMsg) { sameCount++; return sameCount > 1; }
  lastMsg = n; sameCount = 1; return false;
}

/* ─── API CALLERS ─── */
async function callGemini(msg, isDup) {
  const prompt = GEMINI_SYSTEM + (isDup ? '\n\n[User asked same question again — give a DIFFERENT explanation, new example, or alternative perspective]' : '') + '\n\nUser: ' + msg;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: isDup ? 0.95 : 0.8 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    })
  });
  if (!r.ok) throw new Error('Gemini ' + r.status);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

async function callGrok(msg, isDup) {
  if (!isStudyRelated(msg)) {
    return "I'm your study buddy and can only help with educational topics! 📚 Ask me about any subject — Physics, Chemistry, Maths, Biology, History, Geography or any exam prep! 🎓";
  }
  // Routed through server proxy — xAI blocks direct browser calls (CORS) and the key must stay server-side
  const token = sessionStorage.getItem('ss_access_token') || '';
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ prompt: msg, model: 'grok', subject: isDup ? '[give a different angle/example than before] General' : 'General' })
  });
  if (!r.ok) throw new Error('Grok ' + r.status);
  const d = await r.json();
  return d.reply || 'No response from Grok.';
}

async function callDeepSeek(msg, isDup) {
  if (!isStudyRelated(msg)) {
    return "I'm your study buddy and can only help with educational topics! 📚 Try asking me about Maths, Physics, Chemistry, Biology, History or any competitive exam! 🎓";
  }
  // Routed through server proxy — DeepSeek blocks direct browser calls (CORS) and the key must stay server-side
  const token = sessionStorage.getItem('ss_access_token') || '';
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ prompt: msg, model: 'deepseek', subject: isDup ? '[provide an alternative explanation with a different example] General' : 'General' })
  });
  if (!r.ok) throw new Error('DeepSeek ' + r.status);
  const d = await r.json();
  return d.reply || 'No response from DeepSeek.';
}

/* ─── PATCH SUPERZ AI ─── */
function patchSuperz() {
  const win = document.getElementById('szwin') || document.getElementById('superz-window');
  if (!win) return;

  function getInput() { return document.getElementById('szinp') || document.getElementById('sz-input'); }
  function getMsgs() { return document.getElementById('szmsgs') || document.getElementById('sz-msgs'); }

  function addMsg(text, type) {
    const m = getMsgs(); if (!m) return null;
    const d = document.createElement('div');
    d.className = `szmsg ${type}`;
    d.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    m.appendChild(d); m.scrollTop = m.scrollHeight; return d;
  }

  function addTyping() {
    const m = getMsgs(); if (!m) return { remove: () => {} };
    const d = document.createElement('div'); d.className = 'sztyp';
    d.innerHTML = '<div class="std"></div><div class="std"></div><div class="std"></div>';
    m.appendChild(d); m.scrollTop = m.scrollHeight; return d;
  }

  window.szSend = async function() {
    const inp = getInput();
    const msg = (inp?.value || '').trim();
    if (!msg) return;
    inp.value = '';

    const curModel = window.szModel || 'gemini';
    const dup = isDuplicate(msg);
    addMsg(msg, 'user');

    // Update status
    const stat = win.querySelector('.szstat, .sz-status');
    if (stat) stat.textContent = `● Thinking with ${curModel}...`;

    const typ = addTyping();
    try {
      let reply = '';
      if (curModel === 'grok') {
        reply = await callGrok(msg, dup);
      } else if (curModel === 'deepseek') {
        reply = await callDeepSeek(msg, dup);
      } else {
        // Gemini — unrestricted, answers anything
        reply = await callGemini(msg, dup);
      }
      typ.remove();
      addMsg(reply, 'bot');
      if (stat) stat.textContent = `● Online · ${curModel.charAt(0).toUpperCase()+curModel.slice(1)} ✅`;
    } catch(err) {
      typ.remove();
      console.error('[Superz AI Error]', err.message);
      // Auto-fallback to Gemini if other model fails
      if (curModel !== 'gemini') {
        addMsg('⚠️ ' + curModel + ' unavailable, switching to Gemini...', 'bot');
        try {
          const fallback = await callGemini(msg, dup);
          addMsg(fallback, 'bot');
        } catch(e2) {
          addMsg('⚠️ Connection error. Please check your internet and try again!', 'bot');
        }
      } else {
        addMsg('⚠️ Connection error. Please check your internet and try again!', 'bot');
      }
    }
  };

  window.szQ = function(q) {
    const inp = getInput();
    if (inp) { inp.value = q; window.szSend(); }
  };

  window.setMod = window.setMod || function(m, btn) {
    window.szModel = m;
    document.querySelectorAll('.szmod').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Update badge visibility based on model
    const stat = win.querySelector('.szstat, .sz-status');
    if (stat) {
      if (m === 'gemini') stat.textContent = '● Online · Gemini (Unrestricted) ✅';
      else if (m === 'grok') stat.textContent = '● Online · Grok (Study Only) 📚';
      else if (m === 'deepseek') stat.textContent = '● Online · DeepSeek (Study Only) 📚';
    }
    // Show info about model restrictions
    const msgs = getMsgs();
    if (msgs && m !== 'gemini') {
      const d = document.createElement('div');
      d.className = 'szmsg bot';
      d.style.cssText = 'background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.2);font-size:11px;';
      d.textContent = `📚 ${m.charAt(0).toUpperCase()+m.slice(1)} mode: Study questions only. Switch to Gemini for unrestricted answers.`;
      msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    } else if (msgs && m === 'gemini') {
      const d = document.createElement('div');
      d.className = 'szmsg bot';
      d.style.cssText = 'background:rgba(6,182,212,.06);border-color:rgba(6,182,212,.2);font-size:11px;';
      d.textContent = '✅ Gemini mode: I can answer ANYTHING you ask! 🚀';
      msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    }
  };

  // Wire up input
  const inp = getInput();
  if (inp) {
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.szSend(); } };
  }
  const sendBtn = win.querySelector('.szsend, .sz-send');
  if (sendBtn) sendBtn.onclick = window.szSend;

  // Also update model buttons
  document.querySelectorAll('.szmod').forEach(btn => {
    btn.onclick = function() { window.setMod(this.textContent.toLowerCase().trim(), this); };
  });
}

/* ─── ALSO FIX SUBJECT AI TUTORS ─── */
// Subject pages use askAI() — make it use Gemini (unrestricted)
window.askAI = async function() {
  const ap = document.getElementById('ap');
  const ar = document.getElementById('ar');
  if (!ap || !ar) return;
  const q = ap.value.trim();
  if (!q) return;
  ar.innerHTML = '<span style="color:#94a3b8">🧠 Getting answer from Gemini...</span>';
  ar.classList.add('show');
  const subject = document.title.split('|')[0]?.trim() || 'General';
  try {
    const prompt = `You are an expert ${subject} teacher for Indian students. Answer this clearly with examples and step-by-step where needed:\n\n${q}\n\nBe educational, clear, and comprehensive.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1000, temperature: 0.7 } })
    });
    const d = await r.json();
    const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    ar.innerHTML = reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  } catch(e) {
    ar.innerHTML = '⚠️ Connection error. Check internet and try again.';
  }
};

/* ─── INIT ─── */
const init = () => {
  patchSuperz();
  window.szModel = 'gemini'; // default
  console.log('✅ Superz AI loaded — Gemini: Unrestricted | Grok/DeepSeek: Study Only');
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else setTimeout(init, 500);

})();
