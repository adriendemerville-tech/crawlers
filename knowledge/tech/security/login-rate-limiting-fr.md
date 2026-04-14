# Memory: tech/security/login-rate-limiting-fr
Updated: 2026-04-14

## Protection anti brute-force côté client

Un hook `useLoginRateLimiter` implémente un verrouillage progressif côté client après des tentatives de connexion échouées :

### Seuils
| Tentatives échouées | Verrouillage |
|---------------------|-------------|
| 5 | 30 secondes |
| 8 | 60 secondes |
| 12 | 5 minutes |

### Comportement
- Compteur persisté en `localStorage` (clé `login_rate_limit`) pour survivre aux rechargements de page
- Pendant le verrouillage : bouton de connexion désactivé + message avec compte à rebours
- Connexion réussie → compteur remis à zéro
- Expiration du verrouillage → le compteur d'échecs est conservé (prochaine erreur relance un verrouillage)

### Intégration
- `src/pages/Auth.tsx` : page principale d'authentification
- `src/components/ExpertAudit/InlineAuthForm.tsx` : formulaire inline d'audit

### Couche serveur
GoTrue (Lovable Cloud) applique déjà un rate-limiting par IP côté serveur. Cette protection client est complémentaire pour l'UX et le découragement des attaques manuelles.
