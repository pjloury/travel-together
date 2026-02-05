# Deployment Guide

Deploy Travel Together using **Vercel** (frontend) + **Render** (backend + database).

---

## Step 1: Push to GitHub

```bash
git push origin main
```

---

## Step 2: Deploy Backend to Render

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

7. **Link Database to Web Service**:
   - Go to your Web Service → **Environment**
   - Add environment variable:
     | Key | Value |
     |-----|-------|
     | `DATABASE_URL` | Copy "External Database URL" from your PostgreSQL dashboard |
     | `JWT_SECRET` | Generate with: `openssl rand -hex 32` |
     | `FRONTEND_URL` | `https://travel-together.vercel.app` (set after Vercel deploy) |

8. **Run Database Schema** (one time):
   - Copy your PostgreSQL "External Database URL"
   - Run in your terminal:
   ```bash
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/001_users.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/002_country_visits.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/003_city_visits.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/004_country_wishlist.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/005_friendships.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f server/db/schema/006_password_reset.sql
   ```

9. **Get your backend URL**: 
   - Your service URL will be like: `https://travel-together-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. **Go to**: https://vercel.com → Sign up/login with GitHub

2. **Add New Project** → Import `pjloury/travel-together`

3. **Configure**:
   | Setting | Value |
   |---------|-------|
   | Framework Preset | Vite |
   | Root Directory | `client` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://travel-together-api.onrender.com/api` |

5. **Deploy**

6. **Copy your Vercel URL** (e.g., `https://travel-together.vercel.app`)

---

## Step 4: Update CORS

1. Go to Render → your Web Service → Environment

2. Set/Update:
   ```
   FRONTEND_URL=https://travel-together.vercel.app
   ```

3. Render will auto-redeploy

---

## Step 5: Test Production

1. Open your Vercel URL
2. Register a new account
3. Add travel data
4. Everything should work! 🎉

---

## Environment Variables Summary

### Backend (Render)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (from Render) |
| `JWT_SECRET` | Random 64-char string |
| `FRONTEND_URL` | Your Vercel URL |
| `PORT` | Auto-set by Render |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your Render backend URL + `/api` |

---

## Important: Render Free Tier

⚠️ Render's free tier **spins down after 15 minutes of inactivity**. First request after sleep takes ~30 seconds.

To avoid this:
- Upgrade to paid ($7/mo) for always-on
- Or use a cron job to ping your `/health` endpoint every 14 minutes

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` exactly matches your Vercel domain (include `https://`)

### "Service Unavailable" on first load
- Render free tier is waking up, wait 30 seconds

### Database Connection Errors
- Make sure you used "External Database URL" (not Internal)
- Verify the URL is correctly copied with no extra spaces

### Build Failures
- Check Render logs for specific errors
- Ensure `server/package.json` has all dependencies
