import { describe, expect, it } from 'vitest';
import {
  classifyLink,
  isFalsePositiveDomain,
  summarizeVerdicts,
  describeLinkHealth,
} from '../../../supabase/functions/_shared/linkVerdict';

describe('linkVerdict — juge unique des liens', () => {
  it('classe 404 et 410 en lien cassé confirmé, remontable au premier constat', () => {
    for (const status of [404, 410, 451]) {
      const c = classifyLink({ url: 'https://exemple.fr/x', status });
      expect(c.verdict).toBe('hard_broken');
      expect(c.reportable).toBe(true);
      expect(c.provenance).toBe('mesure');
    }
  });

  it('ne remonte un 5xx qu au deuxième constat consécutif', () => {
    const first = classifyLink({ url: 'https://exemple.fr/x', status: 503, consecutiveFailures: 1 });
    expect(first.verdict).toBe('soft_broken');
    expect(first.reportable).toBe(false);

    const second = classifyLink({ url: 'https://exemple.fr/x', status: 503, consecutiveFailures: 2 });
    expect(second.verdict).toBe('soft_broken');
    expect(second.reportable).toBe(true);
  });

  it('traite 401/403/405/999 comme non vérifiable, jamais comme un défaut du site', () => {
    for (const status of [401, 403, 405, 406, 999]) {
      const c = classifyLink({ url: 'https://exemple.fr/x', status });
      expect(c.verdict).toBe('blocked');
      expect(c.reportable).toBe(false);
    }
  });

  it('traite un échec réseau comme instable, pas comme cassé', () => {
    const c = classifyLink({ url: 'https://exemple.fr/x', status: null });
    expect(c.verdict).toBe('soft_broken');
    expect(c.reportable).toBe(false);
  });

  it('classe 2xx et 3xx en lien valide', () => {
    for (const status of [200, 204, 301, 302]) {
      expect(classifyLink({ url: 'https://exemple.fr/x', status }).verdict).toBe('ok');
    }
  });

  it('reconnaît les domaines qui refusent les robots', () => {
    expect(isFalsePositiveDomain('https://www.linkedin.com/in/x')).toBe(true);
    expect(isFalsePositiveDomain('https://fr.linkedin.com/in/x')).toBe(true);
    expect(isFalsePositiveDomain('https://crawlers.fr/blog')).toBe(false);
    expect(isFalsePositiveDomain('pas-une-url')).toBe(false);
  });

  it('produit une synthèse unique, sans vocabulaire divergent', () => {
    const s = summarizeVerdicts([
      classifyLink({ url: 'https://a.fr', status: 404 }),
      classifyLink({ url: 'https://b.fr', status: 503, consecutiveFailures: 2 }),
      classifyLink({ url: 'https://c.fr', status: 403 }),
      classifyLink({ url: 'https://d.fr', status: 200 }),
    ]);
    expect(s).toMatchObject({ hard_broken: 1, soft_broken: 1, blocked: 1, ok: 1, reportable: 2 });
    expect(describeLinkHealth(s)).toBe('1 lien cassé, 1 lien instable, 1 non vérifiable.');
    expect(describeLinkHealth({ hard_broken: 0, soft_broken: 0, blocked: 0, ok: 5, reportable: 0 })).toBe(
      'Aucun lien cassé détecté.',
    );
  });
});
