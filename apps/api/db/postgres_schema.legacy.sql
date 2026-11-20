-- =============================================================================
--  Maghitech — schéma PostgreSQL 16 (marketplace multi-vendeurs à commission)
--  Conventions :
--    * PK en UUID (gen_random_uuid(), natif PG13+)
--    * Montants en CENTIMES (BIGINT) → jamais de float pour l'argent
--    * Taux de commission en points de base (bps) : 1200 = 12,00 %
--    * Snapshots (prix, titre, taux) figés dans les lignes de commande
--  Source de vérité de la migration initiale Alembic (0001_initial).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------- Enums -----
CREATE TYPE user_role           AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE vendor_status       AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE vendor_member_role  AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE product_status      AS ENUM ('draft', 'pending_review', 'active', 'rejected', 'archived');
CREATE TYPE order_status        AS ENUM ('pending', 'confirmed', 'processing', 'partially_shipped',
                                         'shipped', 'delivered', 'completed', 'cancelled', 'refunded');
CREATE TYPE vendor_order_status AS ENUM ('pending', 'accepted', 'ready_to_ship', 'shipped',
                                         'delivered', 'returned', 'cancelled');
CREATE TYPE payment_method      AS ENUM ('card', 'cod');
CREATE TYPE payment_status      AS ENUM ('pending', 'requires_action', 'authorized', 'paid',
                                         'failed', 'refunded', 'partially_refunded');
CREATE TYPE shipment_status     AS ENUM ('label_created', 'picked_up', 'in_transit', 'out_for_delivery',
                                         'delivered', 'failed_attempt', 'returned', 'lost');
CREATE TYPE commission_status   AS ENUM ('pending', 'payable', 'paid', 'reversed');
CREATE TYPE payout_status       AS ENUM ('pending', 'processing', 'paid', 'failed', 'cancelled');

-- updated_at automatique
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ================================================================= USERS ======
CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              CITEXT      NOT NULL UNIQUE,
    password_hash      TEXT,                          -- NULL = compte invité / SSO
    first_name         TEXT,
    last_name          TEXT,
    phone              TEXT,
    role               user_role   NOT NULL DEFAULT 'customer',
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    email_verified_at  TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name     TEXT NOT NULL,
    line1         TEXT NOT NULL,
    line2         TEXT,
    postal_code   TEXT NOT NULL,
    city          TEXT NOT NULL,
    country_code  CHAR(2) NOT NULL DEFAULT 'FR',
    phone         TEXT,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_addresses_user ON addresses(user_id);

-- =============================================================== VENDORS ======
CREATE TABLE vendors (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name                 TEXT NOT NULL,
    display_name               TEXT NOT NULL,
    slug                       TEXT NOT NULL UNIQUE,
    siret                      CHAR(14) UNIQUE,              -- KYC + obligations DAC7
    vat_number                 TEXT,
    contact_email              CITEXT NOT NULL,
    contact_phone              TEXT,
    address                    JSONB NOT NULL,
    logo_url                   TEXT,
    status                     vendor_status NOT NULL DEFAULT 'pending',
    commission_rate_bps        INT CHECK (commission_rate_bps BETWEEN 0 AND 10000), -- NULL = taux catégorie/défaut
    stripe_account_id          TEXT UNIQUE,                  -- compte Stripe Connect (Express)
    stripe_payouts_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by                UUID REFERENCES users(id),
    approved_at                TIMESTAMPTZ,
    rejection_reason           TEXT,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_vendors_status ON vendors(status);

-- Plusieurs utilisateurs peuvent gérer une même boutique
CREATE TABLE vendor_members (
    vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role        vendor_member_role NOT NULL DEFAULT 'staff',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vendor_id, user_id)
);
CREATE UNIQUE INDEX ux_vendor_single_owner ON vendor_members(vendor_id) WHERE role = 'owner';

-- ============================================================== CATALOG =======
CREATE TABLE categories (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id            UUID REFERENCES categories(id) ON DELETE SET NULL,
    name                 TEXT NOT NULL,
    slug                 TEXT NOT NULL UNIQUE,
    commission_rate_bps  INT CHECK (commission_rate_bps BETWEEN 0 AND 10000),
    position             INT NOT NULL DEFAULT 0,
    seo_title            TEXT,
    seo_description      TEXT
);

CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id        UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
    title            TEXT NOT NULL,
    slug             TEXT NOT NULL UNIQUE,
    description      TEXT,
    brand            TEXT,
    status           product_status NOT NULL DEFAULT 'draft',
    cod_allowed      BOOLEAN NOT NULL DEFAULT TRUE,
    seo_title        TEXT,
    seo_description  TEXT,
    attributes       JSONB NOT NULL DEFAULT '{}',
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_products_vendor_status ON products(vendor_id, status);
CREATE INDEX ix_products_category      ON products(category_id) WHERE status = 'active';

