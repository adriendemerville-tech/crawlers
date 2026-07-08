# Vague 1 · Scan sécurité — 2026-07-08

Sources : `security--run_security_scan` (151 findings) + `supabase--linter` (153 issues) + `code--dependency_scan` (0 vulnérabilité npm).

## Répartition par sévérité

| Niveau | Nombre | Action attendue |
|---|---|---|
| ERROR | 0 | — |
| WARN | ~149 | Corriger sous 2 semaines |
| INFO | 2 | Vérifier intention (RLS activé sans policy) |

Aucune vulnérabilité npm critique ni high.

## Familles de findings

### 1. `RLS Enabled No Policy` (2 tables · INFO)
RLS activé mais aucune policy → table complètement bloquée. Soit intentionnel (write-only via service_role), soit oubli. **Action** : identifier les 2 tables, décider intentionnel/oubli.

### 2. `Function Search Path Mutable` (~majorité des WARN)
Fonctions SQL sans `SET search_path = public`. Risque de shadowing si un schéma malveillant est ajouté. **Action** : `ALTER FUNCTION … SET search_path = public` sur tout le lot (migration en batch).

### 3. `Public Bucket Allows Listing` (5-6 buckets)
Policy SELECT trop large sur `storage.objects` → n'importe qui peut lister le contenu. **Action** : restreindre la policy à `owner = auth.uid()` ou aux paths publics documentés uniquement.

### 4. `Public Can Execute SECURITY DEFINER Function` (plusieurs functions)
Functions SECURITY DEFINER callable par `anon`. Vecteur d'escalation potentiel. **Action** : pour chacune, décider :
- `REVOKE EXECUTE FROM anon` si usage authentifié uniquement
- passer en `SECURITY INVOKER` si les droits appelant suffisent
- garder tel quel si publique volontairement (ex. `get_shared_architect_recommendation`) — documenter dans mémoire.

### 5. `Extension in Public` (2 extensions)
Extensions installées dans `public` au lieu de `extensions`. **Action** : `ALTER EXTENSION … SET SCHEMA extensions` sur les 2.

## Signaux à re-mesurer dans 30j
- Nombre total findings (baseline : **151**)
- Nombre WARN sécurité (baseline : **~149**)
- Vulnérabilités npm high/critical (baseline : **0**)
