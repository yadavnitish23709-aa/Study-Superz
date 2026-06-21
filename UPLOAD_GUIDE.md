# 📦 Study Superz — Master Upload Package

## ⚠️ BEFORE YOU UPLOAD — Add these script tags

Every HTML page needs these scripts in `<head>`, in this order:

```html
<script src="js/auth.js"></script>
<script src="js/gemini.js"></script>
<script src="js/superz-ai.js"></script>
<script src="js/fix.js"></script>
<script src="js/personalize.js"></script>
<script src="js/vip.js"></script>
<script src="js/ui-fixes.js"></script>
```

(Adjust path depth — pages inside `subjects/`, `class/`, `tools/` etc. need `../js/...` instead of `js/...`)

## 📁 Folder Structure — Upload As-Is

```
study-superz-MASTER/
├── index.html              ← Main landing (latest, all sections working)
├── server.js                ← Vercel-style Express backend
├── server-render.js         ← Render-compatible backend (use if deploying to Render instead)
├── render.yaml               ← Render deployment config
├── package.json
├── vercel.json
├── manifest.json
├── sw.js
├── shared.css
├── updates.html              ← Daily CBSE/NCERT news feed
├── study-superz-schema.sql   ← Run in Supabase SQL editor
├── .env.example
├── .gitignore
├── README.md / SECURITY.md
│
├── js/
│   ├── auth.js               ← Login/signup/session
│   ├── gemini.js             ← Global Gemini AI (all pages)
│   ├── superz-ai.js          ← Multi-model chat (Gemini unrestricted, Grok/DS study-only)
│   ├── fix.js                ← Study filter, rate limit, auth gate
│   ├── personalize.js        ← Name-based greetings
│   ├── vip.js                ← VIP account (scoped to one email — see below)
│   └── ui-fixes.js           ← Password eye-toggle, search, perf fixes, social links
│
├── api/                      ← Vercel serverless functions
│   ├── ai.js / auth.js / admin.js
│
├── admin/panel.html          ← Admin dashboard (full user data, AI logs, security events)
├── dashboard/index.html      ← User-only dashboard (profile edit, own stats)
│
├── subjects/  (15 pages)
├── class/     (14 pages)
├── tools/     (mock-test, study-hub, study-rpg)
├── notes/, exams/, live/, legal/
├── assets/ (logo, creator photo)
└── icons/
```

## 🔑 IMPORTANT: vip.js is currently set to ONE email

`js/vip.js` line ~15:
```js
const VIP_EMAIL = 'deviusha72349@gmail.com';
```
This activates the warm/unlimited mode for **only that exact account**. Clear it to `''` to disable entirely.

## 🚀 Deploy

**Vercel (current setup):** push to GitHub → Vercel auto-deploys using `vercel.json` + `api/*.js`

**Render (alternative):** rename `server-render.js` → `server.js`, push to GitHub → Render reads `render.yaml`

## 🗄️ Supabase

Run `study-superz-schema.sql` in SQL Editor, then:
```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'yadavnitish23709@gmail.com';
```
