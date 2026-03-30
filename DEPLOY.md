# Deployment Guide

Deploy Travel Together using **Vercel** (frontend) + **Render** (backend + database).

---

## Step 1: Push to GitHub

```bash
git push origin main
```

---

## Step 2: Deploy Backend to Render

> Skip "Create Web Service" and "Add PostgreSQL" if you already have them set up — go straight to Step 2.7 to add the new env vars and run the new migrations.

1. **Go to**: https://render.com → Sign up/login with GitHub

2. **New** → **Web Service**

3. **Connect your repo**: `pjloury/travel-together`

4. **Configure**:
   | Setting | Value |
   |---------|-------|
   | Name | `travel-together-api` |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node index.js` |

5. **Create Web Service** (uses free tier)

6. **Add PostgreSQL Database**:
   - Go to Dashboard → **New** → **PostgreSQL**
   - Name: `travel-together-db`
   - Plan: Free
   - Create Database

7. **Add Environment Variables** (Render → Web Service → Environment):
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Copy "External Database URL" from your PostgreSQL dashboard |
   | `JWT_SECRET` | Generate: `openssl rand -hex 32` |
   | `FRONTEND_URL` | `https://travel-together.vercel.app` (set after Vercel deploy) |
   | `GOOGLE_CLIENT_ID` | From [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 Client ID |
   | `ANTHROPIC_API_KEY` | From [Anthropic Console](https://console.anthropic.com) |
   | `OPENAI_API_KEY` | From [OpenAI Platform](https://platform.openai.com/api-keys) |
   | `UNSPLASH_ACCESS_KEY` | From [Unsplash Developers](https://unsplash.com/developers) |

8. **Run Database Migrations** (run all in order):
   ```bash
   export DB="YOUR_EXTERNAL_DATABASE_URL"

   # Core tables (run once if new database)
   psql "$DB" -f server/db/schema/001_users.sql
   psql "$DB" -f server/db/schema/005_friendships.sql
   psql "$DB" -f server/db/schema/006_password_reset.sql
   psql "$DB" -f server/db/schema/007_google_oauth.sql

   # New pin-based model (run these even on existing database)
   psql "$DB" -f server/db/schema/009_retire_old_tables.sql
   psql "$DB" -f server/db/schema/010_experience_tags.sql
   psql "$DB" -f server/db/schema/011_pins.sql
   psql "$DB" -f server/db/schema/012_pin_tags.sql
   psql "$DB" -f server/db/schema/013_pin_resources.sql
   psql "$DB" -f server/db/schema/014_top_pins.sql
   psql "$DB" -f server/db/schema/015_notifications.sql
   psql "$DB" -f server/db/schema/016_user_preferences.sql
   psql "$DB" -f server/db/schema/017_notifications_display_text.sql
   ```

   > **If upgrading an existing database**: Migration 009 drops old legacy tables (country_visits, city_visits, etc.). This is safe — the new app doesn't use them.

9. **Your backend URL** will be: `https://travel-together-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

The `vercel.json` at the repo root already configures the build correctly.

1. **Go to**: https://vercel.com → Sign up/login with GitHub

2. **Add New Project** → Import `pjloury/travel-together`

3. **Configure** (leave root directory as `/` — vercel.json handles it):
   | Setting | Value |
   |---------|-------|
   | Framework Preset | Vite |
   | Build Command | `cd client && npm install && npm run build` |
   | Output Directory | `client/dist` |

4. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://travel-together-api.onrender.com/api` |

5. **Deploy**

6. **Copy your Vercel URL** (e.g., `https://travel-together.vercel.app`)

---

## Step 4: Update CORS (Backend)

1. Go to Render → your Web Service → Environment

2. Update `FRONTEND_URL` to your actual Vercel URL:
   ```
   FRONTEND_URL=https://travel-together.vercel.app
   ```

3. Render will auto-redeploy.

---

## Step 5: Google OAuth Setup

The app uses Google Sign-In. You need to configure your Google OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials

2. Open your OAuth 2.0 Client ID (or create one)

3. Add **Authorized JavaScript origins**:
   ```
   https://travel-together.vercel.app
   http://localhost:5173
   ```

4. Add **Authorized redirect URIs**:
   ```
   https://travel-together.vercel.app
   http://localhost:5173
   ```

5. Copy the Client ID → set as `GOOGLE_CLIENT_ID` in Render env vars

---

## Step 6: Test Production

1. Open your Vercel URL
2. Sign in with Google
3. Record a voice memory (tap the mic button on the PAST tab)
4. Add a dream destination (tap the + button on the FUTURE tab)
5. Everything should work!

---

## Environment Variables Summary

### Backend (Render)
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (from Render) | ✅ |
| `JWT_SECRET` | Random 64-char hex string | ✅ |
| `FRONTEND_URL` | Your Vercel URL | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `ANTHROPIC_API_KEY` | Claude AI — memory/dream structuring + location | ✅ |
| `OPENAI_API_KEY` | Whisper — voice transcription | ✅ |
| `UNSPLASH_ACCESS_KEY` | Dream pin imagery | ✅ |
| `PORT` | Auto-set by Render | auto |

### Frontend (Vercel)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Render backend URL + `/api` | ✅ |

---

## Important: Render Free Tier

⚠️ Render's free tier **spins down after 15 minutes of inactivity**. First request after sleep takes ~30 seconds.

Options:
- Upgrade to Starter ($7/mo) for always-on
- Or ping `/health` every 14 minutes with a cron job (UptimeRobot free tier works)

---

## Troubleshooting

### "Could not record" / Voice not working
- Check `OPENAI_API_KEY` is set correctly in Render env vars
- Check Render logs for `whisper` errors

### Dream images not appearing
- Check `UNSPLASH_ACCESS_KEY` is set in Render
- Unsplash free tier: 50 requests/hour (sufficient for development)

### "Could not organize automatically" after recording
- Check `ANTHROPIC_API_KEY` is set in Render
- Check Render logs for Claude API errors

### Google Sign-In fails
- Check `GOOGLE_CLIENT_ID` matches exactly between Google Console and Render
- Ensure your Vercel URL is in Google's "Authorized JavaScript origins"

### CORS Errors
- Ensure `FRONTEND_URL` exactly matches your Vercel domain (no trailing slash, include `https://`)

### "Service Unavailable" on first load
- Render free tier is waking up — wait 30 seconds

### Database Connection Errors
- Make sure you used "External Database URL" (not Internal)
- SSL is required — the server already handles this automatically
