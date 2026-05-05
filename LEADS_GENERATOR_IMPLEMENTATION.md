# Leads Generator — Full Implementation Plan

> **Companion product to ai-client-recovery.**
> While ai-client-recovery recovers dormant clients, leads-generator finds *new* clients for service businesses.

---

## Status Overview

| Step | Title | Status |
|------|-------|--------|
| 1 | Project Setup & Supabase Schema | ✅ Done |
| 2 | Lead Import (CSV + Manual) | ✅ Done |
| 3 | AI Lead Scoring & Qualification | ✅ Done |
| 4 | AI Outreach Message Generation | ✅ Done |
| 5 | Email Outreach Integration | ✅ Done |
| 6 | WhatsApp Outreach Integration | ✅ Done |
| **7** | **Build & Production Deploy** | 🔨 In Progress |
| **8A** | **Automated Lead Discovery (Google Places)** | ⏳ Next |
| **8B** | **Lead Magnet & Inbound Form Capture** | ⏳ Next |

---

## Step 7 — Build & Production Deploy

### What This Step Covers
- Run a clean production build and fix any compile errors
- Configure PM2 process manager for leads-generator (port 3400)
- Create nginx virtual host pointing to port 3400
- Issue SSL certificate with Certbot
- Write a reusable deploy script

### Sub-steps & Copilot Requests

#### 7.1 — Clean Production Build

**Copilot request:**
```
Run `npm run build` in the leads-generator directory.
Show me every TypeScript/ESLint error that appears.
For each error explain the cause and provide the exact fix.
Do not modify working logic — only fix compile/lint issues.
```

**What to do manually:**
```bash
cd leads-generator
npm install
npm run build
```
Expected: zero errors, static HTML output in `.next/`.

---

#### 7.2 — PM2 Ecosystem Config

**Copilot request:**
```
Create `deploy/ecosystem.config.js` for PM2 that:
- app name: "leads-generator"
- runs `npm start` in the repo root
- sets PORT=3400 in env
- sets NODE_ENV=production
- restarts on crash with max_restarts: 5
- writes logs to /var/log/leads-generator/out.log and error.log
```

**Expected file:** `deploy/ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'leads-generator',
    script: 'node_modules/.bin/next',
    args: 'start -p 3400',
    env: { NODE_ENV: 'production', PORT: 3400 },
    max_restarts: 5,
    error_file: '/var/log/leads-generator/error.log',
    out_file: '/var/log/leads-generator/out.log',
  }]
};
```

---

#### 7.3 — Nginx Virtual Host

**Copilot request:**
```
Create `deploy/nginx-leads-generator.conf` — an nginx server block that:
- listens on port 80 and redirects to HTTPS
- listens on port 443 with SSL placeholders for Certbot
- proxies all traffic to http://127.0.0.1:3400
- sets proxy headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
- sets client_max_body_size 10M
- server_name: leads-generator.yourdomain.com
Replace yourdomain.com with the actual domain variable at the top of the file.
```

---

#### 7.4 — Deploy Script

**Copilot request:**
```
Create `deploy/deploy.sh` — a bash deploy script (safe, idempotent) that:
1. Checks for Node.js 20, installs via NodeSource if missing
2. Checks for PM2, installs globally if missing
3. Clones repo to /var/www/leads-generator if not present, else git pull
4. Runs `npm ci --omit=dev`
5. Checks .env.local exists, exits with instructions if missing
6. Runs `npm run build`
7. Creates nginx config at /etc/nginx/sites-available/leads-generator.conf (skip if exists)
8. Symlinks to sites-enabled (skip if exists)
9. Issues SSL cert with certbot --nginx (skip if cert already exists)
10. Reloads nginx with `nginx -t && systemctl reload nginx`
11. Starts or reloads PM2 app using deploy/ecosystem.config.js
12. Saves PM2 and enables startup
Use DOMAIN variable at top of script. Never touch other nginx sites.
```

---

#### 7.5 — Vercel / Render Alternative Deploy

