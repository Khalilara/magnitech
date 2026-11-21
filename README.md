# MAGNITECH storefront

A responsive technology shop built with Next.js App Router, React and TypeScript. The product catalog and administrator product management use Cloudflare D1. The cart remains in browser local storage.

## Run locally

```sh
pnpm install
pnpm --filter @maghitech/storefront db:migrate:local
pnpm --filter @maghitech/storefront dev
```

Open `http://localhost:3000`. Build the app with `pnpm --filter @maghitech/storefront build`. The Next.js development server writes to `.next-dev`; production builds use `.next`.

## Storefront features

- Home, shop, product details, shopping cart, checkout, order status, contact, legal and supplier proposal pages.
- The D1 migration in `apps/storefront/migrations/` creates and seeds the product catalog. `apps/storefront/src/lib/products.ts` is a fallback if D1 cannot be reached. Only published products appear in the public shop.
- The current D1 schema contract is documented in `apps/api/db/D1_SCHEMA.md`; the PostgreSQL schema is retained only for the separate FastAPI/Alembic backend.
- `/admin` supports product creation, editing, deletion, publishing and unpublishing in D1. Product images use HTTP(S) URLs; file uploads are paused until object storage is configured.
- `/supplier` sends proposals to a configured browser-safe form endpoint. Submissions are not automatically published.
- Checkout validates delivery details and emails an unpaid order request to the configured store inbox. It does not take or report payment.
- Set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` to the store's FormSubmit AJAX endpoint. FormSubmit requires recipient activation; the endpoint is public in browser code. The order email contains customer contact and delivery details, so disclose this email handling in your privacy notice before launch.
- `/register` creates a customer account in D1, and `/login` creates a revocable server-side session. Passwords are stored as salted PBKDF2 hashes, never as plain text. New accounts cannot assign themselves an admin role.
- Google, GitHub and Microsoft sign-in use the D1-backed OAuth callback at `/api/auth/oauth/{provider}`. Add each callback URL to that provider's OAuth app: `http://localhost:3000/api/auth/oauth/google`, `/api/auth/oauth/github` or `/api/auth/oauth/microsoft` (use your deployed origin in production). Set `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`, `OAUTH_MICROSOFT_CLIENT_ID` and `OAUTH_MICROSOFT_CLIENT_SECRET` as private runtime variables in `apps/storefront/.dev.vars` locally and as Wrangler secrets in production. `OAUTH_MICROSOFT_TENANT` is optional and defaults to `common`. Apply migration `0004_oauth_identities.sql` before enabling OAuth. OAuth-created accounts always receive the customer role; grant admin separately in D1.
- The admin page and product-management routes check the user's role in D1 on every request. Promote the store owner's account to `admin` directly in D1 after registering it.
- `apps/storefront/src/lib/payment.ts` remains the hosted-payment integration point for a later phase. Configure a secure hosted provider before accepting online payments; frontend redirects must not be treated as payment verification.

## Configuration

Copy `apps/storefront/.env.example` to `apps/storefront/.env.local` for local development. Storefront signup, login and admin authorization use the existing D1 binding; they do not call the API service. Set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` to enable order request emails. Never place private SMTP credentials or payment API keys in `NEXT_PUBLIC_*` variables.

The `previews.d1_databases` binding currently points to the production D1 database. Changes made in a Preview, including admin changes, affect the same catalog.

Apply D1 migrations from the storefront package:

```sh
pnpm --filter @maghitech/storefront db:migrate
```

## Deploy

Deploy to Cloudflare Workers using `pnpm --filter @maghitech/storefront deploy`. Ensure the D1 binding is configured first.

## User accounts and admin access

Signup creates customer accounts only. Email verification and password reset are not enabled yet. To grant admin access, register the owner account, then update its role in the D1 console:

```sql
UPDATE users SET role = 'admin' WHERE email = 'owner@example.com';
```

For local development, run the same statement with Wrangler and `--local`; use `--remote` only when intentionally changing the Cloudflare database. The storefront checks the role in D1 for the admin page and every product-management request. New password accounts are signed in immediately after registration. Password recovery currently links to store support by email; a self-serve reset flow is not enabled. OAuth providers must be separately configured with their client credentials and exact callback URLs before those options can sign users in.

Example local role promotion:

```sh
pnpm --filter @maghitech/storefront exec wrangler d1 execute maghitech-db --local --command "UPDATE users SET role = 'admin' WHERE email = 'owner@example.com';"
```

The marquee uses Simple Icons' CDN for the twelve vendor marks; allow `cdn.simpleicons.org` in the Content Security Policy if your deployment sets one. Dashboard data remains a labeled preview because it has no connected catalog/order API yet.
