import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { isSeoTacticText, resolveEditorialSubject, siteSellsSeo } from './editorialSubjectGuard.ts';

Deno.test('détecte les libellés de tactique SEO', () => {
  assertEquals(isSeoTacticText('Optimiser le placement du mot-clé dans la balise title'), true);
  assertEquals(isSeoTacticText('Renforcer le maillage interne'), true);
  assertEquals(isSeoTacticText('Rédiger un devis de plomberie conforme'), false);
});

Deno.test('crawlers.fr peut traiter la tactique comme sujet', () => {
  assertEquals(siteSellsSeo('crawlers.fr'), true);
  const r = resolveEditorialSubject({
    domain: 'crawlers.fr',
    task: { title: 'Front-loading sémantique de la balise title' },
  });
  assertEquals(r.ok, true);
});

Deno.test('dictadevi.io requalifie la tactique en sujet métier', () => {
  const r = resolveEditorialSubject({
    domain: 'dictadevi.io',
    task: {
      title: 'Optimiser le placement du mot-clé dans la balise title',
      metadata: { target_keywords: ['devis plomberie', 'balise title'] },
    },
  });
  if (!r.ok) throw new Error('devrait requalifier');
  assertEquals(r.subject, 'devis plomberie');
  assertEquals(r.source, 'business_keyword');
});

Deno.test('bloque quand aucun sujet métier disponible', () => {
  const r = resolveEditorialSubject({
    domain: 'dictadevi.io',
    task: { title: 'Ajouter des données structurées schema.org' },
  });
  assertEquals(r.ok, false);
});
