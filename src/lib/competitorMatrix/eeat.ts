// Analyse E-E-A-T de la matrice : 100 % déterministe, 0 token LLM.
// Chaque pilier n'est noté que sur les signaux réellement mesurés ; un signal
// non relevé est exclu du calcul au lieu d'être compté comme un échec.

import {
  EEAT_PILLAR_LABEL,
  type AuthorityReading,
  type BacklinkProfile,
  type EeatPillar,
  type EeatSignal,
} from './types';

export interface EeatPillarScore {
  pillar: EeatPillar;
  label: string;
  /** null quand aucun signal du pilier n'a pu être mesuré. */
  score: number | null;
  comment: string;
}

export interface BacklinkVerdict {
  level: 'sous_dote' | 'comparable' | 'avantage' | 'non_mesure';
  headline: string;
  detail: string;
  /** Domaines référents à gagner pour atteindre le rival médian. */
  referringDomainsToCatchUp: number | null;
}

export interface EeatAnalysis {
  /** null si rien n'a pu être mesuré. */
  score: number | null;
  pillars: EeatPillarScore[];
  signals: EeatSignal[];
  target: BacklinkProfile | null;
  rivals: BacklinkProfile[];
  backlinkVerdict: BacklinkVerdict;
  measuredAt: string | null;
}

