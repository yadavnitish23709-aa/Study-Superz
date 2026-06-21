# ⚡ STUDY SUPERZ — Complete Project Guide
## By Nitish Yadav | yadavnitish23709@gmail.com

---

## 📦 WHAT'S INSIDE THE ZIP

```
study-superz-final/          (62 files, ~1.7MB)
│
├── 📄 index.html            ← Main landing page (AI, classes, subjects, creator)
├── 📄 server.js             ← Secure Express backend (all API keys here)
├── 📄 package.json          ← Node.js dependencies
├── 📄 vercel.json           ← Vercel deploy config + security headers
├── 📄 manifest.json         ← PWA config
├── 📄 sw.js                 ← Service worker (offline support)
├── 📄 .env.example          ← ⚠️ Copy to .env and fill your keys
├── 📄 .gitignore            ← Prevents secrets from going to GitHub
├── 📄 README.md             ← Full documentation
├── 📄 SECURITY.md           ← Security policy
├── 📄 study-superz-schema.sql ← Run this in Supabase
│
├── 📁 api/                  ← Vercel serverless functions
│   ├── ai.js                ← AI proxy (Gemini/Grok/Claude/DeepSeek)
│   ├── auth.js              ← Signup/Login/Reset endpoints
│   └── admin.js             ← Admin CRUD endpoints
│
├── 📁 js/
│   └── auth.js              ← Secure client auth (no API keys)
│
├── 📁 subjects/ (15 files)  ← Maths, Physics, Chemistry, Biology...
├── 📁 class/ (14 files)     ← Nursery, KG, Class 1–12
├── 📁 tools/                ← Mock Test, Study Hub, Notes
├── 📁 notes/                ← Smart Notes Generator
├── 📁 dashboard/            ← Student dashboard
├── 📁 exams/                ← JEE, NEET, UPSC, SSC...
├── 📁 live/                 ← Free live classes
├── 📁 admin/panel.html      ← Admin panel (secure, no hardcoded creds)
├── 📁 legal/                ← Terms, Privacy, Cookies, About, Reset Password
├── 📁 assets/               ← logo.png, nitish.webp
├── 📁 icons/                ← PWA icon SVG
└── 📁 security/audit.md     ← Full security audit report
```

---

## 🔐 ENVIRONMENT VARIABLES (Set in Vercel Dashboard)

| Variable | Where to Get | Example |
|---|---|---|
| SUPABASE_URL | supabase.com → Settings → API | https://abc.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | supabase.com → Settings → API | eyJhbGci... |
| SUPABASE_ANON_KEY | supabase.com → Settings → API | eyJhbGci... |
| ANTHROPIC_API_KEY | console.anthropic.com | sk-ant-... |
| GEMINI_API_KEY | aistudio.google.com | AIzaSy... |
| GROK_API_KEY | console.x.ai | xai-... |
| DEEPSEEK_API_KEY | platform.deepseek.com | sk-... |
| JWT_SECRET | Generate random 64 chars | (any strong string) |
| JWT_REFRESH_SECRET | Generate random 64 chars | (any strong string) |
| ADMIN_EMAIL | Your email | yadavnitish23709@gmail.com |
| FRONTEND_URL | Your Vercel URL | https://studysuperz.vercel.app |
| NODE_ENV | Set to production | production |

---

## 🗄️ DATABASE SETUP (Supabase)

1. Go to https://supabase.com
2. Create new project (free tier)
3. Go to SQL Editor
4. Copy paste entire contents of `study-superz-schema.sql`
5. Click RUN
6. Then run this one more query:
   UPDATE profiles SET is_admin=TRUE WHERE email='yadavnitish23709@gmail.com';

---

## 🚀 DEPLOY TO VERCEL (Step by Step)