CREATE TABLE product_variants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku                     TEXT NOT NULL,
    options                 JSONB NOT NULL DEFAULT '{}',     -- {"taille":"M","couleur":"noir"}
    price_cents             BIGINT NOT NULL CHECK (price_cents >= 0),
    compare_at_price_cents  BIGINT CHECK (compare_at_price_cents >= 0),
    stock_qty               INT NOT NULL DEFAULT 0,          -- stock déclaré par le vendeur
    weight_grams            INT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, sku)
);

CREATE TABLE product_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt         TEXT,
    position    INT NOT NULL DEFAULT 0
);
CREATE INDEX ix_product_images_product ON product_images(product_id, position);

-- =============================================================== ORDERS =======
CREATE SEQUENCE order_number_seq;

-- Commande client (un panier peut contenir plusieurs vendeurs)
CREATE TABLE orders (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number                    TEXT NOT NULL UNIQUE
                              DEFAULT ('MGT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 7, '0')),
    user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,   -- NULL = commande rapide invité
    email                     CITEXT NOT NULL,
    phone                     TEXT NOT NULL,
    status                    order_status   NOT NULL DEFAULT 'pending',
    payment_method            payment_method NOT NULL,
    payment_status            payment_status NOT NULL DEFAULT 'pending',
    currency                  CHAR(3) NOT NULL DEFAULT 'EUR',
    subtotal_cents            BIGINT NOT NULL CHECK (subtotal_cents >= 0),
    shipping_cents            BIGINT NOT NULL DEFAULT 0,
    cod_fee_cents             BIGINT NOT NULL DEFAULT 0,
    discount_cents            BIGINT NOT NULL DEFAULT 0,
    total_cents               BIGINT NOT NULL CHECK (total_cents >= 0),
    shipping_address          JSONB NOT NULL,                 -- snapshot
    billing_address           JSONB,
    stripe_payment_intent_id  TEXT UNIQUE,
    idempotency_key           TEXT UNIQUE,                    -- anti double-soumission du checkout
    customer_note             TEXT,
    placed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at              TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (total_cents = subtotal_cents + shipping_cents + cod_fee_cents - discount_cents)
);
CREATE INDEX ix_orders_user   ON orders(user_id, placed_at DESC);
CREATE INDEX ix_orders_status ON orders(status, placed_at DESC);

-- Sous-commande par vendeur : unité d'expédition et de reversement
CREATE TABLE vendor_orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
    vendor_id          UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    status             vendor_order_status NOT NULL DEFAULT 'pending',
    subtotal_cents     BIGINT NOT NULL,
    shipping_cents     BIGINT NOT NULL DEFAULT 0,
    commission_cents   BIGINT NOT NULL DEFAULT 0,
    vendor_net_cents   BIGINT NOT NULL DEFAULT 0,
    accepted_at        TIMESTAMPTZ,
    shipped_at         TIMESTAMPTZ,
    delivered_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, vendor_id)
);
CREATE INDEX ix_vendor_orders_vendor ON vendor_orders(vendor_id, status, created_at DESC);

CREATE TABLE order_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             UUID NOT NULL REFERENCES orders(id)        ON DELETE CASCADE,
    vendor_order_id      UUID NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
    vendor_id            UUID NOT NULL REFERENCES vendors(id),
    product_id           UUID REFERENCES products(id)          ON DELETE SET NULL,
    variant_id           UUID REFERENCES product_variants(id)  ON DELETE SET NULL,
    title                TEXT   NOT NULL,                       -- snapshot
    sku                  TEXT   NOT NULL,                       -- snapshot
    unit_price_cents     BIGINT NOT NULL CHECK (unit_price_cents >= 0),
    quantity             INT    NOT NULL CHECK (quantity > 0),
    total_cents          BIGINT NOT NULL,
    commission_rate_bps  INT    NOT NULL,                       -- taux figé à la commande
    CHECK (total_cents = unit_price_cents * quantity)
);
CREATE INDEX ix_order_items_order        ON order_items(order_id);
CREATE INDEX ix_order_items_vendor_order ON order_items(vendor_order_id);

-- ============================================================= PAYMENTS =======
CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider       TEXT NOT NULL,                  -- 'stripe' | 'cod'
    provider_ref   TEXT,                           -- payment_intent / charge / bordereau de remise COD
    amount_cents   BIGINT NOT NULL,
    status         payment_status NOT NULL,
    raw            JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_ref)
);
CREATE INDEX ix_payments_order ON payments(order_id);

