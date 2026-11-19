# MAGNITECH storefront

A responsive, frontend-only technology shop. The current repository already uses Next.js App Router, React and TypeScript, so the storefront implementation keeps that existing framework and workspace structure. No storefront API or database is used by these pages.

## Run locally

```sh
pnpm install
pnpm --filter @maghitech/storefront dev
```

Open `http://localhost:3000`. Build the app with `pnpm --filter @maghitech/storefront build`.
The Next.js 15 development server writes to `.next-dev`; production builds use `.next`. Keep this split so a build does not replace CSS assets used by a running dev server.

## Storefront features

- Home, shop, product details, bag, checkout, order status, contact, legal and supplier proposal pages.
- The catalog in `apps/storefront/src/lib/products.ts` is the source of the initial products. Only products with `published: true` appear in the public shop.
- Search, category filtering, sorting and cart state are available in the storefront.
- `/admin` offers local product editing, publishing, margin calculation and image selection. Changes are stored in that browser's local storage. They are not synced to other browsers, saved to the source catalog, or included in a deployment. To publish catalog changes, update `products.ts` and deploy again.
- `/supplier` sends a proposal, including product details and image URL links, to a configured browser-safe form endpoint. Submissions are not automatically published.
- Checkout validates delivery details and emails an unpaid order request to the configured store inbox. The customer is told that the store will confirm availability and arrange payment separately. No payment is taken or reported as paid.
- For order emails, set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` to the store's FormSubmit AJAX endpoint. FormSubmit requires the recipient to activate the form before submissions are forwarded. The recipient endpoint is public in browser code; use FormSubmit's random email link to avoid publishing a raw mailbox address. The order email contains customer contact and delivery details, so disclose the email handling in your privacy notice before launch.
- `/login` offers Google, GitHub, and Microsoft OAuth. The FastAPI service stores provider identities and hashed, revocable sessions. Admin pages and `/v1/admin/*` routes require an active server-side `admin` role; the public storefront navigation does not expose an Admin link.
- `apps/storefront/src/lib/payment.ts` remains the hosted-payment integration point for a later phase. Configure a secure hosted provider before accepting online payments; frontend redirects must not be treated as payment verification.

## Public configuration

Copy `apps/storefront/.env.example` to `apps/storefront/.env.local` for local development. For Vercel, add `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` in Project Settings → Environment Variables and redeploy; `.env.local` is ignored by Git. Submit one test request after activating the FormSubmit endpoint and verify it arrives in the recipient inbox. Never place private SMTP credentials or payment API keys in `NEXT_PUBLIC_*` variables.

## Deploy

Deploy the storefront app on Vercel with the root directory set to `apps/storefront`. The existing monorepo also contains separate legacy dashboard/API packages; the storefront pages documented here do not depend on them.

## Authentication setup (OAuth)

Copy `apps/api/.env.example` to `apps/api/.env`, `apps/storefront/.env.example` to `apps/storefront/.env.local`, and `apps/dashboard/.env.example` to `apps/dashboard/.env.local`. Run the API, PostgreSQL, and Redis services; Redis is used for authentication rate limits.

Configure these API settings:

- `ADMIN_EMAIL`: the exact owner email used by the OAuth provider.
- `API_PUBLIC_URL`: public API origin; the registered OAuth callback is `<API_PUBLIC_URL>/v1/auth/{google|github|microsoft}/callback`.
- `AUTH_COOKIE_DOMAIN`: leave empty on localhost; set `.magnitech.fr` in production when storefront, dashboard, and API are subdomains of that domain. Production cookies are Secure and HttpOnly.
- `STOREFRONT_URL`, `DASHBOARD_URL`: post-login destinations.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`: provider credentials. Keep secrets only in the API environment, never `NEXT_PUBLIC_*`.
- `SESSION_TTL_DAYS`: session lifetime (default 7 days).
- `CORS_ORIGINS`: exact storefront/dashboard origins, comma separated.

Set `NEXT_PUBLIC_API_URL` in both Next apps to the browser-reachable API origin. Set `API_URL` in both apps to the API origin reachable from Next server/middleware. For a production deployment with separate subdomains, use the public API origin in both values unless an internal service URL is available for `API_URL`.

Provider console steps:

1. **Google:** Create an OAuth client of type Web application in Google Cloud Console. Add the callback above to Authorized redirect URIs and configure the consent screen. Add the resulting client ID and secret to the API environment.
2. **GitHub:** Create an OAuth App under Developer settings. Set its Authorization callback URL to the GitHub callback above. Use only `read:user user:email`; the integration requires a verified primary email. Add its client ID and secret to the API environment.
3. **Microsoft:** Register an Entra ID application that allows the account types you want (the code currently uses the `common` endpoint). Add the callback above as a Web redirect URI and create a client secret. Add the application ID and secret to the API environment.

Apply the auth migration from `apps/api` with `uv run alembic upgrade head`. Before the first owner login, run `uv run python -m app.cli provision-admin` in the trusted API environment after setting `ADMIN_EMAIL`. This operator-only command provisions that exact configured address as admin; public registration never assigns admin. Restart API and Next services after changing environment variables. To verify, sign in with the configured owner account, confirm the dashboard loads, use Sign out, and verify `/v1/admin/session` returns 401 without a session and 403 for a signed-in customer.

The marquee uses Simple Icons' CDN for the twelve vendor marks; connect a reliable CSP allowance for `cdn.simpleicons.org` if your deployment sets Content Security Policy. OAuth providers and delivery email still need real credentials and a deployed callback URL before end-to-end sign-in can be tested. Email/password registration and reset are not enabled; provider sign-in is the implemented authentication path. Dashboard data remains a labeled preview because this dashboard has no connected catalog/order API yet.
