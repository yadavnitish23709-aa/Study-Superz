# ⚡ Study Superz

> India's Most Advanced Free AI-Powered EdTech Platform  
> **Built by Nitish Yadav** | Classes Nursery–12 | JEE · NEET · UPSC · Board Exams

---

## 🚀 Deploy to Vercel

1. Push this repo to GitHub
2. Import to [vercel.com](https://vercel.com) → New Project
3. Add all environment variables from `.env.example`
4. Deploy ✅

## ⚙️ Required Environment Variables

```bash
# Copy .env.example to .env — NEVER commit .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # SERVER ONLY
ANTHROPIC_API_KEY=sk-ant-...                       # SERVER ONLY
GEMINI_API_KEY=AIzaSy-...                          # SERVER ONLY
GROK_API_KEY=xai-...                               # SERVER ONLY
DEEPSEEK_API_KEY=sk-...                            # SERVER ONLY
JWT_SECRET=64-char-random-string                   # SERVER ONLY
ADMIN_EMAIL=yadavnitish23709@gmail.com
FRONTEND_URL=https://studysuperz.vercel.app
NODE_ENV=production
```

## 🗄️ Database Setup

1. Supabase → SQL Editor → Run `study-superz-schema.sql`
2. Make admin: `UPDATE profiles SET is_admin=TRUE WHERE email='yadavnitish23709@gmail.com';`

## 📁 Structure

```
study-superz/
├── index.html          Landing page (no API keys)
├── server.js           Secure Express backend
├── api/                Vercel serverless functions
│   ├── ai.js           AI proxy (keys server-side)
│   ├── auth.js         Auth endpoints
│   └── admin.js        Admin endpoints
├── js/auth.js          Secure client auth helper
├── subjects/           15 subject pages
├── class/              14 class pages (Nursery–12)
├── tools/              Mock test, notes, study hub
├── legal/              Terms, Privacy, Cookies, About
├── admin/panel.html    Admin panel (no hardcoded creds)
├── security/audit.md  Full security audit
├── .env.example        Template — copy to .env
├── .gitignore          Prevents secret exposure
└── vercel.json         Security headers config
```

## 🔒 Security

All API keys are server-side only. See `security/audit.md` for full audit.

## 📱 Android APK

https://median.co/share/bneyddw#apk

## 📧 Contact

Nitish Yadav — yadavnitish23709@gmail.com
