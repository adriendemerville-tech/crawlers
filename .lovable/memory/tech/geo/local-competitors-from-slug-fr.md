---
name: Concurrents locaux depuis le slug
description: Sur une page localisée, les concurrents viennent de la SERP « prestation + ville » du slug, pas de la carte d'identité ni du GMB
type: feature
---

Sur une page dont le slug porte une localité (ex. `/renovation-maison-marseille`),
`findLocalCompetitor` (`_shared/strategicAudit/socialDiscovery.ts`) doit interroger la
SERP telle que le prospect la tape : `prestation + ville`, puis `secteur + ville`.

Règles :
- Priorité de la ville : localité du slug (`derivePageFocus`) > `gmb_city` > `commercial_area` > détection dans le texte.
- La liste `competitors` de la carte d'identité est **court-circuitée** quand une localité de page est prouvée : elle décrit le domaine, pas la commune testée.
- Aucune requête nationale n'est ajoutée sur une page localisée (elle ramènerait des acteurs hors concurrence sur la commune).
- Sans localité prouvée, le comportement historique (business_type : local/e-commerce/saas/media) est conservé à l'identique.

Branchement : `audit-strategique-ia/index.ts` (Wave 2) calcule `auditedPageFocus` et
passe `{ locality, service }` en dernier paramètre.
