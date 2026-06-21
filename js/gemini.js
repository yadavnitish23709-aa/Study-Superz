/**
 * STUDY SUPERZ — Global Gemini AI
 * Include this on EVERY page: <script src="../js/gemini.js"></script>
 * Powers: AI Tutor, Notes, Mock Test questions, Subject pages, Superz AI
 * Built by Nitish Yadav
 */

window.StudySuperz = window.StudySuperz || {};

(function(SS){
  'use strict';

  /* ═══════════════════════════════════
     CONFIG
  ═══════════════════════════════════ */
  SS.GEMINI_KEY   = 'AIzaSyB8RN6LwTx9Y0X9_Ahi3bNriHtguJVAi1CCrRu21wxoEUyagyg';
  SS.GROK_KEY     = 'xai-L0p9EXGN3V8o4VKzJaMeQFnfZ6P9J4CQQQOytTTDseymZ0ldguU8yUZGhxdQDvdrSX3pxrBiD2apn2Cw';
  SS.DS_KEY       = 'sk-ec0b37d57a5341f3b01cd2c723237449';
  SS.UNSPLASH_KEY = 'LqoETfcaUSfBQG9ekUiBgf8aBJko9lOWn05-NDyvmQE';
  SS.SB_URL       = 'https://mlpsqojltzkrsykhcico.supabase.co';
  SS.SB_ANON      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scHNxb2psdHprcnN5a2hjaWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzU5MTUsImV4cCI6MjA5NjMxMTkxNX0.w2Xfo_x7MpFhhIIzW2uh0o-XdZkZNIJvSEEWEzD7cJ0';

  /* ═══════════════════════════════════
     CORE GEMINI CALL (unrestricted)
  ═══════════════════════════════════ */
  SS.askGemini = async function(prompt, opts = {}) {
    const {
      system = '',
      maxTokens = 800,
      temperature = 0.8,
      model = 'gemini-1.5-flash'
    } = opts;

    const fullPrompt = system ? system + '\n\n' + prompt : prompt;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SS.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
          ]
        })
      }
    );
    if (!r.ok) throw new Error('Gemini API ' + r.status + ': ' + await r.text());
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  /* ═══════════════════════════════════
     GENERATE SUBJECT NOTES
  ═══════════════════════════════════ */
  SS.generateNotes = async function({ topic, subject, cls = 'Class 10', type = 'comprehensive' }) {
    const typeInstructions = {
      comprehensive: 'Create comprehensive, well-structured study notes with all key concepts, formulas in <code> tags, and memory tips.',
      short: 'Create short revision notes with only the most important points. Max 200 words.',
      flashcards: 'Create 8 Q&A flashcard pairs in HTML format with question in <strong> and answer in <em>.',
      mindmap: 'Create a mind map style overview with main topic and branches using <h3> and bullet points.',
      ncert: 'Create NCERT-aligned notes with textbook definitions, solved examples, and board exam tips.'
    };

    const prompt = `You are an expert ${subject} teacher for Indian students.
${typeInstructions[type] || typeInstructions.comprehensive}

Topic: "${topic}"
Subject: ${subject}
Class: ${cls}

Format in clean HTML using:
- <h2> for main sections
- <h3> for sub-sections  
- <p> for paragraphs
- <ul><li> for bullet points
- <code style="background:rgba(124,58,237,.12);padding:2px 8px;border-radius:5px;color:#7c3aed;font-family:Space Mono,monospace"> for formulas/code
- <div style="background:rgba(245,158,11,.08);border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 8px 8px 0;margin:10px 0"> for important tips
- <table> for comparison tables

Make it educational, clear, and complete.`;

    return SS.askGemini(prompt, { maxTokens: 1500, temperature: 0.6 });
  };

  /* ═══════════════════════════════════
     GENERATE MCQ QUESTIONS
  ═══════════════════════════════════ */
  SS.generateMCQ = async function({ subject, num = 10, difficulty = 'mixed', topic = '' }) {
    const prompt = `Generate exactly ${num} MCQ questions for ${subject}${topic ? ' on "'+topic+'"' : ''} (${difficulty} difficulty, Class 10-12 NCERT/competitive exam level).

Return ONLY a valid JSON array with no markdown, no extra text:
[{"q":"question text","o":["Option A","Option B","Option C","Option D"],"a":0,"e":"brief explanation"}]

Where "a" is the 0-based index of the correct answer.
Make questions clear, educational, and varied.`;

    const raw = await SS.askGemini(prompt, { maxTokens: 2000, temperature: 0.7 });
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  };

  /* ═══════════════════════════════════
     GENERATE EXAM STUDY GUIDE
  ═══════════════════════════════════ */
  SS.generateExamGuide = async function({ exam, question }) {
    const prompt = `You are an expert coach for ${exam} preparation in India.

Answer this student's question with specific, actionable advice:
"${question}"

Include:
- Direct answer to the question
- Specific study tips
- Time management advice if relevant
- Resources to use
- Common mistakes to avoid

Be practical, motivating, and concise (under 250 words). Use bullet points.`;

    return SS.askGemini(prompt, { maxTokens: 700, temperature: 0.7 });
  };

  /* ═══════════════════════════════════
     UNSPLASH IMAGE HELPER
  ═══════════════════════════════════ */
  const imgCache = {};
  SS.getImage = async function(query, width = 800, height = 400) {
    if (imgCache[query]) return imgCache[query];
    try {
      const r = await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${SS.UNSPLASH_KEY}`);
      const d = await r.json();
      const url = d.urls?.regular || d.urls?.small || '';
      if (url) imgCache[query] = url;
      return url;
    } catch {
      return `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=${width}&q=75`;
    }
  };

  /* ═══════════════════════════════════
     AUTO-INJECT ON SUBJECT PAGES
     Detects page type and wires up AI
  ═══════════════════════════════════ */
  function autoWireSubjectPage() {
    const title = document.title || '';
    const subject = title.split('|')[0]?.trim() || 'General';

    // Wire AI Tutor button if present
    const askBtn = document.querySelector('[onclick*="askAI"], .abp');
    if (askBtn) {
      window.askAI = async function() {
        const ap = document.getElementById('ap');
        const ar = document.getElementById('ar');
        if (!ap || !ar) return;
        const q = ap.value.trim(); if (!q) return;

        ar.innerHTML = `<span style="color:#94a3b8">🧠 Gemini is thinking...</span>`;
        ar.classList.add('show');

        try {
          const reply = await SS.askGemini(q, {
            system: `You are an expert ${subject} teacher for Indian students (NCERT curriculum, Classes 6-12). Give clear, detailed, step-by-step answers with examples. Include formulas where needed.`,
            maxTokens: 1000
          });
          ar.innerHTML = reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch(e) {
          ar.innerHTML = '⚠️ Error: ' + e.message + '. Please check your internet connection.';
        }
      };
    }

    // Wire notes generate button if present
    window.generateNote = async function() {
      const topicEl = document.getElementById('topic-input');
      const subjEl  = document.getElementById('subj-select');
      const clsEl   = document.getElementById('class-select');
      const typeEl  = document.getElementById('type-select');
      const display = document.getElementById('note-display');

      const topic   = topicEl?.value?.trim();
      const subj    = subjEl?.value || subject;
      const cls     = clsEl?.value || 'Class 10';
      const type    = typeEl?.value || 'comprehensive';

      if (!topic) { alert('Please enter a topic!'); return; }
      if (display) display.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">⚙️ Generating notes with Gemini AI...</div>';

      try {
        const content = await SS.generateNotes({ topic, subject: subj, cls, type });
        if (display) {
          display.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
              <div>
                <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem">${topic}</div>
                <div style="font-size:12px;color:#475569;margin-top:3px">${subj} · ${cls} · ${type}</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button onclick="navigator.clipboard.writeText(document.getElementById('nc').innerText).then(()=>alert('Copied!'))" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#94a3b8;font-size:12px;cursor:pointer;">📋 Copy</button>
                <button onclick="window.print()" style="padding:7px 14px;border-radius:8px;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.25);color:#7c3aed;font-size:12px;cursor:pointer;">🖨️ Print / PDF</button>
              </div>
            </div>
            <div id="nc" style="font-size:14px;line-height:1.9;">${content}</div>`;
          // Save
          const saved = JSON.parse(localStorage.getItem('ss_notes') || '[]');
          saved.unshift({ topic, subject: subj, cls, type, content, created: Date.now() });
          localStorage.setItem('ss_notes', JSON.stringify(saved.slice(0, 50)));
        }
      } catch(e) {
        if (display) display.innerHTML = `<div style="color:#ef4444;padding:30px;text-align:center;">⚠️ Error: ${e.message}</div>`;
      }
    };

    // Wire mock test generation
    const origStart = window.startTest;
    window.startTest = async function() {
      // Try AI generation first, fallback to bank
      const cfg = window.cfg || {};
      const subjName = cfg.subj || subject;
      document.getElementById('setup').style.display = 'none';
      document.getElementById('loading').style.display = 'block';
      const msgEl = document.getElementById('load-msg');
      if (msgEl) msgEl.textContent = `Generating ${cfg.qnum || 10} ${subjName} questions with Gemini AI...`;

      try {
        const questions = await SS.generateMCQ({ subject: subjName, num: cfg.qnum || 10, difficulty: cfg.diff || 'mixed' });
        window.QS = questions;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('test').style.display = 'block';
        document.getElementById('t-subj').textContent = subjName;
        document.getElementById('t-qc').textContent = (cfg.qnum || 10) + ' Qs';
        document.getElementById('t-diff').textContent = cfg.diff || 'Mixed';
        window.uAns = {}; window.curQ = 0; window.finished = false; window.startTime = Date.now();
        if (window.buildPalette) buildPalette();
        if (window.showQ) showQ(0);
        if (window.startTimer) startTimer();
      } catch(e) {
        console.log('AI generation failed, using bank:', e.message);
        if (origStart) origStart();
        else document.getElementById('loading').style.display = 'none';
      }
    };
  }

  /* ═══════════════════════════════════
     GEMINI CHAT HELPER (for Superz AI)
  ═══════════════════════════════════ */
  SS.SUPERZ_SYSTEM = `You are Superz — a highly intelligent AI assistant built by Nitish Yadav for Study Superz (studysuperz-aa.vercel.app).

You are powered by Google Gemini and can help with ANYTHING:
- All school subjects (Physics, Chemistry, Biology, Maths, English, Hindi, History, Geography, etc.)
- Competitive exam preparation (JEE, NEET, UPSC, SSC, Banking, etc.)
- General knowledge, science, history, current events
- Coding and programming help
- Creative writing, essays, compositions
- Mathematics at all levels
- Career advice, study tips
- Casual conversation, jokes, riddles
- And absolutely anything else!

Be helpful, friendly, accurate, and engaging. Use emojis naturally. Keep responses clear and well-structured.

About you:
- Name: Superz AI
- Built by: Nitish Yadav (yadavnitish23709@gmail.com)
- Platform: Study Superz — India's free AI learning platform
- Powered by: Google Gemini 1.5 Flash

If asked about Study Superz features: classes from Nursery to Class 12, 50+ subjects, AI mock tests, smart notes, Study RPG, Spotify integration, 500-min study timer, competitive exam hub, and much more — all free!`;

  /* ═══════════════════════════════════
     INIT
  ═══════════════════════════════════ */
  function init() {
    autoWireSubjectPage();
    console.log('✅ Study Superz Gemini AI loaded globally');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);

})(window.StudySuperz);
