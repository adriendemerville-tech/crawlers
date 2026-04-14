# Memory: features/admin/sav-monitoring-fr
Updated: 2026-04-14

Le dashboard Admin dispose d'un onglet 'SAV IA' centralisant l'historique des conversations de l'agent 'Crawler'. Il permet de suivre les indicateurs de satisfaction, les demandes d'escalade vers un rappel téléphonique et le registre des numéros de téléphone collectés (purgés sous 48h via `cleanup_expired_phone_callbacks()`). Cette interface assure le contrôle qualité des réponses générées par l'IA et la gestion des demandes de support complexes.

## Fonctionnalités de Monitoring SAV
- **Historique des conversations** : Accès complet aux logs de l'agent 'Crawler' avec filtres par date, utilisateur et score de satisfaction.
- **Indicateurs de performance (KPIs)** : Taux de résolution, temps de réponse moyen, et score CSAT (Customer Satisfaction Score).
- **Gestion des escalades** : File d'attente des demandes de rappel téléphonique avec statut (En attente, En cours, Traité).
- **Registre de conformité** : Journal des numéros de téléphone collectés pour rappel, avec purge automatique après 48 heures pour respecter le RGPD.
- **Contrôle Qualité** : Outil de relecture et d'annotation des réponses IA pour améliorer le fine-tuning du modèle.

## Fil d'Ariane (Breadcrumb) — Système centralisé

### Composant `src/components/SEO/Breadcrumb.tsx`
- Génère automatiquement le fil d'Ariane **visible** (`<nav aria-label="Breadcrumb">`) + **JSON-LD** `BreadcrumbList`
- Basé sur le pathname de la route courante (découpage par segments)
- Mapping `PATH_LABELS` pour 60+ routes (noms lisibles FR)
- Support `customItems` prop pour routes dynamiques (`/guide/:slug`, `/lexique/:term`)
- Intégré globalement dans `App.tsx` (toutes les routes app + marketing)
- Pas de breadcrumb visible sur la Home (seule page racine)

### Audit Breadcrumb (Cocoon Diag Structure)
- `missing_breadcrumbs` : détecte les pages indexables (depth > 0) sans schema `BreadcrumbList`. Severity `critical` si > 70% des pages concernées.
- `breadcrumb_depth_mismatch` : identifie les pages dont la profondeur URL (segments de path) et la profondeur BFS (crawl) diffèrent de 3+ niveaux.
- Les deux findings sont intégrés au workbench pour actions correctives (injection via Code Architect).

### Code Correctif `inject_breadcrumbs`
- Injection automatique de breadcrumbs JSON-LD `BreadcrumbList` dans `<head>`
- Disponible dans le Code Architecte (onglet Stratégie, catégorie SEO)
- SEO Points : [2, 5]

### SSR (`render-page`)
- Route labels étendus à 47 routes pour cohérence JSON-LD côté bots

## Navigation Admin
- **Onglet par défaut admin** : Intelligence Hub (pour les utilisateurs avec `canSeeIntelligence`), sinon Statistiques
- L'Intelligence Hub est le premier item du menu latéral admin (au-dessus de Statistiques)
