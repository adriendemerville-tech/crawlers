import { describe, it, expect } from 'vitest';
import { dedupeWhy, isEmptyBody, tightenTitle } from './networkSynthesis';
import { mergeMarinaReports } from './mergeReports';

describe('dedupeWhy', () => {
  it('supprime la justification identique au titre', () => {
    expect(dedupeWhy('Traiter le LCP du gabarit /ville', 'Traiter le LCP du gabarit /ville')).toBe('');
  });

  it('retire la reprise littérale du titre en tête de justification', () => {
    expect(
      dedupeWhy(
        'Absorber les 3 pages en contenu trop fin',
        'Absorber les 3 pages en contenu trop fin : elles diluent le gabarit.',
      ),
    ).toBe('Elles diluent le gabarit.');
  });

  it('laisse intacte une justification distincte', () => {
    const why = 'Le maillage interne ne relie aucune de ces pages entre elles.';
    expect(dedupeWhy('Relier entre elles les 4 pages du lot', why)).toBe(why);
  });
});

function page(url: string, conclusion: string): { url: string; html: string } {
  return {
    url,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head><body>
      <div data-marina-scope="page" data-marina-block="conclusion">${conclusion}</div>
    </body></html>`,
  };
}

describe('mergeMarinaReports — conclusions inter-pages', () => {
  it("ne répète pas une conclusion strictement identique et renvoie à la fiche d'origine", () => {
    const html = mergeMarinaReports([
      page('https://exemple.fr/a', '<p>Conclusion strictement identique.</p>'),
      page('https://exemple.fr/b', '<p>Conclusion strictement identique.</p>'),
    ]);
    const occurrences = html.split('Conclusion strictement identique.').length - 1;
    expect(occurrences).toBe(1);
    expect(html).toContain('Conclusion intermédiaire identique');
  });

  it('conserve deux conclusions différentes', () => {
    const html = mergeMarinaReports([
      page('https://exemple.fr/a', '<p>Première conclusion.</p>'),
      page('https://exemple.fr/b', '<p>Seconde conclusion.</p>'),
    ]);
    expect(html).toContain('Première conclusion.');
    expect(html).toContain('Seconde conclusion.');
    expect(html).not.toContain('Conclusion intermédiaire identique');
  });

  it('ne laisse aucun identifiant technique dans le sommaire', () => {
    const site = (id: string) =>
      `<!DOCTYPE html><html lang="fr"><head></head><body>
        <div data-marina-scope="site" data-marina-block="${id}"><p>Bloc ${id}</p></div>
        <div data-marina-scope="page" data-marina-block="conclusion"><p>c</p></div>
      </body></html>`;
    const html = mergeMarinaReports([
      { url: 'https://exemple.fr/a', html: site('identity') },
      { url: 'https://exemple.fr/b', html: site('host-duplication') },
    ]);
    expect(html).toContain('Identité du site');
    expect(html).not.toMatch(/>host-duplication</);
  });
});

describe('Lot A — ancres du sommaire', () => {
  const doc = (id: string) =>
    `<!DOCTYPE html><html lang="fr"><head></head><body>
      <div data-marina-scope="site" data-marina-block="${id}"><p>Bloc ${id}</p></div>
      <div data-marina-scope="page" data-marina-block="conclusion"><p>c</p></div>
    </body></html>`;

  it('chaque entrée du sommaire pointe vers une ancre présente dans le document', () => {
    const html = mergeMarinaReports([
      { url: 'https://exemple.fr/a', html: doc('crawl') },
      { url: 'https://exemple.fr/b', html: doc('cocoon') },
    ]);
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(html).toContain(`id="${t}"`);
    }
    expect(targets).toContain('fiche-1');
    expect(targets).toContain('fiche-2');
  });
});

describe('Lot B — titres et blocs vides', () => {
  it('rend les jointures fragiles des titres insécables', () => {
    expect(tightenTitle('Concurrence interne entre les pages auditées')).toContain('&nbsp;');
    expect(tightenTitle('Périmètre')).toBe('Périmètre');
  });

  it('détecte un corps de bloc sans texte lisible', () => {
    expect(isEmptyBody('<p style="margin:0"> &nbsp; </p>')).toBe(true);
    expect(isEmptyBody('<p>Un fait mesuré.</p>')).toBe(false);
  });
});
