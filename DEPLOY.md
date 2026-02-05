# Deployment Guide

This guide covers deploying Travel Together to production.

## Architecture

- **Frontend**: Vercel (React/Vite)
- **Backend**: Railway (Node.js/Express)
- **Database**: Railway PostgreSQL (included with Railway)

---

## Step 1: Push to GitHub

```bash
# If not already a git repo with remote
git remote add origin https://github.com/YOUR_USERNAME/travel-together.git
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign up/login with GitHub

2. Click "New Project" → "Deploy from GitHub repo"

3. Select your `travel-together` repository

4. Railway will auto-detect the Node.js app. Configure:
   - **Root Directory**: `server`
   - Click "Deploy"

5. **Add PostgreSQL**:
   - In your project, click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

6. **Set Environment Variables** (click on your service → Variables):
   ```
   JWT_SECRET=generate-a-random-64-char-string
   FRONTEND_URL=https://your-app.vercel.app (set after Vercel deploy)
   ```

7. **Run Database Schema**:
   - Click on PostgreSQL service → "Connect" → copy connection string
   - Run locally:
   ```bash
   # Replace with your Railway connection string
   psql "postgresql://..." < server/db/schema/001_users.sql
   psql "postgresql://..." < server/db/schema/002_country_visits.sql
   psql "postgresql://..." < server/db/schema/003_city_visits.sql
   psql "postgresql://..." < server/db/schema/004_country_wishlist.sql
   psql "postgresql://..." < server/db/schema/005_friendships.sql
   psql "postgresql://..." < server/db/schema/006_password_reset.sql
   ```

8. **Get your backend URL**: 
   - Click on your service → "Settings" → "Domains"
   - Generate a domain (e.g., `travel-together-api.up.railway.app`)

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login with GitHub

2. Click "Add New..." → "Project"

3. Import your `travel-together` repository

4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Set Environment Variables**:
   ```
   VITE_API_URL=https://your-railway-backend-url.up.railway.app/api
   ```

6. Click "Deploy"

7. **Copy your Vercel URL** (e.g., `travel-together.vercel.app`)

---

## Step 4: Update CORS

1. Go back to Railway → your backend service → Variables

2. Update `FRONTEND_URL` to your Vercel URL:
   ```
   FRONTEND_URL=https://travel-together.vercel.app
   ```

3. Railway will auto-redeploy

---

## Step 5: Test Production

1. Open your Vercel URL
2. Register a new account
3. Add some travel data
4. Everything should work!

---

## Environment Variables Summary

### Backend (Railway)
| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Auto-set by Railway PostgreSQL |
| `JWT_SECRET` | `random-64-character-string` |
| `FRONTEND_URL` | `https://travel-together.vercel.app` |
| `PORT` | Auto-set by Railway |

### Frontend (Vercel)
| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://travel-together-api.up.railway.app/api` |

---

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` in Railway matches your exact Vercel domain

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly in Railway
- Check Railway PostgreSQL is running

### Build Failures
- Check Railway/Vercel logs for specific errors
- Ensure all dependencies are in package.json

---

## Alternative: Render.com

If you prefer Render over Railway:

1. Go to [render.com](https://render.com) and connect GitHub
2. Create a "Web Service" pointing to `server` directory
3. Create a "PostgreSQL" database
4. Set same environment variables
5. Render provides free tier (spins down after inactivity)