-- ============================================================ SHIPMENTS =======
CREATE TABLE shipments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id    UUID NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
    carrier            TEXT NOT NULL,              -- 'colissimo', 'mondial_relay', 'chronopost'…
    service_code       TEXT,
    tracking_number    TEXT,
    tracking_url       TEXT,
    label_url          TEXT,
    status             shipment_status NOT NULL DEFAULT 'label_created',
    cod_amount_cents   BIGINT NOT NULL DEFAULT 0,  -- montant à encaisser à la livraison
    cod_collected_at   TIMESTAMPTZ,                -- encaissé par le livreur
    cod_remitted_at    TIMESTAMPTZ,                -- reversé à Maghitech par le transporteur
    delivered_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (carrier, tracking_number)
);
CREATE INDEX ix_shipments_status ON shipments(status) WHERE status NOT IN ('delivered', 'returned', 'lost');

CREATE TABLE shipment_events (
    id           BIGSERIAL PRIMARY KEY,
    shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status       shipment_status NOT NULL,
    location     TEXT,
    occurred_at  TIMESTAMPTZ NOT NULL,
    raw          JSONB
);
CREATE INDEX ix_shipment_events_shipment ON shipment_events(shipment_id, occurred_at);

-- =========================================================== COMMISSIONS ======
-- Une ligne par order_item → traçabilité totale (remboursement partiel, litige, audit)
CREATE TABLE commissions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id      UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
    vendor_order_id    UUID NOT NULL REFERENCES vendor_orders(id),
    vendor_id          UUID NOT NULL REFERENCES vendors(id),
    base_amount_cents  BIGINT NOT NULL,            -- assiette (prix TTC des articles)
    rate_bps           INT    NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
    commission_cents   BIGINT NOT NULL,            -- part Maghitech
    vendor_net_cents   BIGINT NOT NULL,            -- part vendeur
    status             commission_status NOT NULL DEFAULT 'pending',
    payable_at         TIMESTAMPTZ,                -- livraison + délai de rétractation (14 j)
    payout_id          UUID,                       -- FK ajoutée après création de payouts
    reversed_at        TIMESTAMPTZ,
    reversal_reason    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (commission_cents + vendor_net_cents = base_amount_cents),
    CHECK (status <> 'paid' OR payout_id IS NOT NULL)
);
CREATE INDEX ix_commissions_vendor_status ON commissions(vendor_id, status);
CREATE INDEX ix_commissions_payable       ON commissions(payable_at) WHERE status = 'pending';

-- ============================================================== PAYOUTS =======
CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'EUR',
    gross_cents         BIGINT NOT NULL,           -- ventes brutes
    commission_cents    BIGINT NOT NULL,           -- commission prélevée
    adjustments_cents   BIGINT NOT NULL DEFAULT 0, -- retours, pénalités, frais de port (+/-)
    net_cents           BIGINT NOT NULL,           -- montant viré au vendeur
    status              payout_status NOT NULL DEFAULT 'pending',
    stripe_transfer_id  TEXT UNIQUE,
    statement_url       TEXT,                      -- relevé PDF / facture de commission
    paid_at             TIMESTAMPTZ,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (period_end >= period_start),
    CHECK (net_cents = gross_cents - commission_cents + adjustments_cents),
    UNIQUE (vendor_id, period_start, period_end)
);
CREATE INDEX ix_payouts_vendor ON payouts(vendor_id, created_at DESC);

ALTER TABLE commissions
    ADD CONSTRAINT fk_commissions_payout FOREIGN KEY (payout_id) REFERENCES payouts(id);

-- ====================================================== WEBHOOKS & AUDIT ======
-- Idempotence : un même événement (Stripe, transporteur) n'est traité qu'une fois
CREATE TABLE webhook_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      TEXT NOT NULL,
    event_id      TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ,
    attempts      INT NOT NULL DEFAULT 0,
    last_error    TEXT,
    UNIQUE (provider, event_id)
);
CREATE INDEX ix_webhook_events_unprocessed ON webhook_events(received_at) WHERE processed_at IS NULL;

CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    actor_id     UUID REFERENCES users(id),
    action       TEXT NOT NULL,                    -- 'vendor.approve', 'payout.create'…
    entity_type  TEXT NOT NULL,
    entity_id    UUID,
    diff         JSONB,
    ip           INET,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================= Triggers =======
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','vendors','products','product_variants','orders',
                           'vendor_orders','shipments','commissions','payouts']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
