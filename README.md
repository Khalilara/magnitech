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
- Checkout emails an unpaid order request to the configured store inbox. It does not take or report payment.

## Configuration

Copy `apps/storefront/.env.example` to `apps/storefront/.env.local` for local development. Set `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` in the deployment environment to enable order request emails. Its endpoint is public in browser code. Never place private SMTP credentials or payment API keys in `NEXT_PUBLIC_*` variables.

Configure admin access from `apps/storefront` with Worker secrets:

```sh
pnpm exec wrangler secret put ADMIN_PASSWORD
pnpm exec wrangler secret put ADMIN_SESSION_SECRET
```

Use a long, unique password and a separate random session secret of at least 32 random bytes. These secrets are not stored in Git. Admin sessions use an HTTP-only, same-site cookie that expires after 12 hours. Configure secrets for each Worker environment that should allow admin access.

The `previews.d1_databases` binding currently points to the production D1 database. Changes made in a Preview, including admin changes, affect the same catalog.

Apply D1 migrations from the storefront package:

```sh
pnpm --filter @maghitech/storefront db:migrate
```

## Deploy

Deploy to Cloudflare Workers using `pnpm --filter @maghitech/storefront deploy`. Ensure the Worker secrets and D1 binding are configured first.
