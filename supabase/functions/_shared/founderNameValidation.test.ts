import { describe, it, expect } from 'vitest';
import { isForeignBrandPerson, validateFounderCandidate } from './founderNameValidation.ts';

describe('garde-fou porte-parole', () => {
  it("refuse une personne de Crawlers sur un domaine tiers", () => {
    expect(isForeignBrandPerson('Adrien de Volontat', 'avenir-renovations.fr')).toBe(true);
    expect(isForeignBrandPerson('Michael Di Luca', 'https://www.arti-box.fr/contact')).toBe(true);
    expect(
      validateFounderCandidate(
        { name: 'Adrien de Volontat', url: 'https://linkedin.com/in/adrien-de-volontat', platform: 'linkedin' },
        'avenir-renovations.fr',
      ),
    ).toBeNull();
  });

  it("autorise ces mêmes personnes sur le domaine Crawlers", () => {
    expect(isForeignBrandPerson('Adrien de Volontat', 'crawlers.fr')).toBe(false);
    expect(
      validateFounderCandidate(
        { name: 'Adrien de Volontat', url: 'https://linkedin.com/in/adrien-de-volontat', platform: 'linkedin' },
        'www.crawlers.fr',
      ),
    ).toBe('Adrien de Volontat');
  });

  it('refuse un titre de publication au lieu d’un nom', () => {
    expect(
      validateFounderCandidate(
        { title: 'Un grand merci à Avenir Rénovations Vannes ! Je tiens', url: 'https://instagram.com/p/abc', platform: 'instagram' },
        'avenir-renovations.fr',
      ),
    ).toBeNull();
  });
});
