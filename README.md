# MAGNITECH storefront

A responsive technology shop built with Next.js App Router, React and TypeScript. The product catalog and administrator product management use Cloudflare D1. The cart remains in browser local storage.

## Run locally

```sh
pnpm install
pnpm --filter @maghitech/storefront dev
```

Open `http://localhost:3000`. Build the app with `pnpm --filter @maghitech/storefront build`. The Next.js development server writes to `.next-dev`; production builds use `.next`.

## Storefront features

- Home, shop, product details, bag, checkout, order status, contact, legal and supplier proposal pages.
- The D1 migration in `apps/storefront/migrations/` creates and seeds the product catalog. `apps/storefront/src/lib/products.ts` is a fallback if D1 cannot be reached. Only published products appear in the public shop.
- `/admin` supports product creation, editing, deletion, publishing and unpublishing in D1. Image URLs are supported; direct R2 uploads are not implemented yet.
- `/supplier` sends proposals to a configured browser-safe form endpoint. Submissions are not automatically published.
- Checkout validates delivery details and emails an unpaid order request to the configured store inbox. It does not take or report payment.
- Set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` to the store's FormSubmit AJAX endpoint. FormSubmit requires recipient activation; the endpoint is public in browser code. The order email contains customer contact and delivery details, so disclose this email handling in your privacy notice before launch.
- `/login` offers Google, GitHub and Microsoft OAuth. The FastAPI service stores provider identities and revocable sessions. The admin page and D1 product API verify the authenticated server-side `admin` role.
- `apps/storefront/src/lib/payment.ts` remains the hosted-payment integration point for a later phase. Configure a secure hosted provider before accepting online payments; frontend redirects must not be treated as payment verification.

## Configuration

Copy `apps/storefront/.env.example` to `apps/storefront/.env.local` for local development. Set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` in the deployment environment to enable order request emails. Never place private SMTP credentials or payment API keys in `NEXT_PUBLIC_*` variables.

Set `API_INTERNAL_URL` for the Cloudflare Worker to the API origin reachable by the Worker; `API_URL` is also accepted. Set `NEXT_PUBLIC_API_URL` to the browser-reachable API origin for OAuth sign-in and sign-out.

The `previews.d1_databases` binding currently points to the production D1 database. Changes made in a Preview, including admin changes, affect the same catalog.

Apply D1 migrations from the storefront package:

```sh
pnpm --filter @maghitech/storefront db:migrate
```

## Deploy

Deploy to Cloudflare Workers using `pnpm --filter @maghitech/storefront deploy`. Ensure the D1 binding and API URLs are configured first.

## Authentication setup (OAuth)

Copy `apps/api/.env.example` to `apps/api/.env`, `apps/storefront/.env.example` to `apps/storefront/.env.local`, and `apps/dashboard/.env.example` to `apps/dashboard/.env.local`. Run the API, PostgreSQL and Redis services; Redis is used for authentication rate limits.

Configure these API settings:

- `ADMIN_EMAIL`: the exact owner email used by the OAuth provider.
- `API_PUBLIC_URL`: public API origin; the registered OAuth callback is `<API_PUBLIC_URL>/v1/auth/{google|github|microsoft}/callback`.
- `AUTH_COOKIE_DOMAIN`: leave empty on localhost; set `.maghitech.fr` in production when storefront, dashboard and API are subdomains of that domain. Production cookies are Secure and HttpOnly.
- `STOREFRONT_URL`, `DASHBOARD_URL`: post-login destinations.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`: provider credentials. Keep secrets only in the API environment, never `NEXT_PUBLIC_*`.
- `SESSION_TTL_DAYS`: session lifetime (default 7 days).
- `CORS_ORIGINS`: exact storefront/dashboard origins, comma separated.

Set `NEXT_PUBLIC_API_URL` in both Next apps to the browser-reachable API origin. Set `API_INTERNAL_URL` in both apps to the API origin reachable from Next server/middleware (`http://api:8000` in the supplied Docker Compose stack); `API_URL` is also accepted as a compatibility fallback. In local development, both can point to `http://localhost:8000`.

Provider console steps:

1. **Google:** Create an OAuth client of type Web application. Add `<API_PUBLIC_URL>/v1/auth/google/callback` to Authorized redirect URIs.
2. **GitHub:** Create an OAuth App and set its Authorization callback URL to `<API_PUBLIC_URL>/v1/auth/github/callback`. Use `read:user user:email`; the integration requires a verified primary email.
3. **Microsoft:** Register an Entra ID application for the account types you want (the code currently uses the `common` endpoint). Add `<API_PUBLIC_URL>/v1/auth/microsoft/callback` as a Web redirect URI.

Apply the auth migration from `apps/api` with `uv run alembic upgrade head`; the production Compose `migrate` service applies it during deployment. Before the first owner login, run `uv run python -m app.cli provision-admin` locally, or `docker compose exec api python -m app.cli provision-admin` in production, after setting `ADMIN_EMAIL`. This operator-only command provisions that exact configured address as admin; public registration never assigns admin. Set `AUTH_COOKIE_DOMAIN=.maghitech.fr` when deploying to the listed subdomains (update it if `DOMAIN` changes). Restart API and Next services after changing environment variables.

To verify, sign in with the configured owner account, open `/admin`, then sign out. `/v1/admin/session` must return 401 without a session and 403 for a signed-in customer.

The marquee uses Simple Icons' CDN for the twelve vendor marks; allow `cdn.simpleicons.org` in the Content Security Policy if your deployment sets one. OAuth providers and delivery email need real credentials and a deployed callback URL before end-to-end sign-in can be tested. Email/password registration and reset are not enabled. Dashboard data remains a labeled preview because it has no connected catalog/order API yet.
