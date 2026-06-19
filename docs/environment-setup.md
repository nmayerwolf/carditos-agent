# Environment Setup — Carditos

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- GitHub account (private repo access)

## Accounts & Keys

### 1. Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create project (Hobby tier)
3. Save: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
4. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 2. OpenAI API

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Save: `OPENAI_API_KEY`

### 3. Anthropic Claude API

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Save: `ANTHROPIC_API_KEY`

### 4. Kapso (WhatsApp Gateway)

1. Contact Kapso or use Meta API directly
2. Get: `KAPSO_API_URL`, `KAPSO_API_KEY`, `KAPSO_WEBHOOK_SECRET`
3. Set webhook URL in Kapso dashboard: `https://<your-backend>/webhooks/whatsapp`

### 5. Sentry

1. Go to [sentry.io](https://sentry.io)
2. Create project (Node.js)
3. Save: `SENTRY_DSN`

### 6. Railway

1. Create account at [railway.app](https://railway.app)
2. Link GitHub repo
3. Set env vars in Railway dashboard

## .env.example

```bash
# Supabase
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Kapso / WhatsApp
KAPSO_API_URL=https://api.kapso.ai/meta/whatsapp/v24.0
KAPSO_API_KEY=...
KAPSO_WEBHOOK_SECRET=...
KAPSO_PHONE_NUMBER_ID=...

# Sentry
SENTRY_DSN=https://...@sentry.io/...

# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Corpus
CORPUS_INGEST_ENABLED=false
```

## Local Development

### 1. Clone & Install

```bash
git clone https://github.com/nmayerwolf/carditos-agent.git
cd carditos-agent
npm install
```

### 2. Copy .env

```bash
cp .env.example .env.local
# edit .env.local with your keys
```

### 3. Run migrations

```bash
npm run db:migrate
```

### 4. Start dev server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### 5. Test webhook locally (optional)

Use [ngrok](https://ngrok.com) to expose local port:
```bash
ngrok http 3000
# set Kapso webhook URL to ngrok URL + /webhooks/whatsapp
```

## Deployment (Railway)

### 1. Connect repo

In Railway, link GitHub repo `nmayerwolf/carditos-agent`

### 2. Set env vars

Add all keys from `.env` to Railway environment

### 3. Deploy

Railway auto-deploys on `main` push

### 4. Verify

```bash
curl https://<railway-app>.up.railway.app/api/health
```

## Testing Accounts

### Coaches (for QA)

Phone numbers to test (internal, not real):
- Coach A: `+5491112345678`
- Coach B: `+5491187654321`

Add to `users` table with role `coach_infantil` or `coach_juvenil`

## Secrets Management

- **Never** commit `.env` or `.env.local`
- **Never** commit corpus documents without founder approval
- Use `.gitignore` to exclude:
  ```
  .env
  .env.local
  .env.*.local
  content/rugby-knowledge/
  *.log
  ```

