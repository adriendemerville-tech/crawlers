# Plan gratuit « Jeune entreprise » — offre d'amorçage Crawlers

Décision de **pricing plateforme**, indépendante de la Place d'échange. Ce document est la source
de vérité de l'offre : éligibilité, quotas, fair use, économie, schéma de données et séquencement.

---

## 1. Objectif

Amorcer la base d'utilisateurs actifs en donnant un accès complet à des entreprises trop jeunes
pour payer, à un coût marginal maîtrisé, et convertir une partie d'entre elles en clients payants
avant la fin des 12 mois. L'offre n'est **pas plafonnée en nombre de comptes** : le garde-fou est
le plafond de crédits, le fair use et la vérification d'éligibilité, pas une file d'attente.

## 2. Éligibilité — France uniquement

- **12 mois de gratuité** réservés aux structures **immatriculées en France** depuis **moins de
  12 mois** à la date de candidature. Aucune structure hors France n'est éligible en v1 (pas de
  « équivalent UE » : la vérification repose sur les sources publiques françaises).
- **Étape 1 — SIRET (automatique, bloquante)** : SIRET saisi au formulaire, contrôlé côté serveur
  contre l'API publique Recherche d'entreprises (INSEE / annuaire-entreprises) : existence, état
  actif, **date de création** (`date_creation`) < 12 mois, dénomination, forme juridique, dirigeant.
- **Étape 2 — pièce justificative de moins de 3 mois**, selon la forme juridique :

| Forme | Pièce acceptée | Contrôle de concordance |
|---|---|---|
| Société commerciale (SAS, SARL, SA, SASU, EURL…) | **Kbis** < 3 mois | SIREN + dénomination + dirigeant vs INSEE |
| **Micro-entrepreneur / entreprise individuelle** | **Avis de situation SIRENE** < 3 mois (Kbis inexistant) | SIREN + nom du titulaire + date de création vs INSEE |
| **Association** | **Récépissé de déclaration en préfecture ou extrait RNA** (`W…`) + avis SIRENE si SIRET obtenu | RNA + dénomination + date de déclaration ; ancienneté lue sur la date de déclaration RNA |

- L'ancienneté fait foi sur la **date de création INSEE** (ou la date de déclaration RNA pour une
  association sans SIRET), jamais sur la déclaration de l'utilisateur. Écart avec la pièce → refus.
- **Sur candidature**, validation manuelle admin après succès du contrôle automatique.
- **Unicité** : un SIREN (ou un RNA) ne peut bénéficier de l'offre qu'une fois ; un seul dossier
  accepté par domaine déclaré.
- Non cumulable avec un autre avantage commercial (code promo, remise agence, essai en cours).
- Refus si le domaine déclaré appartient déjà à un compte payant ou a déjà bénéficié de l'offre.
- **Pas de quota de places, pas de liste d'attente** : toute candidature conforme est acceptée. Le
  seul verrou transactionnel nécessaire est l'unicité SIREN / RNA / domaine (index uniques
  partiels), pas un compteur de places concurrentes.

## 3. Contenu de l'offre

- Accès **complet à toute la plateforme** pendant **12 mois**, **sans dégradation** : mêmes modules,
  mêmes crons (quotidiens), même routage LLM et même qualité de modèles qu'un plan payant.
- **50 crédits/mois pleins**, non cumulables, reset au 1er du mois, **blocage strict** au
  dépassement (pas de découvert, pas de dérogation automatique).
- Priorité de file d'attente : niveau `registered` (jamais niveau agence) — c'est le seul écart
  assumé avec un plan payant, il porte sur le délai, pas sur la qualité.
- **Support communautaire uniquement**, mentionné explicitement dans les conditions.
- Le dépassement se règle par **packs de crédits** au tarif public : c'est le principal canal de
  monétisation de l'offre avant la conversion.

## 3.1 Fair use — propositions

L'offre n'étant plus bornée en nombre de comptes, le fair use remplace le quota de places. Règles
proposées, toutes **déterministes, mesurables et journalisées** (`startup_offer_fair_use_events`) :

| Règle | Seuil proposé | Effet au dépassement |
|---|---|---|
| **F1 — Crédits** | 50 / mois calendaire, non cumulables | Blocage dur des actions payantes jusqu'au reset |
| **F2 — Domaines suivis** | Sans limite (aucun plafond de domaines actifs par compte) | — |
| **F3 — Volume de crawl** | 5 000 URLs crawlées / mois, 1 500 URLs / crawl | Crawl tronqué avec message explicite, pas d'échec silencieux |
| **F4 — Actions chères** | Marina prospection 1/mois ; audit stratégique complet 4/mois | Action refusée avant débit, coût affiché |
| **F5 — Concurrence de jobs** | 1 job lourd en parallèle | Mise en file, pas de rejet |
| **F6 — Dépense LLM** | 0,50 €/jour/compte (sous le plafond agents de 1 €/jour) | Bascule automatique sur le palier de modèle économique **pour la journée**, retour à la normale le lendemain |
| **F7 — API publique** | 300 appels / jour, 30 / minute | 429 avec `Retry-After` |
| **F8 — Stockage** | 500 Mo par compte (rapports, exports, médias) | Refus d'upload, purge des exports > 90 jours |
| **F9 — Inactivité** | 60 jours sans connexion | Crons du compte mis en pause, réactivation à la reconnexion |
| **F10 — Abus** | Multi-comptes, revente d'accès, usage agence pour compte de tiers | Retrait de l'offre après notification, bascule en plan gratuit standard |

