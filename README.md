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

Required vars: `JWT_SECRET`, `RESET_LINK_BASE_URL`, `CORS_ORIGINS` (exact origins, never `*`), `EMAIL_FROM`.  
Set `EMAIL_PROVIDER=resend` (or `mailchannels`) in production. Password reset **code is ready**; **outbound email is DEPLOYMENT CONFIGURATION REQUIRED** until `RESEND_API_KEY` (or Mailchannels DNS) + a verified `EMAIL_FROM` domain are set. Production never uses Mailpit/console.

`backend/wrangler.toml` `database_id` is **UNSET_SET_AFTER_D1_CREATE** on purpose. Create D1 and paste the real UUID before remote deploy. Do not invent an ID.
