-- ─────────────────────────────────────────────────────────────
-- L1a.1 — Enums
-- ─────────────────────────────────────────────────────────────
create type public.marketplace_asset_kind as enum ('link', 'instagram', 'linkedin');
create type public.marketplace_link_attribute as enum ('dofollow', 'nofollow', 'sponsored');
create type public.marketplace_deal_type as enum ('cash', 'credits', 'barter');
create type public.marketplace_order_status as enum ('draft','frozen','pending','published','verified','maintained','broken','resolved','refunded','cancelled');
create type public.marketplace_currency_kind as enum ('link', 'story', 'linkedin');
create type public.marketplace_trade_type as enum ('link_chain','link_for_link','link_for_linkedin','link_for_insta','linkedin_for_linkedin','insta_for_insta');
create type public.marketplace_sell_risk_class as enum ('safe','moderate','discouraged');
create type public.marketplace_tax_status as enum ('company_vat','company_no_vat','micro','individual','association');
create type public.marketplace_verification_method as enum ('gsc','dns_txt','file','oauth_linkedin','oauth_meta');
create type public.marketplace_ownership_status as enum ('verified','unverified','revoked');
create type public.marketplace_anchor_kind as enum ('brand','exact','semi','url','natural');
create type public.marketplace_need_type as enum ('seo','geo','conversion');
create type public.marketplace_need_objective as enum ('autorite','geo','trafic','mixte');
create type public.marketplace_need_objective_source as enum ('derived','user_confirmed','user_overridden');
create type public.marketplace_settlement_support as enum ('cash','credits');
create type public.marketplace_invoice_kind as enum ('commission','self_billing','soulte','refund');
create type public.marketplace_dispute_reason as enum ('not_published','attribute_mismatch','anchor_mismatch','removed_early','content_refused','payment','other');
create type public.marketplace_dispute_decision as enum ('buyer','seller','split','void');
create type public.marketplace_price_tier as enum ('P1','P2','P3','P4','P5');

-- ─────────────────────────────────────────────────────────────
-- L1a.2 — Constantes versionnées (§2.15)
-- ─────────────────────────────────────────────────────────────
create table public.marketplace_pricing_constants (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  key text not null,
  value jsonb not null,
  active boolean not null default false,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (version, key)
);

grant select on public.marketplace_pricing_constants to authenticated;
grant all on public.marketplace_pricing_constants to service_role;
alter table public.marketplace_pricing_constants enable row level security;

create policy "constants readable by authenticated"
  on public.marketplace_pricing_constants for select to authenticated using (true);
create policy "constants writable by admins"
  on public.marketplace_pricing_constants for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.marketplace_pricing_constants (version, key, value, active, note) values
  (1, 'price_base_cents', '35000'::jsonb, true, 'Base du prix indicatif (§2.1)'),
  (1, 'price_floor_cents', '4000'::jsonb, true, 'Plancher dur 40 EUR'),
  (1, 'price_cap_cents', '35000'::jsonb, true, 'Plafond dur 350 EUR'),
  (1, 'price_rounding_cents', '1000'::jsonb, true, 'Arrondi au palier de 10 EUR'),
  (1, 'tiers', '{"P1":4000,"P2":9000,"P3":15000,"P4":25000,"P5":35000}'::jsonb, true, 'Paliers P1-P5 en centimes'),
  (1, 'tier_thresholds', '{"P2":0.35,"P3":0.55,"P4":0.72,"P5":0.88}'::jsonb, true, 'Score global -> palier (borne inferieure)'),
  (1, 'pricing_weights', '{"authority":0.30,"semantic":0.25,"traffic":0.20,"quality":0.15,"ai_visibility":0.10}'::jsonb, true, 'Poids des 5 signaux (§2.1)'),
  (1, 'commission_rate', '0.15'::jsonb, true, 'Commission Crawlers 15 %'),
  (1, 'link_for_link_discount', '0.70'::jsonb, true, 'Decote reciprocite directe'),
  (1, 'link_for_link_delay_days', '21'::jsonb, true, 'Decorrelation des jambes'),
  (1, 'sell_risk_weights', '{"strategic":0.30,"internal_dependency":0.25,"gsc_momentum":0.20,"outbound_saturation":0.15,"technical_fragility":0.10}'::jsonb, true, 'Poids sell_risk (§2.12)'),
  (1, 'sell_risk_safe_max', '0.20'::jsonb, true, 'Classe sure'),
  (1, 'sell_risk_eligible_max', '0.35'::jsonb, true, 'Eligibilite a la vente'),
  (1, 'caps', '{"dofollow_per_page_lifetime":1,"dofollow_per_domain_12m":20,"insertions_per_page_12m":3}'::jsonb, true, 'Plafonds lies (§2.4)'),
  (1, 'dofollow_min_tier', '"P3"'::jsonb, true, 'Palier minimal pour un dofollow'),
  (1, 'seller_deficit_min', '0'::jsonb, true, 'Deficit net minimal cote acheteur (§2.7.3)'),
  (1, 'studio_version_c_max_authority', '60'::jsonb, true, 'Au-dela, la version C disparait (§2.9)'),
  (1, 'revision_rounds_max', '3'::jsonb, true, 'Tours de revision maximum (§2.3)'),
  (1, 'style_homogeneity_thresholds', '{"min_similarity":0.55,"max_similarity":0.92}'::jsonb, true, 'Controle d''homogeneite stylistique (§2.9)'),
  (1, 'p5_min_signal_days', '90'::jsonb, true, 'Historique GSC minimal pour P5'),
  (1, 'gsc_access_log_retention_months', '24'::jsonb, true, 'Retention du journal support (§2.1.1)'),
  (1, 'signals_refresh_min_days', '7'::jsonb, true, 'Rafraichissement des fourchettes au plus une fois par 7 j');

