# Logo du Stratège Cocoon — constat (aucune modification)

Il n'y a pas de logo propre au Stratège. Il utilise partout le même robot blanc sur un carré doré, et il n'existe aucune image dans public/ ni dans src/assets/.

## Où il apparaît
- Fenêtre de chat Cocoon et espace /app/cocoon : `src/components/Cocoon/CocoonAIChat.tsx`, fonction locale `GoldCrawlersLogo` (lignes 14 à 36, id de dégradé `cocoonStrategistGoldGrad`). Elle est affichée en 18 px aux lignes 1774 (en-tête) et 2297 (bouton replié). L'icône lucide `Compass`, en ambre (`text-amber-400`), sert aux boutons secondaires (lignes 1793, 1895 et 2214). Ce n'est pas un avatar.
- Page d'accueil (section des agents IA) : `src/components/Homepage/AIAgentsSection.tsx`, autre copie de `GoldCrawlersLogo` (lignes 14 et suivantes, id `goldGrad`), affichée en 56 px à la ligne 168. Félix y utilise une troisième variante, `VioletRoundCrawlersLogo` (#a855f7, #7c3aed, #6d28d9).
- Page publique /stratege-cocoon : `src/pages/StrategeCocoon.tsx`, copie de `GoldCrawlersLogo` (id `goldGradLP`).
- Sélecteur Félix / Stratège sur /app/copilot (`CopilotPage.tsx` et `AgentChatShell.tsx`) : aucun logo, seulement des onglets texte.

## Code commun (seuls la taille et l'id changent)
```text
<svg viewBox="0 0 48 48">
  linearGradient x1=0% y1=0% x2=100% y2=100% :
    0%   #f5c842
    50%  #d4a853
    100% #b8860b
  <rect 48x48 rx=10 fill=dégradé/>
  <g stroke="#ffffff" strokeWidth=1.5 fill=none>
    Bot lucide : M12 8V4H8 | rect 4,8 16x12 rx2 | M2 14h2 | M20 14h2 | M9 13v2 | M15 13v2
  </g>
</svg>
```
La position du robot change selon le fichier : `translate(8.4, 8.4) scale(1.3)` sur la page /stratege-cocoon.

Rien n'est à construire. Approuver ou ignorer ce constat ne modifie aucun fichier.
