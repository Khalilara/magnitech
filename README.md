# Magnitech — marketplace e-commerce à commission

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Backend API | **Python 3.12 · FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic v2** | Async natif, OpenAPI auto → client TS typé pour les frontends |
| Jobs asynchrones | **Celery + Redis** (worker + beat) | Webhooks, libération des commissions, reversements, polling transporteurs |
| Storefront | **Next.js 15 (App Router, SSR/ISR)** | SEO (rendu serveur, sitemap, données structurées), pages produit en cache ISR |
| Dashboard | **Next.js 15**, une app pour `vendeur.` et `admin.` | Code partagé, séparation par domaine + RBAC côté API |
| Base de données | **PostgreSQL 16** | Transactions ACID pour l'argent, contraintes CHECK, JSONB |
| Cache / broker | **Redis 7** | Sessions, panier, rate-limit applicatif, broker Celery |
| Recherche | **Meilisearch** | Recherche instantanée tolérante aux fautes, facettes |
| Reverse proxy | **Traefik v3** | TLS Let's Encrypt automatique, routage par labels, HTTP/3 |
| Paiement | **Stripe Connect (Express)** — *separate charges and transfers* | Panier multi-vendeurs, reversement aux vendeurs, KYC géré par Stripe |
| Médias | S3 externe (Scaleway / OVHcloud, hébergement UE) | Pas de stockage objet à opérer soi-même |

## Structure du monorepo

```
maghitech/
├── apps/
│   ├── api/                      # FastAPI + Celery (une image → api, worker, beat, migrate)
│   │   ├── app/
│   │   │   ├── api/v1/           # routers : auth, catalog, cart, checkout, orders,
│   │   │   │                     #           vendor/*, admin/*, webhooks
│   │   │   ├── core/             # config, db, sécurité (JWT, argon2), logging
│   │   │   ├── models/           # modèles SQLAlchemy
│   │   │   ├── schemas/          # DTO Pydantic
│   │   │   ├── services/         # logique métier : commission, checkout, payouts, carriers/
│   │   │   └── workers/          # celery_app, tasks
│   │   ├── alembic/              # migrations (0001 = db/schema.sql)
│   │   ├── db/schema.sql         # schéma de référence
│   │   ├── tests/
│   │   ├── pyproject.toml · uv.lock
│   │   └── Dockerfile
│   ├── storefront/               # Next.js — site client (SEO, COD, Stripe Elements)
│   │   ├── src/app/              # (shop)/, produit/[slug]/, panier/, commande/
│   │   └── Dockerfile
│   └── dashboard/                # Next.js — /vendor/* et /admin/* (middleware par host)
│       ├── src/app/
│       └── Dockerfile
├── packages/
│   ├── api-client/               # client TS généré depuis l'OpenAPI FastAPI
│   ├── ui/                       # composants partagés
│   └── config/                   # tsconfig / eslint communs
├── infra/traefik/dynamic.yml     # middlewares (headers, compression, rate-limit)
├── docker-compose.yml
├── .env.example
├── package.json · pnpm-workspace.yaml · turbo.json · pnpm-lock.yaml
└── .dockerignore
```

## Domaines

| Hôte | Service |
|---|---|
| `maghitech.fr` (+ redirection `www`) | storefront |
| `vendeur.maghitech.fr` | dashboard, espace vendeur |
| `admin.maghitech.fr` | dashboard, back-office (restreint par IP) |
| `api.maghitech.fr` | API (`/v1/webhooks/*` sans rate-limit) |

## Flux argent

1. **Carte** : Stripe PaymentIntent pour le total du panier sur le compte plateforme, `transfer_group = numéro de commande`.
2. **COD** : le transporteur encaisse puis reverse à Magnitech → `shipments.cod_remitted_at`.
3. À la commande, une ligne `commissions` par article (taux figé : contrat vendeur > catégorie > défaut).
4. Livraison (webhook transporteur) → `payable_at = livraison + 14 jours` (rétractation).
5. Beat horaire : `pending → payable` (pour le COD, seulement une fois les fonds reversés).
6. Beat hebdomadaire : un `payout` par vendeur → `stripe.Transfer.create` vers son compte Connect.
7. Remboursement / retour → commission `reversed`, ajustement négatif sur le prochain payout.

## Démarrage

```bash
cp .env.example .env        # renseigner les secrets
docker compose up -d --build
docker compose logs -f migrate api
```

Tests API seuls : `docker build -f apps/api/Dockerfile --target test .`