-- ─────────────────────────────────────────────────────────────
-- L1a.3 — Inventaire vendeur (§4.2)
-- Valeurs GSC exactes : aucun GRANT client, lecture par server function seulement.
-- ─────────────────────────────────────────────────────────────
create table public.marketplace_link_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tracked_site_id uuid,
  domain text not null,
  url text not null,
  asset_kind public.marketplace_asset_kind not null default 'link',
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opt_in_terms_version int,
  ownership_status public.marketplace_ownership_status not null default 'unverified',
  -- Signaux GSC exacts (jamais exposes au client)
  gsc_clicks_90d int,
  gsc_impressions_90d int,
  gsc_avg_position numeric(6,2),
  gsc_queries jsonb,
  gsc_countries jsonb,
  gsc_daily jsonb,
  gsc_window_start date,
  gsc_window_end date,
  -- Projections exposables (calculees serveur)
  clicks_bucket text,
  impressions_bucket text,
  position_bucket text,
  traffic_trend text,
  topic_clusters text[] not null default '{}',
  top_countries text[] not null default '{}',
  authority_score smallint,
  semantic_score smallint,
  traffic_score smallint,
  quality_score smallint,
  ai_visibility_score smallint,
  global_score numeric(5,4),
  price_tier public.marketplace_price_tier,
  price_cents int,
  constants_version int,
  signals_refreshed_at timestamptz,
  -- Plafonds consommes
  dofollow_sold_lifetime int not null default 0,
  insertions_12m int not null default 0,
  revenue_cents int not null default 0,
  sell_risk_class public.marketplace_sell_risk_class,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url),
  constraint marketplace_link_assets_price_bounds
    check (price_cents is null or (price_cents between 4000 and 35000 and price_cents % 1000 = 0))
);

create index marketplace_link_assets_domain_idx on public.marketplace_link_assets (domain);
create index marketplace_link_assets_opted_in_idx on public.marketplace_link_assets (opted_in) where opted_in;

-- Colonnes exposables uniquement : les signaux exacts n'ont aucun GRANT.
grant select (
  id, user_id, tracked_site_id, domain, url, asset_kind, opted_in, opted_in_at,
  opt_in_terms_version, ownership_status, clicks_bucket, impressions_bucket, position_bucket,
  traffic_trend, topic_clusters, top_countries, authority_score, semantic_score, traffic_score,
  quality_score, ai_visibility_score, global_score, price_tier, price_cents, constants_version,
  signals_refreshed_at, dofollow_sold_lifetime, insertions_12m, revenue_cents, sell_risk_class,
  created_at, updated_at
) on public.marketplace_link_assets to authenticated;
grant all on public.marketplace_link_assets to service_role;
alter table public.marketplace_link_assets enable row level security;

create policy "assets readable by owner"
  on public.marketplace_link_assets for select to authenticated using (user_id = auth.uid());
create policy "opted-in assets readable by authenticated"
  on public.marketplace_link_assets for select to authenticated
  using (opted_in and ownership_status = 'verified');

-- ─────────────────────────────────────────────────────────────
-- L1a.4 — Vue publique des signaux (§2.1.1)
-- security_invoker : aucun contournement de RLS, aucune colonne brute projetee.
-- ─────────────────────────────────────────────────────────────
create view public.marketplace_asset_public_signals
with (security_invoker = on) as
select
  a.id as asset_id,
  a.domain,
  a.url,
  a.asset_kind,
  a.clicks_bucket,
  a.impressions_bucket,
  a.position_bucket,
  a.traffic_trend,
  a.topic_clusters,
  a.top_countries,
  a.authority_score,
  a.semantic_score,
  a.traffic_score,
  a.quality_score,
  a.ai_visibility_score,
  a.price_tier,
  a.price_cents,
  a.sell_risk_class,
  a.signals_refreshed_at