export const BACKLINK_VERDICT_LABEL: Record<BacklinkVerdict['level'], string> = {
  sous_dote: 'Autorité inférieure au marché',
  comparable: 'Autorité comparable au marché',
  avantage: 'Autorité supérieure au marché',
  non_mesure: 'Autorité non mesurée',
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

function buildBacklinkVerdict(target: BacklinkProfile | null, rivals: BacklinkProfile[]): BacklinkVerdict {
  const rivalScores = rivals.map((r) => r.authorityScore).filter((n): n is number => n !== null);
  const rivalDomains = rivals.map((r) => r.referringDomains).filter((n): n is number => n !== null);
  const medScore = median(rivalScores);
  const medDomains = median(rivalDomains);

  if (!target || target.authorityScore === null || medScore === null) {
    return {
      level: 'non_mesure',
      headline: 'Profil de liens non mesuré',
      detail:
        'Le relevé de backlinks n’a pas abouti sur ce domaine ou sur ses concurrents : l’autorité n’entre donc pas dans le calcul de faisabilité des positions.',
      referringDomainsToCatchUp: null,
    };
  }

  const delta = target.authorityScore - medScore;
  const level: BacklinkVerdict['level'] = delta <= -10 ? 'sous_dote' : delta >= 10 ? 'avantage' : 'comparable';
  const toCatchUp =
    medDomains !== null && target.referringDomains !== null
      ? Math.max(0, medDomains - target.referringDomains)
      : null;

  const fmt = (n: number | null) => (n === null ? 'non mesuré' : n.toLocaleString('fr-FR'));

  return {
    level,
    headline:
      level === 'sous_dote'
        ? `Autorité ${target.authorityScore}/100 contre ${medScore}/100 pour le concurrent médian`
        : level === 'avantage'
          ? `Autorité ${target.authorityScore}/100, au-dessus du concurrent médian (${medScore}/100)`
          : `Autorité ${target.authorityScore}/100, au niveau du concurrent médian (${medScore}/100)`,
    detail: [
      `${fmt(target.referringDomains)} domaines référents et ${fmt(target.backlinks)} liens mesurés sur votre domaine, contre une médiane de ${fmt(medDomains)} domaines référents chez les concurrents relevés.`,
      target.linksPerDomain !== null
        ? `${target.linksPerDomain.toLocaleString('fr-FR')} liens par domaine référent : au-delà de 20, le profil est porté par peu de sources et pèse moins que sa volumétrie brute.`
        : '',
      target.dominantAnchorRatio !== null
        ? `Ancre la plus répétée : « ${target.dominantAnchor ?? 'non identifiée'} » sur ${Math.round(target.dominantAnchorRatio * 100)} % des liens de l’échantillon.`
        : '',
      target.brokenBacklinks
        ? `${target.brokenBacklinks.toLocaleString('fr-FR')} liens entrants pointent vers des pages en erreur : autorité perdue récupérable par redirection.`
        : '',
      level === 'sous_dote' && toCatchUp
        ? `Combler l’écart demande environ ${toCatchUp.toLocaleString('fr-FR')} domaines référents supplémentaires : c’est la raison pour laquelle les requêtes les plus difficiles sont classées en phase 2 ou écartées.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    referringDomainsToCatchUp: toCatchUp,
  };
}

/** Signaux E-E-A-T dérivés des pages servies et du profil de liens. */
function buildSignals(reading: AuthorityReading | null): EeatSignal[] {
  const p = reading?.onPage ?? null;
  const target = reading?.target ?? null;
  const rivals = reading?.rivals ?? [];
  const signals: EeatSignal[] = [];

  const onPageSignal = (
    key: string,
    pillar: EeatPillar,
    label: string,
    ok: boolean | null,
    okText: string,
    koText: string,
    weight: number,
  ) => {
    signals.push({
      key,
      pillar,
      label,
      status: ok === null ? 'not_measured' : ok ? 'ok' : 'missing',
      evidence: ok === null ? 'Page non récupérée : signal non mesuré.' : ok ? okText : koText,
      weight,
    });
  };

  const fetched = p?.fetched ? true : p ? false : null;
  const val = (v: boolean | undefined) => (fetched === null || fetched === false ? null : !!v);

  onPageSignal('proof', 'experience', 'Preuves de missions réelles', val(p?.hasProof),
    'Témoignages, études de cas ou réalisations détectés dans la page servie.',
    'Aucun témoignage, cas client ni réalisation détecté : rien ne prouve que le service a déjà été rendu.', 2);
  onPageSignal('dates', 'experience', 'Contenu daté', val(p?.hasDate),
    'Dates de publication ou de mise à jour présentes dans le HTML servi.',
    'Aucune date de publication ou de mise à jour : impossible de vérifier la fraîcheur du contenu.', 1);

  onPageSignal('person', 'expertise', 'Auteur balisé (Person / ProfilePage)', val(p?.hasPersonSchema),
    'Un nœud Person ou ProfilePage est exposé en JSON-LD.',
    'Aucun balisage Person ou ProfilePage : les moteurs ne rattachent le contenu à aucune personne.', 2);
  onPageSignal('author', 'expertise', 'Auteur nommé dans le texte', val(p?.hasAuthorMention),
    'Une personne physique est nommée comme auteur, fondateur ou dirigeant.',
    'Aucune personne nommée : le contenu paraît anonyme.', 1);
  signals.push({
    key: 'about-depth',
    pillar: 'expertise',
    label: 'Page « à propos » substantielle',
    status: p?.aboutWordCount == null ? 'not_measured' : p.aboutWordCount >= 300 ? 'ok' : 'missing',
    evidence:
      p?.aboutWordCount == null
        ? 'Aucune page « à propos » atteignable depuis l’accueil.'
        : `${p.aboutWordCount.toLocaleString('fr-FR')} mots sur ${p.aboutUrl}. Au-delà de 300 mots, la page tient le rôle de preuve d’identité attendu par les moteurs de réponse.`,
    weight: 1,
  });

  onPageSignal('org', 'trust', 'Identité balisée (Organization)', val(p?.hasOrganizationSchema),
    'Un nœud Organization ou LocalBusiness est exposé en JSON-LD.',
    'Aucun balisage Organization : l’entreprise n’est pas déclarée comme entité aux moteurs.', 2);
  onPageSignal('contact', 'trust', 'Page contact accessible', val(p?.hasContactLink),
    'Un lien de contact est présent dans la page servie.',
    'Aucun lien de contact détecté depuis l’accueil.', 1);
  onPageSignal('legal', 'trust', 'Mentions légales et confidentialité', val(p?.hasLegalLink),
    'Mentions légales, CGV ou politique de confidentialité liées.',
    'Aucune mention légale ni politique de confidentialité détectée.', 1);
  onPageSignal('identifier', 'trust', 'Identifiant d’entreprise publié', val(p?.hasCompanyIdentifier),
    'SIREN, SIRET, RCS ou numéro de TVA publié.',
    'Aucun identifiant légal publié : l’existence juridique n’est pas vérifiable dans le texte servi.', 1);
  onPageSignal('nap', 'trust', 'Téléphone ou adresse postale', val(p?.hasPhoneOrAddress),
    'Téléphone ou adresse postale présents dans la page.',
    'Ni téléphone ni adresse postale : point de confiance manquant pour les recherches locales.', 1);
  onPageSignal('https', 'trust', 'Connexion sécurisée', p ? p.https : null,
    'Le site est servi en HTTPS.', 'Le site n’est pas servi en HTTPS.', 1);

  const rivalScores = rivals.map((r) => r.authorityScore).filter((n): n is number => n !== null);
  const medScore = median(rivalScores);
  signals.push({
    key: 'authority-score',
    pillar: 'authoritativeness',
    label: 'Authority Score face au marché',
    status:
      target?.authorityScore == null || medScore === null
        ? 'not_measured'
        : target.authorityScore >= medScore
          ? 'ok'
          : 'missing',
    evidence:
      target?.authorityScore == null || medScore === null
        ? 'Profil de liens non relevé sur le domaine ou ses concurrents.'
        : `${target.authorityScore}/100 contre ${medScore}/100 pour le concurrent médian relevé.`,
    weight: 2,
  });

  const rivalDomains = rivals.map((r) => r.referringDomains).filter((n): n is number => n !== null);
  const medDomains = median(rivalDomains);
  signals.push({
    key: 'referring-domains',
    pillar: 'authoritativeness',
    label: 'Diversité des domaines référents',
    status:
      target?.referringDomains == null || medDomains === null
        ? 'not_measured'
        : target.referringDomains >= medDomains * 0.5
          ? 'ok'
          : 'missing',
    evidence:
      target?.referringDomains == null || medDomains === null
        ? 'Volumétrie de domaines référents non mesurée.'
        : `${target.referringDomains.toLocaleString('fr-FR')} domaines référents contre ${medDomains.toLocaleString('fr-FR')} pour le concurrent médian. Le seuil retenu est la moitié de la médiane : en dessous, les requêtes concurrentielles ne sont pas atteignables à court terme.`,
    weight: 3,
  });

  signals.push({
    key: 'anchor-nature',
    pillar: 'authoritativeness',
    label: 'Naturalité des ancres',
    status:
      target?.dominantAnchorRatio == null
        ? 'not_measured'
        : target.dominantAnchorRatio < 0.3
          ? 'ok'
          : 'missing',
    evidence:
      target?.dominantAnchorRatio == null
        ? 'Échantillon d’ancres indisponible.'
        : `L’ancre « ${target.dominantAnchor ?? 'non identifiée'} » représente ${Math.round(target.dominantAnchorRatio * 100)} % des liens de l’échantillon (seuil de vigilance : 30 %).`,
    weight: 1,
  });

  return signals;
}

const PILLAR_COMMENT: Record<EeatPillar, { low: string; high: string }> = {
  experience: {
    low: 'Les preuves d’expérience manquent : ajouter des cas clients datés et chiffrés est le geste le moins coûteux du plan.',
    high: 'Les preuves d’expérience sont visibles dans les pages servies.',
  },
  expertise: {
    low: 'Le contenu n’est rattaché à aucune personne identifiable : les moteurs de réponse écartent les sources anonymes.',
    high: 'Un auteur identifiable porte le contenu.',
  },
  authoritativeness: {
    low: 'La reconnaissance externe est en retard sur le marché : les requêtes les plus difficiles ne sont pas atteignables sans nouveaux domaines référents.',
    high: 'La reconnaissance externe soutient la comparaison avec les concurrents relevés.',
  },
  trust: {
    low: 'La transparence est incomplète : identité légale, contact et mentions doivent être vérifiables sans effort.',
    high: 'Les éléments de transparence attendus sont présents.',
  },
};

export function buildEeatAnalysis(reading: AuthorityReading | null): EeatAnalysis {
  const signals = buildSignals(reading);

  const pillars: EeatPillarScore[] = (Object.keys(EEAT_PILLAR_LABEL) as EeatPillar[]).map((pillar) => {
    const measured = signals.filter((s) => s.pillar === pillar && s.status !== 'not_measured');
    const total = measured.reduce((n, s) => n + s.weight, 0);
    const ok = measured.filter((s) => s.status === 'ok').reduce((n, s) => n + s.weight, 0);
    const score = total > 0 ? Math.round((ok / total) * 100) : null;
    return {
      pillar,
      label: EEAT_PILLAR_LABEL[pillar],
      score,
      comment:
        score === null
          ? 'Aucun signal mesuré pour ce pilier.'
          : score >= 60
            ? PILLAR_COMMENT[pillar].high
            : PILLAR_COMMENT[pillar].low,
    };
  });

  const scored = pillars.map((p) => p.score).filter((n): n is number => n !== null);

  return {
    score: scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
    pillars,
    signals,
    target: reading?.target ?? null,
    rivals: reading?.rivals ?? [],
    backlinkVerdict: buildBacklinkVerdict(reading?.target ?? null, reading?.rivals ?? []),
    measuredAt: reading?.measuredAt ?? null,
  };
}
