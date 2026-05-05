# 12 New Advanced Lead Generation Tools

This document details 12 additional lead generation tools added to the leads_generator app. Combined with the original 20 methods, the app now supports 32 proven lead generation channels.

## API Endpoints Overview

### 1. CSV Import & Deduplication
**Endpoint:** `POST /api/import-csv`

Import bulk leads from CSV with automatic deduplication by email and business type.

**Request:**
```json
{
  "csvData": [
    {
      "name": "John Smith",
      "email": "john@acme.com",
      "phone": "+1-555-0123",
      "business_type": "SaaS",
      "website": "https://acme.com",
      "city": "San Francisco",
      "state": "CA",
      "country": "US"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 48,
  "deduplicated": 2
}
```

---

### 2. Domain Enrichment (Hunter.io)
**Endpoint:** `POST /api/enrich-domain`

Extract all verified emails from a company domain using Hunter.io.

**Request:**
```json
{
  "domain": "techcompany.com",
  "company_name": "Tech Company Inc",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "found": 127,
  "imported": 47
}
```

Use case: Extract entire team contact lists for targeted outreach.

---

### 3. Intent Data Discovery
**Endpoint:** `POST /api/intent-data`

Generate leads showing buying intent signals (job changes, funding, expansion).

**Request:**
```json
{
  "keywords": ["job promotion", "series b funding", "expansion"],
  "days": 7
}
```

**Response:**
```json
{
  "success": true,
  "found": 15,
  "imported": 12,
  "keywords_processed": 3
}
```

Use case: Find high-intent prospects likely to purchase soon.

---

### 4. Company News Monitor
**Endpoint:** `POST /api/company-news`

Track news events (funding, hiring, partnerships) and identify relevant contacts.

**Request:**
```json
{
  "company_names": ["Stripe", "Shopify", "Notion"],
  "news_types": ["funding", "hiring", "expansion", "partnership"]
}
```

**Response:**
```json
{
  "success": true,
  "news_found": 8,
  "leads_imported": 8,
  "companies_monitored": 3
}
```

Use case: Identify decision-makers when target companies announce growth.

---

### 5. Social Media Discovery
**Endpoint:** `POST /api/social-discovery`

Find leads active on Twitter, LinkedIn, Reddit discussing your keywords.

**Request:**
```json
{
  "keywords": ["marketing automation", "sales tools"],
  "platform": "twitter",
  "min_followers": 500
}
```

**Response:**
```json
{
  "success": true,
  "profiles_found": 18,
  "leads_imported": 15,
  "platform": "twitter",
  "keywords_searched": 2
}
```

Supported platforms: `twitter`, `linkedin`, `reddit`

---

### 6. Referral Program Management
**Endpoint:** `POST /api/referral-leads`

Launch an incentivized referral program to get leads from your network.

**Request:**
```json
{
  "referral_emails": ["alice@company.com", "bob@startup.com"],
  "incentive_type": "credit",
  "incentive_value": 100
}
```

**Response:**
```json
{
  "success": true,
  "invites_sent": 2
}
```

Incentive types: `credit`, `discount`, `feature_unlock`

**Get Referral Stats:**
```
GET /api/referral-leads
```

---

### 7. Competitor Lead Extraction
**Endpoint:** `POST /api/competitor-analysis`

Extract verified leads from competitor companies.

**Request:**
```json
{
  "competitor_domains": ["stripe.com", "square.com"],
  "num_leads": 20
}
```

**Response:**
```json
{
  "success": true,
  "competitors_analyzed": 2,
  "leads_found": 35,
  "leads_imported": 35
}
```

Use case: Target competitors' customers who may want alternatives.

---

### 8. Webinar & Event Registration Capture
**Endpoint:** `POST /api/event-capture`

Import registrants from webinars, conferences, and virtual events.

**Request:**
```json
{
  "event_name": "SaaS Growth Conference 2026",
  "event_type": "conference",
  "event_date": "2026-05-15",
  "registrants": [
    {
      "name": "Jane Doe",
      "email": "jane@company.com",
      "company_type": "B2B SaaS",
      "company_website": "https://company.com",
      "city": "New York",
      "state": "NY",
      "country": "US"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "event": "SaaS Growth Conference 2026",
  "leads_imported": 287,
  "duplicates_skipped": 3
}
```

Event types: `webinar`, `workshop`, `conference`, `meetup`, `summit`

**Get Event History:**
```
GET /api/event-capture
```

---

### 9. Email Enrichment
**Endpoint:** `POST /api/email-enrichment`

Validate and enrich individual emails with company, role, seniority data.

**Request:**
```json
{
  "emails": ["john.smith@techcorp.com", "alice@startup.io"]
}
```

**Response:**
```json
{
  "success": true,
  "enriched": 2,
  "valid_leads": 2,
  "imported": 2
}
```

Extracts: First name, last name, company, position, seniority level, domain, confidence score.

---

### 10. AI-Powered Lead Ranking
**Endpoint:** `POST /api/ai-ranking`

Rank leads by conversion likelihood, deal size, or engagement potential.

**Request:**
```json
{
  "lead_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "ranking_criteria": "conversion_likelihood"
}
```

**Response:**
```json
{
  "success": true,
  "criteria": "conversion_likelihood",
  "leads_ranked": 3,
  "rankings": [
    {
      "id": "uuid-1",
      "name": "John Smith",
      "score": 92,
      "source": "intent_data"
    },
    {
      "id": "uuid-2",
      "name": "Jane Doe",
      "score": 78
    }
  ]
}
```