Deux arbitrages ouverts : (a) F6 en dégradation d'un jour ou en blocage sec, (b) F8 avec ou sans purge
automatique des exports. F2 est tranché : **aucune limite de domaines suivis**.

## 4. Implémentation technique

### 4.1 Flags et moteur de crédits

- Flags profil : `startup_offer` (bool) et `startup_offer_expires_at` (timestamptz), écrits
  **exclusivement côté serveur** par une action admin ; jamais depuis le client.
- Quota dédié dans le moteur de crédits : plafond mensuel évalué avant chaque action payante,
  message d'erreur explicite au blocage.
- Expiration : à `startup_offer_expires_at`, bascule automatique en plan gratuit standard, données
  conservées, modules payants verrouillés — aucune suppression de compte.
- `startup_offer_expires_at` = date d'acceptation + 12 mois (jamais date de création + 12 mois).
- **Vérification côté serveur uniquement** (server function) : appel à l'API Recherche d'entreprises,
  calcul de l'ancienneté, verdict `eligible` / `refuse_anciennete` / `refuse_inactif` /
  `introuvable` / `api_indisponible`. Jamais calculé côté client.

### 4.2 Schéma — `public.startup_offer_applications`

```sql
create type public.startup_legal_form as enum ('societe', 'micro_entreprise', 'association');
create type public.startup_auto_verdict as enum ('eligible','refuse_anciennete','refuse_inactif','introuvable','api_indisponible');
create type public.startup_admin_verdict as enum ('pending','accepted','rejected');

create table public.startup_offer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_form public.startup_legal_form not null,
  siret text,
  siren text,
  rna text,
  denomination text,
  date_creation date,
  declared_domain text not null,
  insee_payload jsonb,
  insee_checked_at timestamptz,
  proof_file_path text,            -- objet dans le bucket privé startup-proofs
  verdict_auto public.startup_auto_verdict,
  verdict_admin public.startup_admin_verdict not null default 'pending',
  reject_reason text,
  admin_id uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint startup_identifier_present check (siren is not null or rna is not null)
);

-- unicité de l'avantage, uniquement sur les dossiers acceptés
create unique index startup_offer_unique_siren on public.startup_offer_applications (siren)
  where verdict_admin = 'accepted' and siren is not null;
create unique index startup_offer_unique_rna on public.startup_offer_applications (rna)
  where verdict_admin = 'accepted' and rna is not null;
create unique index startup_offer_unique_domain on public.startup_offer_applications (lower(declared_domain))
  where verdict_admin = 'accepted';
-- une seule candidature en cours par utilisateur
create unique index startup_offer_one_pending on public.startup_offer_applications (user_id)
  where verdict_admin = 'pending';

grant select, insert on public.startup_offer_applications to authenticated;
grant all on public.startup_offer_applications to service_role;

alter table public.startup_offer_applications enable row level security;

create policy "own application readable"
  on public.startup_offer_applications for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "own application insertable"
  on public.startup_offer_applications for insert to authenticated
  with check (user_id = auth.uid());

create policy "admins decide"
  on public.startup_offer_applications for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
```

Les colonnes de verdict, `insee_payload`, `admin_id` et `decided_at` ne sont écrites que par la
server function (service role) ou par un admin : l'insert client ne porte que la forme juridique,
le SIRET/RNA, le domaine déclaré et le chemin de la pièce.

### 4.3 Schéma — `public.startup_offer_fair_use_events`

```sql
create table public.startup_offer_fair_use_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_code text not null,          -- 'F1'..'F10'
  observed_value numeric,
  threshold_value numeric,
  action_taken text not null,       -- 'blocked' | 'throttled' | 'downgraded_llm' | 'paused' | 'notified'
  details jsonb,
  created_at timestamptz not null default now()
);
create index startup_fair_use_user_idx on public.startup_offer_fair_use_events (user_id, created_at desc);

grant select on public.startup_offer_fair_use_events to authenticated;
grant all on public.startup_offer_fair_use_events to service_role;

alter table public.startup_offer_fair_use_events enable row level security;

create policy "own fair use events readable"
  on public.startup_offer_fair_use_events for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
```

Aucune policy d'insert côté client : les événements sont écrits par le service role.

### 4.4 Stockage des pièces justificatives

