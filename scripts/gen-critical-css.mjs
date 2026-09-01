/**
 * Génère src/styles.critical.css : les règles nécessaires au premier rendu
 * (au-dessus de la ligne de flottaison de la home + header) extraites du CSS
 * public compilé. Inliné dans le <head> par src/routes/__root.tsx, il permet de
 * servir styles.css en non bloquant (media="print" + bascule JS).
 *
 * Usage : bun run build puis
 *   curl -s http://localhost:8080/ -o /tmp/home.html
 *   bun scripts/gen-critical-css.mjs
 */
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';

const ASSETS = 'dist/client/assets';
const cssFiles = fs
  .readdirSync(ASSETS)
  .filter((f) => f.startsWith('styles-') && f.endsWith('.css'))
  .map((f) => ({ f, size: fs.statSync(path.join(ASSETS, f)).size }))
  .sort((a, b) => b.size - a.size);

if (cssFiles.length === 0) throw new Error('Aucun styles-*.css dans dist/client/assets — lance un build.');

// le plus gros = styles.css (public) ; styles.app.css est le plus petit
const css = fs.readFileSync(path.join(ASSETS, cssFiles[0].f), 'utf8');
const html = fs.readFileSync(process.argv[2] ?? '/tmp/home.html', 'utf8');

const bodyStart = html.indexOf('<body');
// Fenêtre mobile : le header SSR contient aussi la navigation desktop et gonfle
// artificiellement l'extraction. On s'arrête avant le showcase, après le formulaire.
const ABOVE_WINDOW = Number(process.env.ABOVE_WINDOW ?? 19000);
const above = html.slice(bodyStart, bodyStart + ABOVE_WINDOW);

const classes = new Set();
for (const m of above.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach((c) => c && classes.add(c));
classes.delete('prose');

const tags = new Set();
for (const m of above.matchAll(/<([a-z][a-z0-9]*)/g)) tags.add(m[1]);

// Variantes inutiles au premier paint mobile : états d'interaction, animations,
// et breakpoints desktop repris par styles.css après son chargement.
const DROP = /:hover|:focus|:focus-visible|:active|:where\(\.group|prose|animate-|group-hover|peer-|data-\[state|\\@(lg|xl|2xl)|^\s*\.(lg|xl|2xl)\\:/;

const keepSel = (sel) => {
  if (DROP.test(sel)) return false;
  return sel.split(',').some((part) => {
    const cls = [...part.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
    if (cls.length === 0) {
      if (/:root|\*|::|html|body/.test(part)) return true;
      const tag = part.trim().match(/^([a-z][a-z0-9]*)/);
      return tag ? tags.has(tag[1]) : true;
    }
    return cls.every((c) => classes.has(c) || c === 'dark');
  });
};

const prune = (container) => {
  container.each((node) => {
    if (node.type === 'rule') {
      if (!keepSel(node.selector)) node.remove();
    } else if (node.type === 'atrule') {
      if (node.name === 'keyframes') return void node.remove();
      if (node.name === 'font-face') return;
      // Tailwind v4 émet 88 @property génériques (environ 5,7 Ko) ; aucun
      // n'est requis pour le rendu statique du header ou du hero.
      if (node.name === 'property') return void node.remove();
      if (/hover:hover/.test(node.params)) return void node.remove();
      // media queries desktop : inutiles au LCP mobile
      const mw = node.params.match(/min-width:\s*([\d.]+)rem/);
      if (node.name === 'media' && mw && Number(mw[1]) >= 64) return void node.remove();
      if (node.nodes) {
        prune(node);
        if (node.nodes.length === 0) node.remove();
      }
    }
  });
};

const root = postcss.parse(css);
prune(root);

// Tailwind imprime tout son thème (couleurs, tailles, animations) dans le CSS
// inline, même quand la home n'en utilise qu'une petite partie. On conserve
// uniquement les variables référencées par les règles critiques restantes.
const theme = root.nodes.find((node) => node.type === 'atrule' && node.name === 'layer' && node.params === 'theme');
const criticalBody = root.toString().replace(theme?.toString() ?? '', '');
if (theme) {
  theme.walkDecls((decl) => {
    if (!criticalBody.includes(`var(${decl.prop})`)) decl.remove();
  });
  theme.walkRules((rule) => {
    if (!rule.nodes?.length) rule.remove();
  });
}

const out = root.toString().replace(/\n\s*/g, '\n').trim();
fs.writeFileSync('src/styles.critical.css', out);
console.log(`src/styles.critical.css — ${(out.length / 1024).toFixed(1)} Ko (source ${cssFiles[0].f})`);