**Copilot request (Option — cloud deploy instead of VPS):**
```
Create `render.yaml` for Render.com deployment of leads-generator:
- service type: web
- runtime: node
- build command: npm ci && npm run build
- start command: npm start
- port: 3400
- envVars: list all keys from .env.example as sync vars
Create `vercel.json` for Vercel deployment:
- framework: nextjs
- set NEXT_PUBLIC_APP_BASE to the Vercel production URL
```

---

#### 7.6 — Health Check Script

**Copilot request:**
```
Create `scripts/smoke-leads.mjs` — a Node ESM smoke test that:
- GETs /api/health (create that endpoint too) and asserts 200 + { status: 'ok' }
- GETs /api/leads (unauthenticated) and asserts 401
- POSTs /api/leads with invalid body and asserts 400
- Prints PASS / FAIL for each check
- Uses fetch (Node 18+), no extra dependencies
```

---

### Step 7 Completion Checklist

- [ ] `npm run build` exits 0
- [ ] `deploy/ecosystem.config.js` created
- [ ] `deploy/nginx-leads-generator.conf` created
- [ ] `deploy/deploy.sh` created and executable
- [ ] `scripts/smoke-leads.mjs` passes all checks
- [ ] App accessible at https://leads-generator.yourdomain.com (or Render/Vercel URL)

---

## Step 8A — Automated Lead Discovery (Google Places)

### What This Step Covers
- Search for new business leads by type + location via Google Places API
- AI-score each discovered lead (1–100)
- One-click "Add to Pipeline" → saves to Supabase `leads` table
- Generate and send outreach via WhatsApp or Email directly from results

### Copilot Requests

#### 8A.1 — Supabase Migration: `discovered_leads` table

**Copilot request:**
```
Create `supabase/migrations/003_discovered_leads.sql`:
Table: discovered_leads
Columns:
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  owner_email text NOT NULL
  business_name text NOT NULL
  address text
  city text
  country text
  phone text
  website text
  google_place_id text UNIQUE
  google_rating numeric(3,1)
  google_review_count int
  business_type text
  ai_score int CHECK (ai_score BETWEEN 0 AND 100)
  ai_score_reason text
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','rejected'))
  outreach_message text
  last_contacted_at timestamptz
  created_at timestamptz DEFAULT now()

Add RLS: users can only SELECT/INSERT/UPDATE/DELETE their own rows (owner_email = auth.jwt()->>'email').
```

---

#### 8A.2 — Google Places Discovery API Route

**Copilot request:**
```
Create `pages/api/discover-leads.js`:
- Authenticated endpoint (check Supabase JWT from Authorization header)
- Accepts POST body: { businessType: string, city: string, country: string, radius: number (metres, max 50000) }
- Validates all fields, returns 400 on missing/invalid
- Calls Google Places API Text Search:
  GET https://maps.googleapis.com/maps/api/place/textsearch/json
  ?query={businessType}+in+{city}+{country}
  &radius={radius}
  &key={GOOGLE_PLACES_API_KEY}
- For each place result, also fetches place details (phone, website) via Place Details API
- Returns max 20 results shaped as:
  { business_name, address, city, country, phone, website, google_place_id, google_rating, google_review_count, business_type }
- Returns 200 with { leads: [...] }
- Never store to DB — that happens client-side on "Add to Pipeline"
- Rate limit: max 3 requests per minute per user (use in-memory Map, keyed by owner_email)
```

---

#### 8A.3 — AI Lead Scoring API Route

**Copilot request:**
```
Create `pages/api/score-lead.js`:
- Authenticated endpoint
- Accepts POST: { business_name, business_type, city, country, google_rating, google_review_count, website }
- Builds a prompt:
  "Score this business as a sales lead from 1 to 100 for a service business outreach campaign.
   Business: {business_name}, Type: {business_type}, Location: {city} {country},
   Google Rating: {google_rating} ({google_review_count} reviews), Website: {website || 'none'}.
   Reply ONLY with JSON: { score: number, reason: string (max 20 words) }"
- Calls OpenRouter (model: mistralai/mistral-7b-instruct) with 10s timeout
- Parses JSON from response; if parse fails return score: 50, reason: 'AI scoring unavailable'
- Returns 200 with { score, reason }
```

---

#### 8A.4 — Lead Discovery Page

