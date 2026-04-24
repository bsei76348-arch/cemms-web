# Free Deployment Guide for CEMMS-Web (Vercel)

## Step 1: Env Vars Setup (Done)
- Firebase config moved to env vars.
- Copy to `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBZpezoGJlP7Wb10UJeoDf7zwgY_gHFey0
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cemms-9e6ca.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cemms-9e6ca
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cemms-9e6ca.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=527024069469
NEXT_PUBLIC_FIREBASE_APP_ID=1:527024069469:web:57eba4d265899a1f22e6b4
```
- Add to Vercel later.

## Step 2: Test Build
```bash
cd appdev-cs-web/cemms-web
npm install
npm run build
npm start
```

## Step 3: Git Setup & Push
```bash
git init
git add .
git commit -m \"Ready for deploy\"
# Create GitHub repo, then:
git remote add origin https://github.com/YOURUSERNAME/cemms-web.git
git push -u origin main
```

## Step 4: Deploy Vercel (Free)
1. vercel.com → Sign up (GitHub).
2. New Project → Import your repo.
3. Framework: Next.js (auto).
4. Add env vars (from above, prefix NEXT_PUBLIC_).
5. Deploy → Get URL (e.g. cemms-web.vercel.app).

Live! Custom domain free later.

## Alternatives
- **Firebase Hosting** (static): Add `output: 'export'` to next.config.ts, `npm run build`, `firebase deploy`.
- Test: Open Vercel URL, check admin/login/maps.

Progress: 1/4 done.

