# Memory: tech/security/code-and-injection-security-v2-fr
Updated: 2026-04-13

La sécurité des injections de code repose sur la vérification de propriété via 'verifyInjectionOwnership'. Par défaut, l'édition manuelle du code brut est désactivée pour la sécurité (CGVU Art. 5 ter). Cependant, les abonnés bénéficient d'un 'Mode Avancé' dans le Code Architect permettant l'édition du code généré, à condition qu'il passe par un pipeline de validation IA ('validate-injection-code'). Ce validateur vérifie la syntaxe, la lisibilité par les bots et la couverture des objectifs avant d'autoriser l'injection finale.

## Sanitisation du contenu HTML
Le composant `HtmlContentRenderer` utilise **DOMPurify** (`USE_PROFILES: { html: true }`) avec les attributs responsives autorisés (`srcset`, `sizes`, `loading`, `fetchpriority`). Les tags `<style>` sont interdits. Les vecteurs XSS suivants sont bloqués :
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`
- `href="javascript:"` et `src="javascript:"`
- Event handlers (`on*`)
- SVG avec scripts embarqués
- CSS `expression()` et `url('javascript:')`