**Copilot request:**
```
Create `pages/discover-leads.js` — a Next.js page (authenticated, redirect to / if no session):
Layout:
  - Header: "Discover New Leads"
  - Search form: Business Type (text), City (text), Country (text), Radius km (select: 5/10/25/50)
  - "Search" button → calls POST /api/discover-leads
  - Results grid: one card per lead showing:
      business_name, address, phone (if available), google_rating ⭐, review count
      AI Score badge (colour: red <40, yellow 40–70, green >70) — fetched from /api/score-lead per card
      Buttons: "Add to Pipeline" | "Generate Message" | "WhatsApp" | "Email"
  - "Add to Pipeline" → POST /api/leads with the lead data → shows toast "Added"
  - "Generate Message" → POST /api/generate-message (reuse existing endpoint) → shows message inline
  - Loading skeletons while search or scoring is in progress
  - Empty state: "No leads found. Try a broader radius or different business type."
Use styled-jsx for all styles. No external CSS libraries.
```

---

#### 8A.5 — Add Discovered Lead to Pipeline

**Copilot request:**
```
Update `pages/api/leads.js` to handle POST body from discover-leads page:
- Accept optional fields: google_place_id, google_rating, google_review_count, ai_score, ai_score_reason, source ('discovery' | 'manual' | 'csv')
- Store source in the leads table (add column if not present via ALTER TABLE in migration 003)
- Return 409 if google_place_id already exists for this owner_email (duplicate guard)
```

---

### Step 8A Completion Checklist

- [ ] Migration `003_discovered_leads.sql` applied to Supabase
- [ ] `GET /api/discover-leads` returns Google Places results
- [ ] `GET /api/score-lead` returns 1–100 score + reason
- [ ] `pages/discover-leads.js` renders, search works, cards show scores
- [ ] "Add to Pipeline" saves lead with source='discovery', duplicate guard works
- [ ] "Generate Message" + "WhatsApp"/"Email" buttons work end-to-end

---

## Step 8B — Lead Magnet & Inbound Form Capture

### What This Step Covers
- Public-facing landing page with a lead capture form (no login required)
- Webhook endpoint for Typeform / JotForm / Contact Form 7
- All captured leads land in the same `leads` pipeline
- Auto-generate a welcome AI message on new inbound lead arrival
- Leads inbox page showing inbound leads by status

### Copilot Requests

#### 8B.1 — Public Lead Capture Landing Page

**Copilot request:**
```
Create `pages/capture.js` — a public page (no auth required):
- Title: "Get a Free Business Growth Plan" (editable via env: NEXT_PUBLIC_CAPTURE_HEADLINE)
- Form fields: Full Name*, Business Email*, Phone (optional), Business Type*, City*
- Submit → POST /api/capture-lead
- On success: show "Thank you! We'll be in touch within 24 hours." and hide form
- On error: show inline error message
- Page is fully styled with styled-jsx, mobile-responsive
- No navigation header — standalone landing page
- Add meta tags: og:title, og:description, og:image (from NEXT_PUBLIC_CAPTURE_OG_IMAGE env)
```

---

#### 8B.2 — Capture Lead API Route

**Copilot request:**
```
Create `pages/api/capture-lead.js`:
- Public endpoint (no auth required — but rate limit: 5 submissions per IP per hour using in-memory Map)
- Accepts POST: { name, email, phone, business_type, city }
- Validates: name (min 2 chars), email (valid format), business_type (min 2 chars), city (min 2 chars)
- Inserts into Supabase `leads` table using SERVICE_ROLE_KEY (bypass RLS):
    { name, email, phone, business_type, city, source: 'inbound', status: 'new', owner_email: NEXT_PUBLIC_CAPTURE_OWNER_EMAIL }
- After insert, calls /api/generate-message internally to create a welcome message (fire-and-forget, don't await)
- Returns 200 { success: true } or 400 { error: string } or 429 { error: 'Too many requests' }
- Logs each submission to console with timestamp and email (no PII beyond that)
```

---

#### 8B.3 — Typeform Webhook

