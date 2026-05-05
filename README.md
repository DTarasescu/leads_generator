# Leads Generator

**Find new clients for service businesses — automatically.**

A standalone Next.js platform that discovers, scores, and reaches out to new business leads via AI-generated messages sent through WhatsApp or Email.

Companion product to [ai-client-recovery](https://github.com/DTarasescu/ai-client-recovery).

---

## Features

- **Lead Discovery** — Search Google Places by business type + location; get up to 20 leads per search
- **AI Lead Scoring** — Each lead scored 1–100 by OpenRouter AI with a one-line reason
- **Outreach Generation** — AI writes personalised cold-outreach messages per lead
- **WhatsApp & Email Send** — Send directly from the app
- **Inbound Capture** — Public landing page + Typeform/JotForm webhooks
- **Leads Pipeline** — Status tracking: New → Contacted → Qualified → Converted

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| Database | Supabase (PostgreSQL + RLS) |
| AI | OpenRouter (Mistral 7B, LLaMA 3) |
| Email | Nodemailer (SMTP) |
| WhatsApp | wa.me deep-links + shared WA sender service |
| Styling | CSS-in-JS (styled-jsx) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/DTarasescu/leads_generator.git
cd leads_generator
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 3. Run the database migration

Open the Supabase SQL Editor and run `supabase/migrations/001_initial.sql`.

### 4. Start dev server

```bash
npm run dev
# Runs on http://localhost:3400
```

---

## Implementation Plan

See [LEADS_GENERATOR_IMPLEMENTATION.md](LEADS_GENERATOR_IMPLEMENTATION.md) for the full step-by-step build plan including Copilot request prompts for each feature.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 3400) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run smoke:leads` | Smoke test API endpoints |

---

## Port

This app runs on **port 3400** to avoid conflict with ai-client-recovery (port 3300) and the shared WhatsApp sender (port 3500).