Ranking criteria:
- `conversion_likelihood` - Predicted probability of closing
- `engagement_potential` - Likelihood to respond to outreach
- `deal_size` - Estimated contract value
- `budget_capacity` - Company's ability to afford your solution

---

### 11. Bulk Outreach Engine
**Endpoint:** `POST /api/bulk-outreach`

Queue leads for multi-channel outreach with rate-limiting.

**Request:**
```json
{
  "lead_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "channel": "email",
  "template_id": "tmpl-uuid",
  "delay_ms": 1000,
  "tag_for_tracking": "bulk-q1-2026"
}
```

**Response:**
```json
{
  "success": true,
  "batch_id": "batch-uuid",
  "channel": "email",
  "leads_queued": 150,
  "status": "processing"
}
```

Channels: `email`, `sms`, `whatsapp`, `sequence_enrollment`

---

### 12. Lead List Builder with Advanced Filtering
**Endpoint:** `POST /api/lead-list-builder`

Build dynamic lead segments with complex filtering rules.

**Request:**
```json
{
  "list_name": "High-Intent B2B SaaS Dec 2026",
  "filters": {
    "source": ["intent_data", "company_news", "linkedin"],
    "score_min": 70,
    "score_max": 100,
    "business_type": ["SaaS", "B2B"],
    "country": "US",
    "tags": ["signal-link_click", "urgency-8"]
  },
  "limit": 500
}
```

**Response:**
```json
{
  "success": true,
  "list_name": "High-Intent B2B SaaS Dec 2026",
  "leads_found": 243,
  "saved_list_id": "list-uuid",
  "sample_leads": [...]
}
```

**Retrieve Saved Lists:**
```
GET /api/lead-list-builder
```

---

## Bonus: Intent Signal Tracking

**Endpoint:** `POST /api/intent-signals`

Track behavioral signals (email opens, link clicks, page views) to identify hot leads.

**Record Signal:**
```json
{
  "lead_id": "uuid",
  "signal_type": "email_open",
  "signal_data": { "email_id": "123", "campaign": "q1_2026" }
}
```

**Get Lead Signals:**
```
GET /api/intent-signals?lead_id=uuid
```

**Response:**
```json
{
  "signal_count": 12,
  "engagement_score": 78,
  "signals": [
    { "signal_type": "email_open", "timestamp": "2026-05-05T10:00:00Z" },
    { "signal_type": "link_click", "timestamp": "2026-05-05T10:05:00Z" }
  ]
}
```

Signal weights (impact on lead score):
- Page view: +3
- Website visit: +5
- Email open: +10
- Link click: +15
- Content download: +20
- Form submission: +25

---

## Database Schema Updates

**New Tables (Migration 003):**
- `referral_leads` - Referral program tracking
- `events` - Webinar/event registration logs
- `outreach_batches` - Bulk outreach batch records
- `outreach_tasks` - Individual outreach tasks queue
- `saved_lists` - Saved lead segment definitions
- `lead_intent_signals` - Behavioral signal history
- `api_usage` - Usage tracking for quota management

All tables include RLS (Row-Level Security) scoped to `owner_email`.

---

## Integration Examples

### Complete Lead Generation Pipeline

```bash
# 1. Extract competitors' customers
curl -X POST http://localhost:3400/api/competitor-analysis \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"competitor_domains": ["stripe.com"]}'

# 2. Enrich extracted emails
curl -X POST http://localhost:3400/api/email-enrichment \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"emails": ["john@company.com"]}'

# 3. Rank leads by conversion likelihood
curl -X POST http://localhost:3400/api/ai-ranking \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lead_ids": ["uuid-1", "uuid-2"], "ranking_criteria": "conversion_likelihood"}'

# 4. Build high-intent segment
curl -X POST http://localhost:3400/api/lead-list-builder \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"list_name": "High-Intent Prospects", "filters": {"score_min": 75}}'

# 5. Queue bulk outreach
curl -X POST http://localhost:3400/api/bulk-outreach \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lead_ids": ["uuid-1"], "channel": "email", "template_id": "tmpl-uuid"}'
```

---

## Activation Checklist

- [ ] Apply Migration 003 to Supabase
- [ ] Configure Hunter.io API key in `.env.local`
- [ ] Configure Crunchbase/G2/Capterra APIs for intent data (optional)
- [ ] Set up external cron for `/api/scheduler/sequences` (if using sequences)
- [ ] Test email/SMS/WhatsApp channels with real credentials
- [ ] Build UI pages for new tools in `pages/` (optional)
- [ ] Configure rate limits for external APIs
- [ ] Set up monitoring for API quota usage

---

## Total Lead Generation Methods

**Original 20:** Scoring, Email, SMS, WhatsApp, Sequences, Google Places, Forms, Webhooks, LinkedIn, AI Messages, CRM Sync, Analytics, Templates, Automation

**New 12:** CSV Import, Domain Enrichment, Intent Data, Company News, Social Discovery, Referral Program, Competitor Analysis, Event Capture, Email Enrichment, AI Ranking, Bulk Outreach, Lead List Builder

**Bonus:** Intent Signal Tracking

**Grand Total: 33 lead generation methods** 🚀
