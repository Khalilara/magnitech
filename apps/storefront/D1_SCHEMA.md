# D1 schema contract

The storefront D1 database is the source of truth for the storefront catalog and account records. Apply schema changes through new, numbered SQL files in `migrations/`; do not edit a migration that has already been applied. Frontend code should use application routes rather than connecting to D1 from the browser.

## Accounts

- `users`: unique case-insensitive `email`, `password_hash`, `role` (`admin`, `customer`, `wholesaler`), account `status`, and timestamps. Store a password hash only, never a password.
- `wholesaler_profiles`: one profile per user, business/contact details, moderation `status` (`pending`, `active`, `rejected`, `suspended`), reviewer and rejection fields.
- `user_sessions`: user reference, unique `token_hash`, expiry, and optional revocation timestamp. Store a hash of the session token, not the token itself.

Public signup may create customers and wholesaler accounts, but must never grant the `admin` role. Admin accounts need a trusted provisioning path. A wholesaler must have an active profile before submitting products.

## Catalog moderation

`products.wholesaler_id` points to the submitting wholesaler profile. It is nullable for the existing seeded catalog. `products.status` is one of `draft`, `pending_review`, `approved`, `rejected`, or `archived`; only approved and published products belong in the public catalog. `reviewed_by`, `reviewed_at`, and `rejection_reason` record the latest moderation decision.

The existing `published` field remains for compatibility. New moderation and vendor routes should keep it consistent with `status`; public catalog queries must check both.

## Current scope

The account/session tables define the D1 contract, but registration, login, session validation, wholesaler submission, and moderation routes still need implementation. Orders and payments are not part of this migration.
