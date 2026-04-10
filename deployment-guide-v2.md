# 🚀 sarcast.ai v2 — Full Deployment Guide

## What's New in v2
- 6 personality questions (up from 3)
- 3 jokes to rate on a scale of 1–10
- Unlimited growing cue list per user (caps at 50, never resets)
- Sarcasm intensity calibrated from joke ratings
- Returning users skip onboarding — vibe remembered forever
- Supabase stores each user's profile separately

---

## File Structure
```
sarcast-ai/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── railway.toml
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       └── components/
│           ├── OnboardingQuiz.jsx
│           ├── OnboardingQuiz.css
│           ├── ChatWindow.jsx
│           └── ChatWindow.css
└── supabase_schema.sql
```

---

## STEP 1 — GitHub

1. Go to **github.com** → Sign up or log in
2. Click **New Repository** → name it `sarcast-ai` → Public
3. Upload all files maintaining the folder structure above
4. Commit with message: `initial commit`

---

## STEP 2 — Supabase (Database — Free)

1. Go to **supabase.com** → Sign up
2. Click **New Project** → name it `sarcast-ai` → pick a region close to you
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** in the left sidebar
5. Paste the entire contents of `supabase_schema.sql` and click **Run**
6. Go to **Settings → API**
7. Copy two things:
   - **Project URL** — looks like `https://xxxx.supabase.co`
   - **anon public key** — long string starting with `eyJ...`
8. Save both — you'll need them in the next step

---

## STEP 3 — Hugging Face Token (Free)

1. Go to **huggingface.co** → Sign up
2. Go to **Settings → Access Tokens**
3. Click **New Token** → name: `sarcast` → Role: **Read**
4. Copy the token (starts with `hf_...`)

---

## STEP 4 — Railway (Backend — Free)

1. Go to **railway.app** → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `sarcast-ai` repo
4. Set **Root Directory** to `backend`
5. Go to **Variables** tab and add ALL of these:
   ```
   HF_TOKEN         = hf_your_token_here
   SUPABASE_URL     = https://xxxx.supabase.co
   SUPABASE_KEY     = eyJ...your_anon_key...
   ```
6. Click **Deploy** — wait ~2 minutes
7. Go to **Settings → Networking → Generate Domain**
8. Copy your backend URL e.g. `https://sarcast-ai-production.up.railway.app`

---

## STEP 5 — Vercel (Frontend — Free)

1. Go to **vercel.com** → Sign up with GitHub
2. Click **Add New Project** → Select `sarcast-ai` repo
3. Set **Root Directory** to `frontend`
4. Under **Environment Variables** add:
   ```
   VITE_BACKEND_URL = https://your-backend.railway.app
   ```
5. Click **Deploy** — ~1 minute
6. You get a URL like `sarcast-ai.vercel.app` — that's your live app

---

## STEP 6 — Test It End to End

1. Open your Vercel URL
2. New user → sees 6 personality questions + 3 joke ratings
3. Complete onboarding → profile saved to Supabase
4. Chat away — vibe adapts silently every 5 messages
5. Close tab and come back → goes straight to chat, vibe remembered
6. Each user is tracked by their own browser session ID — completely separate

---

## How the Full Vibe System Works

### Phase 1 — Onboarding (one time, ~60 seconds)
```
6 Questions → broad vibe detection
     +
3 Joke Ratings (1–10) → sarcasm intensity + style calibration
     ↓
Vibe profile created and saved to Supabase
```

### Phase 2 — Live Adaptation (ongoing, silent)
```
Every 5 messages →
  Backend re-reads user's writing style
  New cues added to their profile (never deleted)
  Vibe shifts if patterns change
  Profile updated in Supabase silently
```

### What Gets Stored Per User
```json
{
  "session_id": "user_abc123",
  "vibe": "gen_z",
  "sarcasm_intensity": 8,
  "confidence": 0.91,
  "cues": [
    "uses Gen Z slang: lol, fr, ngl",
    "very short messages — minimal, to the point",
    "loves savage roast-style humour",
    "not into overly polite sarcasm",
    "uses blunt expressive language",
    "asks lots of questions — curious",
    "comfortable with dark humour",
    "... grows with every session"
  ]
}
```

### Cue Rules
- No hard limit while chatting — grows indefinitely
- Hard cap at 50 stored cues to keep prompts lean
- Deduplication — same observation never stored twice
- All cues injected into system prompt on every message

---

## Cost Summary

| Item | Cost |
|------|------|
| GitHub | $0 |
| Supabase (database) | $0 free tier |
| Hugging Face (models) | $0 free tier |
| Railway (backend) | $0 free tier |
| Vercel (frontend) | $0 |
| **Total** | **$0/month** |

When you grow → move backend to Hetzner VPS ~$5/month.

---

## Troubleshooting

**Returning user not recognised** → Check SUPABASE_URL and SUPABASE_KEY are set correctly in Railway variables.

**Onboarding submits but vibe not saved** → Check Railway logs for Supabase connection errors.

**Model slow to respond** → Normal on HF free tier. First request wakes the model (~20s). Add HF_TOKEN to speed it up.

**Railway app sleeping** → Free tier sleeps after inactivity. First request wakes it (~10s delay).
