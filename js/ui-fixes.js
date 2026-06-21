/**
 * Study Superz — UI Fixes Batch 1
 * Upload as: js/ui-fixes.js
 * Fixes:
 * 1. Password show/hide eye icon on all password fields
 * 2. Scroll lag / performance fixes (reduces expensive repaints)
 * 3. Basic search across lessons/notes/tests
 * 4. Social links injection
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════
     1. PASSWORD EYE TOGGLE
  ═══════════════════════════════════════ */
  function addPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.dataset.eyeAdded) return;
      input.dataset.eyeAdded = '1';

      // Wrap input if not already wrapped
      let wrap = input.parentElement;
      if (!wrap.classList.contains('pw-wrap')) {
        wrap = document.createElement('div');
        wrap.className = 'pw-wrap';
        wrap.style.cssText = 'position:relative;width:100%;';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
      }

      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'pw-eye';
      eye.innerHTML = '👁️';
      eye.setAttribute('aria-label', 'Show password');
      eye.style.cssText = `
        position:absolute; right:10px; top:50%; transform:translateY(-50%);
        background:none; border:none; cursor:pointer; font-size:15px;
        opacity:.6; padding:4px; line-height:1; z-index:2;
      `;
      eye.onclick = () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        eye.innerHTML = showing ? '👁️' : '🙈';
        eye.style.opacity = showing ? '.6' : '1';
      };
      wrap.appendChild(eye);
      input.style.paddingRight = '38px';
    });
  }

  // Run on load + watch for new password fields (modals etc.)
  addPasswordToggles();
  const pwObserver = new MutationObserver(addPasswordToggles);
  pwObserver.observe(document.body, { childList: true, subtree: true });

  /* ═══════════════════════════════════════
     2. SCROLL / PERFORMANCE FIXES
     Removes expensive animations during scroll,
     uses passive listeners, throttles repaint-heavy effects
  ═══════════════════════════════════════ */
  const perfStyle = document.createElement('style');
  perfStyle.textContent = `
    /* Disable heavy blur/animation while scrolling for performance */
    body.is-scrolling .orb,
    body.is-scrolling .cr-glow,
    body.is-scrolling .gcard::before {
      animation-play-state: paused !important;
    }
    /* Use GPU-accelerated transforms instead of layout-triggering properties */
    .ccard, .sbcard, .tcard, .ecard, .gcard, .aifc {
      will-change: transform;
      transform: translateZ(0);
    }
    /* Reduce blur radius on mobile — huge perf cost */
    @media (max-width: 768px) {
      .orb { filter: blur(40px) !important; }
      .cr-glow { filter: blur(30px) !important; }
    }
    /* Disable backdrop-filter on low-power scroll (very expensive) */
    body.is-scrolling nav {
      backdrop-filter: none !important;
      background: rgba(6,6,18,.98) !important;
    }
    /* Smoother scroll on iOS */
    html { -webkit-overflow-scrolling: touch; }
    /* Reduce particle canvas opacity + size on mobile */
    @media (max-width: 600px) {
      body > canvas { opacity: .25 !important; }
    }
  `;
  document.head.appendChild(perfStyle);

  // Throttled scroll class toggle
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    document.body.classList.add('is-scrolling');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => document.body.classList.remove('is-scrolling'), 150);
  }, { passive: true });

  // Reduce particle canvas point count on low-end devices
  function optimizeCanvas() {
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const isMobile = window.innerWidth < 700;
    if (isLowEnd || isMobile) {
      window._ssParticleCount = 20; // reduced from 55
    }
  }
  optimizeCanvas();

  /* ═══════════════════════════════════════
     3. SEARCH FUNCTIONALITY
  ═══════════════════════════════════════ */
  const SEARCH_INDEX = [
    // Subjects
    { type: 'Subject', title: 'Mathematics', url: 'subjects/maths.html', icon: '📐' },
    { type: 'Subject', title: 'Physics', url: 'subjects/physics.html', icon: '⚡' },
    { type: 'Subject', title: 'Chemistry', url: 'subjects/chemistry.html', icon: '⚗️' },
    { type: 'Subject', title: 'Biology', url: 'subjects/biology.html', icon: '🧬' },
    { type: 'Subject', title: 'English', url: 'subjects/english.html', icon: '📝' },
    { type: 'Subject', title: 'Hindi', url: 'subjects/hindi.html', icon: '🇮🇳' },
    { type: 'Subject', title: 'History', url: 'subjects/history.html', icon: '🏛️' },
    { type: 'Subject', title: 'Geography', url: 'subjects/geography.html', icon: '🌏' },
    { type: 'Subject', title: 'Economics', url: 'subjects/economics.html', icon: '📊' },
    { type: 'Subject', title: 'Computer Science', url: 'subjects/cs.html', icon: '💻' },
    { type: 'Subject', title: 'Accountancy', url: 'subjects/accounts.html', icon: '🧾' },
    { type: 'Subject', title: 'Business Studies', url: 'subjects/business.html', icon: '💼' },
    { type: 'Subject', title: 'Political Science', url: 'subjects/polsci.html', icon: '⚖️' },
    // Tools
    { type: 'Tool', title: 'AI Mock Test', url: 'tools/mock-test.html', icon: '🎯' },
    { type: 'Tool', title: 'Smart Notes Generator', url: 'notes/index.html', icon: '📝' },
    { type: 'Tool', title: 'Study Hub (Music + Timer)', url: 'tools/study-hub.html', icon: '🎵' },
    { type: 'Tool', title: 'Study RPG Game', url: 'tools/study-rpg.html', icon: '🎮' },
    { type: 'Tool', title: 'Student Dashboard', url: 'dashboard/index.html', icon: '📊' },
    { type: 'Tool', title: 'Competitive Exam Hub', url: 'exams/index.html', icon: '🏆' },
    // Exams
    { type: 'Exam', title: 'JEE Main & Advanced', url: 'exams/index.html#jee', icon: '🏅' },
    { type: 'Exam', title: 'NEET UG', url: 'exams/index.html#neet', icon: '🏅' },
    { type: 'Exam', title: 'UPSC CSE', url: 'exams/index.html#upsc', icon: '📋' },
    { type: 'Exam', title: 'SSC CGL', url: 'exams/index.html#ssc', icon: '📋' },
    // Classes
    { type: 'Class', title: 'Class 10', url: 'class/class-10.html', icon: '🏆' },
    { type: 'Class', title: 'Class 12', url: 'class/class-12.html', icon: '🎓' },
  ];

  function injectSearchBar() {
    if (document.getElementById('ss-search')) return;
    const nav = document.querySelector('nav');
    if (!nav) return;

    const wrap = document.createElement('div');
    wrap.id = 'ss-search';
    wrap.style.cssText = 'position:relative;flex-shrink:0;margin:0 6px;';
    wrap.innerHTML = `
      <input id="ss-search-inp" placeholder="🔍 Search lessons, tools, exams..." style="
        width:170px; padding:7px 12px; border-radius:8px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
        color:#f1f5f9; font-size:12px; outline:none; font-family:inherit;
        transition:width .2s;
      "/>
      <div id="ss-search-results" style="
        position:absolute; top:38px; right:0; width:300px; max-height:380px;
        overflow-y:auto; background:#0d0d20; border:1px solid rgba(255,255,255,.1);
        border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.5); display:none; z-index:5000;
      "></div>`;

    const navLinks = nav.querySelector('.nlinks');
    if (navLinks) nav.insertBefore(wrap, navLinks.nextSibling);
    else nav.appendChild(wrap);

    const inp = document.getElementById('ss-search-inp');
    const results = document.getElementById('ss-search-results');

    inp.addEventListener('focus', () => { inp.style.width = '220px'; });
    inp.addEventListener('blur', () => { setTimeout(() => { inp.style.width = '170px'; results.style.display = 'none'; }, 150); });

    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { results.style.display = 'none'; return; }
      const matches = SEARCH_INDEX.filter(item => item.title.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)).slice(0, 8);
      if (!matches.length) {
        results.innerHTML = '<div style="padding:16px;text-align:center;color:#475569;font-size:12px;">No results found</div>';
      } else {
        results.innerHTML = matches.map(m => `
          <a href="${m.url}" style="display:flex;align-items:center;gap:10px;padding:11px 14px;text-decoration:none;color:#f1f5f9;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;">
            <span style="font-size:1.1rem">${m.icon}</span>
            <div>
              <div style="font-weight:600;">${m.title}</div>
              <div style="font-size:10px;color:#475569;">${m.type}</div>
            </div>
          </a>`).join('');
      }
      results.style.display = 'block';
    });
  }
  injectSearchBar();

  /* ═══════════════════════════════════════
     4. SOCIAL LINKS INJECTION (footer)
  ═══════════════════════════════════════ */
  function injectSocialLinks() {
    const target = document.querySelector('.fscl') || document.querySelector('footer .flinks');
    if (!target) return;
    const links = [
      { name: 'Instagram', url: 'https://www.instagram.com/studysuperz?igsh=MXIxYm1mdG5mbWhsNQ==', icon: '📷' },
      { name: 'Telegram', url: 'https://t.me/studysuperz', icon: '📢' },
      { name: 'WhatsApp', url: 'https://whatsapp.com/channel/0029VbDKdnoJpe8gfgweRV33', icon: '💬' },
      { name: 'YouTube', url: 'https://youtube.com/@studysuperz?si=7xZisZujAiGVSqKe', icon: '▶️' },
    ];
    links.forEach(l => {
      if (target.querySelector(`a[href="${l.url}"]`)) return;
      const a = document.createElement('a');
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
      a.className = target.classList.contains('fscl') ? 'fs' : '';
      a.textContent = `${l.icon} ${l.name}`;
      if (!target.classList.contains('fscl')) a.style.cssText = 'font-size:12px;color:#475569;text-decoration:none;display:block;margin-bottom:6px;';
      target.appendChild(a);
    });
  }
  injectSocialLinks();

  /* ═══════════════════════════════════════
     5. EXTERNAL RESOURCE LINK (3D Chemistry)
  ═══════════════════════════════════════ */
  function injectChemistryLink() {
    const resGrid = document.querySelector('.resgrid');
    if (!resGrid || resGrid.querySelector('[data-chem3d]')) return;
    const card = document.createElement('div');
    card.className = 'rescard';
    card.setAttribute('data-chem3d', '1');
    card.innerHTML = `
      <div class="reslogo">🧪</div>
      <div class="resname">3D Chemistry Lab</div>
      <div class="resdesc">Interactive 3D molecular models for organic and inorganic chemistry — built by a friend creator.</div>
      <div class="reslinks">
        <a href="https://3dchemistry.vercel.app" target="_blank" class="rl rl-p">Open 3D Chemistry →</a>
      </div>`;
    resGrid.appendChild(card);
  }
  injectChemistryLink();

  console.log('✅ UI Fixes Batch 1 loaded — password eye, perf fixes, search, social links, 3D chem link');
})();