- Bucket **privé** nommé `startup-proofs`, non public, taille max 5 Mo, MIME autorisés
  `application/pdf`, `image/png`, `image/jpeg`.
- Convention de chemin imposée : `{auth.uid()}/{application_id}/{filename}`.
- Politiques de stockage :

```sql
create policy "startup proof upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'startup-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "startup proof read own or admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'startup-proofs'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.has_role(auth.uid(), 'admin')));
```

Aucune policy d'update/delete client : une pièce déposée n'est plus modifiable ; la correction passe
par une nouvelle candidature. Purge des pièces des dossiers refusés à 12 mois.

## 5. Économie

- Coût estimé : **~2,20 €/compte/mois** sans dégradation (crons quotidiens, modèles standard), à
  recouper avec une requête de baseline sur `ai_gateway_usage`, le coût de crawl et le stockage
  après 3 mois d'exploitation.
- Sans plafond de comptes, le coût total est piloté par le fair use (F1, F3, F6, F8) et suivi
  mensuellement ; seuil d'alerte proposé : coût moyen > 3,50 €/compte/mois ou coût total mensuel
  de l'offre > 1 500 €.
- Couverture : packs de crédits achetés en dépassement, conversion à l'issue des 12 mois, revenus
  de plateforme.
- Levier d'arrêt : si la conversion M12 tombe sous 8 %, l'offre est fermée aux nouvelles
  candidatures (les comptes en cours vont au terme de leurs 12 mois).

## 6. Conversion

- Séquence automatique déclenchée à **M10** : bilan de valeur produite sur 10 mois (audits, pages
  publiées, positions gagnées) puis proposition de plan payant.
- Relance à M11 et M12, puis bascule automatique en plan gratuit standard.
- KPI suivis : taux d'acceptation des candidatures, délai de décision admin, conversion M12,
  consommation moyenne de crédits, part de comptes inactifs, nombre d'événements fair use.

## 7. Textes à modifier

### `/tarifs`
- Bloc « Jeune entreprise — 12 mois offerts » (50 crédits/mois pleins, sur candidature, sans
  limite de places), positionné avant Pro Agency.
- Conditions lisibles : structure française créée depuis moins de 12 mois, vérification SIRET +
  pièce justificative (< 3 mois, Kbis / avis SIRENE / RNA), plafond de crédits, fair use, support
  communautaire, expiration à 12 mois.

### CGVU
- Éligibilité France uniquement, plafond de crédits et blocage au dépassement, règles de fair use
  F1-F10 et leurs effets, support communautaire, durée de 12 mois non reconductible, conditions de
  retrait de l'offre en cas d'abus (comptes multiples, fausse déclaration, pièce non conforme).

## 8. Séquencement et recette

| Lot | Contenu | Critère de recette |
|---|---|---|
| J1 | Tables + RLS + GRANT + bucket `startup-proofs` et ses policies | Un utilisateur ne lit que son dossier et sa pièce ; scan de sécurité vert |
| J2 | Flags profil + quota 50 crédits + blocage strict | Action refusée à 51 crédits avec message explicite |
| J3 | Formulaire de candidature (forme juridique, SIRET/RNA, dépôt de pièce), vérification serveur, back-office admin | Verdict auto correct sur 3 cas réels (société, micro, association) |
| J4 | Fair use F1-F10 + journalisation | Chaque règle produit un événement et l'effet annoncé |
| J5 | Textes `/tarifs` et CGVU | Conditions affichées conformes au présent document |
| J6 | Conversion M10-M12 + expiration automatique + tableau de suivi admin | Bascule automatique vérifiée sur un compte de test daté |

## 9. Risques

- **Abus d'ancienneté** : sociétés créées pour l'occasion → ancienneté lue sur la date de création
  INSEE / déclaration RNA, contrôle manuel de la pièce, unicité SIREN/RNA/domaine.
- **Faux SIRET / pièce retouchée** : le SIRET est vérifié en direct auprès de la source publique et
  la pièce doit concorder ; toute divergence entraîne un refus définitif pour ce SIREN.
- **Indisponibilité de l'API entreprises** : verdict `api_indisponible`, candidature en attente,
  jamais acceptée sur la seule pièce jointe.
- **Absence de plafond de comptes** : risque de coût ouvert → contenu par le fair use, le suivi
  mensuel du coût moyen et le levier de fermeture aux nouvelles candidatures.
- **Charge de support** : bornée par le support communautaire, à surveiller mensuellement.
- **Cannibalisation** : une agence pourrait préférer l'offre gratuite à Pro Agency → ancienneté
  stricte, unicité SIREN/RNA, priorité de file `registered`, suivi mensuel du coût moyen ; la
  suppression de la limite de domaines suivis (F2) reporte la protection sur ce suivi.
- **Coût LLM** : borné par F6 (0,50 €/jour/compte) sous le plafond de dépense agents de 1 €/jour.
