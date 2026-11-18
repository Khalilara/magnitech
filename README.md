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
- `apps/storefront/src/lib/payment.ts` remains the hosted-payment integration point for a later phase. Configure a secure hosted provider before accepting online payments; frontend redirects must not be treated as payment verification.

## Public configuration

Copy `apps/storefront/.env.example` to `apps/storefront/.env.local` for local development. For Vercel, add `NEXT_PUBLIC_ORDER_FORM_ENDPOINT` in Project Settings → Environment Variables and redeploy; `.env.local` is ignored by Git. Submit one test request after activating the FormSubmit endpoint and verify it arrives in the recipient inbox. Never place private SMTP credentials or payment API keys in `NEXT_PUBLIC_*` variables.

## Deploy

Deploy the storefront app on Vercel with the root directory set to `apps/storefront`. The existing monorepo also contains separate legacy dashboard/API packages; the storefront pages documented here do not depend on them.
