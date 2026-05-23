# XP — Deployment Guide

**Live URLs:**
- Frontend: https://xp-monorepo-web.vercel.app
- API: https://xp-monorepo.onrender.com
- GraphQL Playground: https://xp-monorepo.onrender.com/graphql

---

## Architecture

```
User
 │
 ▼
Vercel CDN (global edge)
 │  Static SPA (React + Vite)
 │  Env: VITE_API_URL → Render API
 │
 ▼
Render (Washington, D.C. — free tier)
 │  Docker container (Node.js 22)
 │  NestJS + Apollo Server + GraphQL
 │  Env: MONGO_URI, PORT, NODE_ENV
 │
 ▼
MongoDB Atlas (M0 free tier)
 │  Single cluster, single collection (nodes)
 │  IP whitelist: 0.0.0.0/0 (required for Render dynamic IPs)
```

---

## Render (API)

### Service Configuration
| Setting | Value |
|---------|-------|
| Name | `xp-monorepo` |
| Type | Web Service |
| Runtime | Docker |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Context | `.` (repo root) |
| Instance Type | Free |
| Region | Washington, D.C. (default) |
| Branch | `main` |
| Auto-Deploy | Yes (on push) |

### Environment Variables
| Variable | Value |
|----------|-------|
| `MONGO_URI` | `mongodb+srv://...` (Atlas connection string) |
| `PORT` | `10000` |
| `NODE_ENV` | `production` |

### Free Tier Behavior
- Service sleeps after **15 minutes** of inactivity
- Cold start takes **~30-50 seconds** (Docker container spin-up + MongoDB connection)
- No persistent disk — GCal OAuth tokens are lost on restart (stored in-memory)
- 750 hours/month free (enough for one service running 24/7)

### Dockerfile Details
Multi-stage build for minimal production image:
```
Stage 1 (build):
  - npm ci (all workspaces)
  - Build @xp/shared (tsc)
  - Build API (nest build)

Stage 2 (prod):
  - npm ci --omit=dev
  - Copy shared/dist + api/dist from Stage 1
  - node apps/api/dist/main.js
```

---

## Vercel (Frontend)

### Project Configuration
| Setting | Value |
|---------|-------|
| Framework | Vite (auto-detected) |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && npm ci && npm run build -w web` |
| Output Directory | `dist` |
| Node.js Version | 22.x |

### Environment Variables
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://xp-monorepo.onrender.com` (no trailing slash) |

### Notes
- Auto-deploys on every push to `main`
- Preview deployments on PRs
- The build command navigates to monorepo root because `npm ci` needs the workspace `package.json`
- `VITE_API_URL` is baked into the JS bundle at build time (not runtime)

---

## MongoDB Atlas

### Cluster
| Setting | Value |
|---------|-------|
| Tier | M0 (free, 512MB storage) |
| Provider | AWS |
| Collection | `nodes` (single collection) |

### Network Access
- **IP whitelist:** `0.0.0.0/0` (allow from anywhere)
- Required because Render free tier uses dynamic IPs
- Security relies on database credentials (username/password in connection string) + TLS

### Connection String Format
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

---

## Deployment Issues Encountered (Log)

### 1. `@xp/shared` module not found in Docker
**Symptom:** `TS2307: Cannot find module '@xp/shared'`
**Cause:** `packages/shared/dist/` is gitignored. Docker had the source but never compiled it.
**Fix:** Added `npm run build --workspace=@xp/shared` to Dockerfile build stage. Changed `npm ci --workspace=api` to `npm ci` (all workspaces) to ensure TypeScript is available. Copy `packages/shared/dist` into prod stage.
**Commit:** `b9e74a8`

### 2. TypeScript errors blocking frontend build
**Symptom:** 26 TypeScript errors (unused imports, untyped mutation returns)
**Cause:** `tsc -b` ran before `vite build` as part of the build script. Locally these were non-blocking because dev mode doesn't type-check.
**Fix:** Changed build script from `tsc -b && vite build` to `vite build`. Vite uses esbuild for transpilation — tsc was only a type checker.
**Trade-off:** Type errors are now silent during build. Should add `tsc --noEmit` as a separate CI check.
**Commit:** `331d508`

### 3. Double-slash in API URL
**Symptom:** `xp-monorepo.onrender.com//graphql` → 404
**Cause:** `VITE_API_URL` set with trailing slash in Vercel env. Code concatenated `${url}/graphql`.
**Fix:** Added `.replace(/\/+$/, '')` to strip trailing slashes from env var.
**Commit:** `07c0fe2`

### 4. MongoDB connection refused
**Symptom:** `MongooseServerSelectionError: Could not connect to any servers`
**Cause:** MongoDB Atlas IP whitelist didn't include Render's dynamic IP.
**Fix:** Added `0.0.0.0/0` to Atlas Network Access.

### 5. Render port detection
**Symptom:** `No open ports detected, continuing to scan...`
**Cause:** Dockerfile had `PORT=8080` but Render expects `10000` by default.
**Fix:** Set `PORT=10000` in Render env vars.

---

## Monitoring

### Health Checks
- **API:** `GET /graphql` → should return Apollo Playground HTML (200)
- **Frontend:** Vercel serves `index.html` for all routes (SPA)

### Logs
- **Render:** Dashboard → Logs (real-time streaming)
- **Vercel:** Dashboard → Deployments → Functions (build logs only — no runtime logs for static sites)
- **MongoDB:** Atlas → Monitoring → Metrics

### Known Limitations
- No error tracking (no Sentry/Datadog)
- No uptime monitoring
- GCal OAuth tokens lost on Render restart
- No database backups configured (Atlas M0 has no automated backups)
- No rate limiting on API
- GraphQL Playground exposed in production