**Copilot request:**
```
Create `pages/api/webhooks/typeform.js`:
- Accepts POST from Typeform webhooks
- Validates TYPEFORM_WEBHOOK_SECRET from env against X-Typeform-Signature header (HMAC-SHA256)
- Parses Typeform payload: extracts answers by field ref (name, email, phone, business_type, city)
- Upserts into Supabase leads table (upsert on email to avoid duplicates)
- source: 'typeform'
- Returns 200 { received: true } always (Typeform retries on non-200)
- Add TYPEFORM_WEBHOOK_SECRET to .env.example
```

---

#### 8B.4 — JotForm Webhook

**Copilot request:**
```
Create `pages/api/webhooks/jotform.js`:
- Accepts POST from JotForm form submission webhooks (application/x-www-form-urlencoded)
- No signature verification (JotForm doesn't support it — document this limitation in a comment)
- Parses JotForm fields: q3_fullName → name, q4_email → email, q5_phone → phone, q6_businessType → business_type, q7_city → city
- Field numbers are configurable via env: JOTFORM_FIELD_NAME, JOTFORM_FIELD_EMAIL, etc.
- Upserts into leads table, source: 'jotform'
- Returns 200 always
```

---

#### 8B.5 — Leads Inbox Page

**Copilot request:**
```
Create `pages/leads-inbox.js` — authenticated page:
- Shows all leads for the current user sorted by created_at DESC
- Filter tabs: All | New | Contacted | Qualified | Converted | Rejected
- Each lead card shows: name, email, phone, business_type, city, source badge (inbound/typeform/jotform/discovery/manual/csv), status badge, created_at
- Inline action buttons per card:
    "Generate Message" → POST /api/generate-message → show message below card
    "Send WhatsApp" → opens wa.me/{phone}?text={encodeURIComponent(message)}
    "Send Email" → POST /api/send-ai-message
    Status dropdown → PATCH /api/leads/{id} to update status
- Pagination: 20 per page with Prev/Next buttons
- Export button: downloads visible leads as CSV
- Use styled-jsx. No external CSS libs.
```

---

#### 8B.6 — Update Leads API for Status PATCH

**Copilot request:**
```
Update `pages/api/leads/[id].js` (create if not exists):
- GET /api/leads/[id] → return single lead for authenticated user
- PATCH /api/leads/[id] → update status field only (whitelist: new/contacted/qualified/converted/rejected)
- DELETE /api/leads/[id] → soft-delete (set deleted_at = now())
- All operations scoped to owner_email from JWT — never allow cross-user access
- Return 404 if lead not found for this user
```

---

### Step 8B Completion Checklist

- [ ] `/capture` landing page renders, form submits, success message shows
- [ ] `POST /api/capture-lead` inserts lead + triggers welcome message
- [ ] Typeform webhook validates signature and upserts lead
- [ ] JotForm webhook parses fields and upserts lead
- [ ] `/leads-inbox` shows all leads with filters, status update, generate+send flow
- [ ] `PATCH /api/leads/[id]` updates status correctly
- [ ] Rate limiting blocks >5 submissions/hour/IP on capture endpoint

---

## Git Branch Strategy

All Step 7 + Step 8 work lives on a feature branch:

```bash
# In ai-client-recovery repo — push this plan as a reference branch
git checkout -b feature/leads-generator-plan
git add docs/LEADS_GENERATOR_IMPLEMENTATION.md
git commit -m "docs: add leads-generator Step 7 + Step 8 implementation plan"
git push origin feature/leads-generator-plan
```

The actual code lives in the `leads-generator` standalone repo.

---

## Shared Infrastructure Between Projects

| Resource | ai-client-recovery | leads-generator |
|---|---|---|
| Supabase project | Same (multi-product) | Same |
| WhatsApp sender | Port 3500 | Port 3500 (shared) |
| OpenRouter | Same API key | Same API key |
| nginx | Port 3300 | Port 3400 |
| PM2 | `ai-client-recovery` app | `leads-generator` app |

---

## Next Steps After 8A + 8B

- **Step 9:** Lead nurture drip sequences (auto follow-up on Day 1, 3, 7, 14)
- **Step 10:** A/B message testing — generate 2 variants, track which gets more replies
- **Step 11:** Dashboard analytics — conversion funnel, cost per lead, best-performing channels
