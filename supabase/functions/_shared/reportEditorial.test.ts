import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  cleanText,
  flatTableHTML,
  humanizeValue,
  findRawStructureArtifacts,
  stripRawStructureArtifacts,
} from './reportEditorial.ts';

// Distribution DataForSEO typique (referring_links_tld / countries / platform types)
const distribution = [
  { key: 'fr', count: 412, share: 0.6821 },
  { key: 'com', count: 128, share: 0.212 },
  { key: 'net', count: 34, share: 0.0563 },
  { key: 'org', count: 21, share: 0.0348 },
];

Deno.test('une distribution DataForSEO sort en tableau, pas en JSON', () => {
  const html = flatTableHTML(distribution)!;
  assertEquals(typeof html, 'string');
  assertEquals(html.includes('<table'), true);
  assertEquals(html.includes('<th'), true);
  // 4 lignes rendues, parts converties en pourcentage lisible
  assertEquals(html.split('<tr>').length - 1, 5); // en-tête + 4 lignes
  assertEquals(html.includes('68.2 %'), true);
  assertEquals(findRawStructureArtifacts(html), []);
});

Deno.test('un objet passé à un rendu scalaire ne produit jamais [object Object]', () => {
  const out = humanizeValue({ key: 'fr', count: 412, share: 0.68 });
  assertEquals(out.includes('[object Object]'), false);
  assertEquals(out.includes('fr'), true);
  assertEquals(cleanText({ key: 'fr', count: 2 }).includes('[object Object]'), false);
  assertEquals(cleanText(['fr', 'com']), 'fr, com');
});

Deno.test('findRawStructureArtifacts détecte un dump JSON et [object Object]', () => {
  assertEquals(
    findRawStructureArtifacts('<p>Répartition : {"tld":"fr","count":412}</p>').length > 0,
    true,
  );
  assertEquals(findRawStructureArtifacts('<p>[object Object]</p>').length, 1);
  assertEquals(
    findRawStructureArtifacts('<p>Répartition : [{"key":"fr"},{"key":"com"}]</p>').length > 0,
    true,
  );
  assertEquals(findRawStructureArtifacts('<p>Répartition mesurée : fr 68 %, com 21 %</p>'), []);
});

Deno.test('les blocs script/style ne sont ni signalés ni réécrits', () => {
  const html = '<style>.a{color:#111}</style><script>const d={"key":"fr"};</script><p>fr 68 %</p>';
  assertEquals(findRawStructureArtifacts(html), []);
  assertEquals(stripRawStructureArtifacts(html), html);
});

Deno.test('stripRawStructureArtifacts remplace le JSON résiduel par une mention lisible', () => {
  const out = stripRawStructureArtifacts('<p>Répartition : [{"key":"fr","share":0.68}]</p>');
  assertEquals(out, '<p>Répartition : donnée non exploitable</p>');
  assertEquals(findRawStructureArtifacts(out), []);
  const out2 = stripRawStructureArtifacts('<td>[object Object]</td>');
  assertEquals(out2, '<td>donnée non exploitable</td>');
});