from public.marketplace_link_assets a
where a.opted_in and a.ownership_status = 'verified';

grant select on public.marketplace_asset_public_signals to authenticated;

-- ─────────────────────────────────────────────────────────────
-- L1a.5 — Risque de vente par page (§2.12)
-- ─────────────────────────────────────────────────────────────
create table public.marketplace_page_sell_risk (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  domain text not null,
  url text not null,
  sell_risk numeric(4,3) not null,
  risk_class public.marketplace_sell_risk_class not null,
  components jsonb not null default '{}'::jsonb,
  hard_exclusion_reason text,
  constants_version int,
  recomputed_at timestamptz not null default now(),
  unique (user_id, url)
);

grant select on public.marketplace_page_sell_risk to authenticated;
grant all on public.marketplace_page_sell_risk to service_role;
alter table public.marketplace_page_sell_risk enable row level security;

create policy "sell risk readable by owner"
  on public.marketplace_page_sell_risk for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- L1a.6 — Propriete, declaration de responsabilite, journal support (§4.5)
-- ─────────────────────────────────────────────────────────────
create table public.marketplace_ownership_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  domain text not null,
  asset_id uuid references public.marketplace_link_assets(id) on delete cascade,
  method public.marketplace_verification_method not null,
  token text,
  status public.marketplace_ownership_status not null default 'unverified',
  siren text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index marketplace_ownership_domain_unique
  on public.marketplace_ownership_verifications (domain)
  where status = 'verified';
create index marketplace_ownership_user_idx
  on public.marketplace_ownership_verifications (user_id, domain);

grant select on public.marketplace_ownership_verifications to authenticated;
grant all on public.marketplace_ownership_verifications to service_role;
alter table public.marketplace_ownership_verifications enable row level security;

create policy "ownership readable by owner"
  on public.marketplace_ownership_verifications for select to authenticated using (user_id = auth.uid());

create table public.marketplace_ownership_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  domain text not null,
  claim_text text not null,
  claim_version int not null default 1,
  ip text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

grant select on public.marketplace_ownership_claims to authenticated;
grant all on public.marketplace_ownership_claims to service_role;
alter table public.marketplace_ownership_claims enable row level security;

create policy "claims readable by owner"
  on public.marketplace_ownership_claims for select to authenticated using (user_id = auth.uid());

create table public.marketplace_gsc_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  asset_id uuid not null references public.marketplace_link_assets(id) on delete cascade,
  owner_user_id uuid not null,
  fields_read text[] not null default '{}',
  reason text not null,
  ticket_ref text not null,
  ip text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes')
);

create index marketplace_gsc_access_log_asset_idx on public.marketplace_gsc_access_log (asset_id, created_at desc);

-- Append-only : aucun GRANT INSERT/UPDATE/DELETE au client, aucune policy UPDATE/DELETE.
grant select on public.marketplace_gsc_access_log to authenticated;
grant all on public.marketplace_gsc_access_log to service_role;
alter table public.marketplace_gsc_access_log enable row level security;

create policy "gsc access log readable by owner"
  on public.marketplace_gsc_access_log for select to authenticated using (owner_user_id = auth.uid());
create policy "gsc access log readable by admins"
  on public.marketplace_gsc_access_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────
-- L1a.7 — Profils fiscaux (§2.5.2)
-- ─────────────────────────────────────────────────────────────
create table public.marketplace_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  tax_status public.marketplace_tax_status not null,
  legal_name text not null,
  address text,
  country_code text not null default 'FR',
  siren_siret text,
  vat_number text,
  vat_number_valid boolean,
  vat_checked_at timestamptz,
  self_billing_mandate_accepted_at timestamptz,
  self_billing_mandate_version int,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.marketplace_tax_profiles to authenticated;
grant all on public.marketplace_tax_profiles to service_role;
alter table public.marketplace_tax_profiles enable row level security;

create policy "tax profile readable by owner"
  on public.marketplace_tax_profiles for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────
create trigger marketplace_link_assets_updated_at
  before update on public.marketplace_link_assets
  for each row execute function public.update_updated_at_column();
create trigger marketplace_ownership_verifications_updated_at
  before update on public.marketplace_ownership_verifications
  for each row execute function public.update_updated_at_column();
create trigger marketplace_tax_profiles_updated_at
  before update on public.marketplace_tax_profiles
  for each row execute function public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- L1a.22 — Permission d'equipe
-- ─────────────────────────────────────────────────────────────
insert into public.role_permissions (role, permission_key, enabled) values
  ('owner', 'marketplace_manage', true),
  ('editor', 'marketplace_manage', true),
  ('auditor', 'marketplace_manage', false)
on conflict do nothing;