1. Upload ZIP to GitHub (see mobile guide below)
2. Go to https://vercel.com
3. Click "New Project"
4. Click "Import Git Repository"
5. Select your study-superz repo
6. Click "Environment Variables"
7. Add ALL variables from the table above
8. Click "Deploy"
9. Wait 2-3 minutes ✅

---

## 📱 HOW TO UPLOAD FROM MOBILE TO GITHUB

### METHOD 1 — GitHub Mobile App (EASIEST)

STEP 1: Install GitHub app from Play Store / App Store

STEP 2: Sign in to your GitHub account

STEP 3: Create new repository:
  → Tap + (top right)
  → New Repository
  → Name: study-superz
  → Set to Public
  → Tap Create Repository

STEP 4: Extract the ZIP file on your phone:
  → Android: Use "Files" or "ZArchiver" app
  → iPhone: Tap ZIP → Files app opens it automatically

STEP 5: Upload files using GitHub.com in browser:
  → Open Chrome/Safari
  → Go to github.com/YOUR_USERNAME/study-superz
  → Tap "+" → "Upload files"
  → Select all extracted files
  → Tap "Commit changes"
  ⚠️ Note: Upload folder by folder (subjects/, class/ etc.)

### METHOD 2 — GitHub Website on Mobile (RECOMMENDED)

STEP 1: Go to github.com on Chrome
STEP 2: Create new repo named "study-superz"
STEP 3: Tap "uploading an existing file" link
STEP 4: Extract ZIP → Select files → Upload

For FOLDERS (subjects, class, tools etc):
STEP 1: Open github.com/YOUR_USERNAME/study-superz
STEP 2: Tap "Add file" → "Upload files"
STEP 3: Select files from that folder
STEP 4: In commit box type: "Add subjects folder"
STEP 5: Tap "Commit changes"
STEP 6: Repeat for each folder

### METHOD 3 — GitHub Desktop on PC (EASIEST if you have PC)

STEP 1: Download GitHub Desktop from desktop.github.com
STEP 2: Sign in → New Repository → study-superz
STEP 3: Copy extracted ZIP contents into repo folder
STEP 4: Click "Commit to main"
STEP 5: Click "Publish Repository"
DONE ✅

### METHOD 4 — Using Termux on Android (Advanced)

STEP 1: Install Termux from F-Droid
STEP 2: Run these commands:
  pkg install git
  git config --global user.email "yadavnitish23709@gmail.com"
  git config --global user.name "Nitish Yadav"
STEP 3: Extract ZIP, navigate to folder
  cd /storage/emulated/0/Download/study-superz-final
STEP 4:
  git init
  git add .
  git commit -m "Initial commit - Study Superz"
  git remote add origin https://github.com/YOUR_USERNAME/study-superz.git
  git push -u origin main
DONE ✅

---

## 🔑 IMPORTANT FILES TO NEVER UPLOAD

✋ NEVER put these in GitHub:
  - .env (your real secrets)
  - Any file with actual API keys
  - The .gitignore already blocks .env automatically

✅ The .gitignore file handles this automatically

---

## ⚙️ VERCEL DEPLOYMENT SETTINGS

Framework Preset: Other
Build Command: (leave empty)
Output Directory: . (dot)
Install Command: npm install
Root Directory: ./

---

## 📱 APK DOWNLOAD LINK (Ready to share)
https://median.co/share/bneyddw#apk

---

## 🔧 AFTER DEPLOYMENT CHECKLIST

[ ] Supabase SQL schema run
[ ] Admin user set (is_admin=TRUE)
[ ] All env vars added in Vercel
[ ] Site loads at your-project.vercel.app
[ ] Can sign up and log in
[ ] AI chatbot works (Superz AI bottom left)
[ ] Admin panel accessible at /admin/panel.html
[ ] Push notifications working
[ ] PWA installable (bottom popup)
[ ] APK download link works

---

## 📞 SUPPORT

Nitish Yadav
Email: yadavnitish23709@gmail.com
Telegram: t.me/studysuperz

