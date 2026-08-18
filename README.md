# AL ZEINA

Cloudflare Workers (Hono + D1 + R2) backend and Vite React storefront.

## Clean checkout (required)

Do **not** reuse an existing `node_modules` from another machine.

```bash
# Backend
cd backend
npm ci
# or: npm install

# Frontend
cd ../frontend
npm ci
npm run build
```

Local API (D1/R2 bindings from `wrangler.toml`):

```bash
cd backend
cp .env.example .dev.vars   # then set JWT_SECRET locally — never commit .dev.vars
npx wrangler d1 migrations apply al-zeina-db --local
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

## Production secrets (Wrangler)

```bash
cd backend
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY   # only if using Resend for password-reset email
```

Required vars: `JWT_SECRET`, `RESET_LINK_BASE_URL`, `CORS_ORIGINS`, `EMAIL_FROM`.  
Set `EMAIL_PROVIDER=resend` (or `mailchannels`) in production. Password reset tokens are generated even if email is not configured; **outbound email will not reach customers until a provider + `RESEND_API_KEY` (or Mailchannels DNS) is set.**

D1 `database_id` and R2 bucket names must be replaced in `backend/wrangler.toml`.
