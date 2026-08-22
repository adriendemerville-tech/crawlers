/**
 * gmbListingAudit — moteur d'audit déterministe d'une fiche Google Business Profile
 * observée depuis l'extérieur (aucune propriété, aucun OAuth requis).
 *
 * Toutes les métriques proviennent de faits mesurés :
 *   - Places API (Details) pour la fiche,
 *   - HTML du site web déclaré pour la cohérence NAP et les signaux GEO.
 *
 * Ce qui n'est pas mesurable publiquement (impressions, clics, taux de réponse
 * aux avis, posts) est déclaré « non mesurable » et retiré du dénominateur :
 * jamais estimé, jamais inventé.
 *
 * Comme les audits Marina, le score est soumis à des plafonds de cohérence
 * (« gates ») : un fait bloquant mesuré ne peut pas coexister avec un score
 * confortable.
 */

/**
 * Plafond de cohérence, même forme que `_shared/auditGates.ts` côté audits Marina :
 * axe plafonné, cause lisible, preuve chiffrée, rang d'entrée.
 */
export interface AuditGate {
  axis: string;
  reason: string;
  evidence: string;
  source: 'technical' | 'geo';
  rank: number;
  measured?: string | null;
  target?: string | null;
}

export interface PlaceFacts {
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  /** Échantillon d'avis livré par Places (5 max). */
  reviews: Array<{ rating: number; time: number; text: string; author: string }>;
  types: string[];
  primary_category: string | null;
  business_status: string | null;
  has_hours: boolean;
  open_days: number;
  editorial_summary: string | null;
  photo_count: number;
  attributes_present: number;
  attributes_checked: number;
  kgmid: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
}

export interface WebsiteFacts {
  reachable: boolean;
  status: number | null;
  visible_text_chars: number;
  /** HTML servi sans texte exploitable (coquille JS). */
  render_shell: boolean;
  has_localbusiness_jsonld: boolean;
  has_opening_hours_jsonld: boolean;
  has_sameas_gmb: boolean;
  phone_match: boolean;
  city_match: boolean;
  name_match: boolean;
  has_citable_passage: boolean;
}

export interface AuditItem {
  field: string;
  label: string;
  points: number;
  max: number;
  measured: string;
  fix: string | null;
}

export interface AuditBlock {
  id: 'completeness' | 'reputation' | 'nap' | 'geo' | 'activity';
  label: string;
  score: number;
  max: number;
  /** Bloc non mesurable publiquement : exclu du dénominateur. */
  unmeasurable?: boolean;
  items: AuditItem[];
}

export interface GmbListingAudit {
  place: PlaceFacts;
  website: WebsiteFacts | null;
  blocks: AuditBlock[];
  total: number;
  max: number;
  percent: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gates: AuditGate[];
  priorities: Array<{ rank: number; label: string; why: string; impact: number }>;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

/** Vélocité d'avis : avis par mois sur l'échantillon daté fourni par Places. */
export function reviewVelocity(reviews: PlaceFacts['reviews']): number | null {
  const times = reviews.map((r) => r.time).filter((t) => t > 0).sort((a, b) => a - b);
  if (times.length < 2) return null;
  const spanMonths = (times[times.length - 1] - times[0]) / (60 * 60 * 24 * 30.44);
  if (spanMonths <= 0) return null;
  return Math.round(((times.length - 1) / spanMonths) * 10) / 10;
}

/** Mois écoulés depuis le dernier avis daté. */
export function monthsSinceLastReview(reviews: PlaceFacts['reviews']): number | null {
  const last = Math.max(0, ...reviews.map((r) => r.time || 0));
  if (!last) return null;
  return Math.round(((Date.now() / 1000 - last) / (60 * 60 * 24 * 30.44)) * 10) / 10;
}

export function auditGmbListing(place: PlaceFacts, website: WebsiteFacts | null): GmbListingAudit {
  const gates: AuditGate[] = [];

  // ── Bloc 1 — Complétude de la fiche (30) ─────────────────────────────
  const completeness: AuditItem[] = [
    {
      field: 'category', label: 'Catégorie principale', max: 6,
      points: place.primary_category ? 6 : 0,
      measured: place.primary_category ?? 'absente',
      fix: place.primary_category ? null : 'Définir la catégorie principale la plus précise : elle conditionne tout le pack local.',
    },
    {
      field: 'address', label: 'Adresse complète', max: 4,
      points: place.formatted_address ? (place.postal_code ? 4 : 2) : 0,
      measured: place.formatted_address ?? 'absente',
      fix: place.formatted_address && place.postal_code ? null : 'Compléter l\'adresse avec le code postal exact.',
    },
    {
      field: 'phone', label: 'Téléphone', max: 4,
      points: place.phone ? 4 : 0,
      measured: place.phone ?? 'absent',
      fix: place.phone ? null : 'Ajouter un numéro local : il déclenche l\'action « Appeler » depuis Maps.',
    },
    {
      field: 'website', label: 'Site web', max: 4,
      points: place.website ? 4 : 0,
      measured: place.website ?? 'absent',
      fix: place.website ? null : 'Relier un site web : sans lui la fiche ne transmet aucune autorité et l\'audit de cohérence est impossible.',
    },
    {
      field: 'hours', label: 'Horaires d\'ouverture', max: 4,
      points: place.has_hours ? (place.open_days >= 5 ? 4 : 2) : 0,
      measured: place.has_hours ? `${place.open_days} jour(s) renseigné(s)` : 'absents',
      fix: place.has_hours && place.open_days >= 5 ? null : 'Renseigner les horaires des 7 jours, jours de fermeture inclus.',
    },
    {
      field: 'description', label: 'Description de l\'établissement', max: 4,
      points: place.editorial_summary ? (place.editorial_summary.length >= 200 ? 4 : 2) : 0,
      measured: place.editorial_summary ? `${place.editorial_summary.length} caractères` : 'absente',
      fix: place.editorial_summary && place.editorial_summary.length >= 200
        ? null
        : 'Rédiger 500 à 750 caractères décrivant l\'activité et la zone servie, sans slogan.',
    },
    {
      field: 'photos', label: 'Photos', max: 4,
      points: place.photo_count >= 10 ? 4 : place.photo_count >= 5 ? 3 : place.photo_count >= 1 ? 1 : 0,
      measured: `${place.photo_count} photo(s) publiques`,
      fix: place.photo_count >= 10 ? null : 'Publier au moins 10 photos réelles : façade, intérieur, équipe, réalisations.',
    },
  ];

  // ── Bloc 2 — Réputation (25) ─────────────────────────────────────────
  const rating = place.rating ?? 0;
  const count = place.reviews_count ?? 0;
  const velocity = reviewVelocity(place.reviews);
  const lastReviewAge = monthsSinceLastReview(place.reviews);
  const ratingPts = rating >= 4.7 ? 10 : rating >= 4.4 ? 8 : rating >= 4.0 ? 6 : rating >= 3.5 ? 3 : rating > 0 ? 1 : 0;
  const volumePts = count >= 100 ? 8 : count >= 50 ? 6 : count >= 20 ? 4 : count >= 10 ? 2 : count > 0 ? 1 : 0;
  const velocityPts = velocity === null ? 0 : velocity >= 2 ? 4 : velocity >= 1 ? 3 : velocity >= 0.5 ? 2 : 1;
  const freshPts = lastReviewAge === null ? 0 : lastReviewAge <= 2 ? 3 : lastReviewAge <= 6 ? 2 : lastReviewAge <= 12 ? 1 : 0;

  const reputation: AuditItem[] = [
    {
      field: 'rating', label: 'Note moyenne', max: 10, points: ratingPts,
      measured: rating ? `${rating.toFixed(1)} / 5` : 'aucune note',
      fix: ratingPts >= 8 ? null : 'Objectif 4,5 : traiter les motifs récurrents d\'insatisfaction avant de solliciter de nouveaux avis.',
    },
    {
      field: 'reviews_volume', label: 'Volume d\'avis', max: 8, points: volumePts,
      measured: `${count} avis`,
      fix: volumePts >= 6 ? null : 'Mettre en place une sollicitation systématique après prestation (QR code, SMS, e-mail).',
    },
    {
      field: 'reviews_velocity', label: 'Vélocité des avis', max: 4, points: velocityPts,
      measured: velocity === null ? 'non datable sur l\'échantillon public' : `${velocity} avis/mois`,
      fix: velocityPts >= 3 ? null : 'Viser un flux régulier d\'au moins 2 avis par mois : Google valorise la régularité, pas les pics.',
    },
    {
      field: 'reviews_freshness', label: 'Fraîcheur du dernier avis', max: 3, points: freshPts,
      measured: lastReviewAge === null ? 'inconnue' : `${lastReviewAge} mois`,
      fix: freshPts >= 2 ? null : 'Un dernier avis ancien signale une fiche dormante : relancer la collecte.',
    },
  ];

  // ── Bloc 3 — Cohérence fiche ↔ site (20) ─────────────────────────────
  const napItems: AuditItem[] = website && website.reachable
    ? [
        {
          field: 'nap_name', label: 'Nom identique fiche / site', max: 4,
          points: website.name_match ? 4 : 0,
          measured: website.name_match ? 'concordant' : 'divergent',
          fix: website.name_match ? null : 'Afficher exactement le même nom commercial sur le site que sur la fiche.',
        },
        {
          field: 'nap_phone', label: 'Téléphone identique', max: 4,
          points: website.phone_match ? 4 : 0,
          measured: website.phone_match ? 'concordant' : 'introuvable ou divergent',
          fix: website.phone_match ? null : 'Publier le même numéro que la fiche, en clair dans le HTML (pas dans une image).',
        },
        {
          field: 'nap_city', label: 'Ville / adresse citée sur le site', max: 4,
          points: website.city_match ? 4 : 0,
          measured: website.city_match ? 'citée' : 'absente du HTML',
          fix: website.city_match ? null : 'Citer la ville et l\'adresse en texte sur la page d\'accueil et le pied de page.',
        },
        {
          field: 'nap_jsonld', label: 'JSON-LD LocalBusiness', max: 5,
          points: (website.has_localbusiness_jsonld ? 3 : 0) + (website.has_opening_hours_jsonld ? 2 : 0),
          measured: website.has_localbusiness_jsonld
            ? `présent${website.has_opening_hours_jsonld ? ' avec openingHoursSpecification' : ' sans horaires'}`
            : 'absent',
          fix: website.has_localbusiness_jsonld && website.has_opening_hours_jsonld
            ? null
            : 'Ajouter un JSON-LD LocalBusiness complet (address, telephone, openingHoursSpecification).',
        },
        {
          field: 'nap_sameas', label: 'sameAs vers la fiche Google', max: 3,
          points: website.has_sameas_gmb ? 3 : 0,
          measured: website.has_sameas_gmb ? 'présent' : 'absent',
          fix: website.has_sameas_gmb ? null : 'Déclarer la fiche Google dans sameAs pour lier explicitement site et entité.',
        },
      ]
    : [];

  // ── Bloc 4 — Signaux GEO / IA (15) ───────────────────────────────────
  const geoItems: AuditItem[] = [
    {
      field: 'geo_entity', label: 'Entité résolue par Google', max: 5,
      points: place.kgmid ? 5 : 2,
      measured: place.kgmid ? `Knowledge Graph ${place.kgmid}` : 'pas d\'identifiant Knowledge Graph observé',
      fix: place.kgmid ? null : 'Consolider l\'entité : nom stable, JSON-LD Organization, citations externes cohérentes.',
    },
    {
      field: 'geo_text', label: 'Texte exploitable par les moteurs IA', max: 5,
      points: !website || !website.reachable ? 0
        : website.render_shell ? 0
        : website.visible_text_chars >= 3000 ? 5
        : website.visible_text_chars >= 1200 ? 3 : 1,
      measured: !website || !website.reachable
        ? 'site non joignable'
        : website.render_shell
          ? 'HTML sans texte servi (contenu généré par JavaScript)'
          : `${website.visible_text_chars} caractères de texte servi`,
      fix: website && !website.render_shell && website.visible_text_chars >= 3000
        ? null
        : 'Servir le texte dans le HTML initial : les moteurs IA ne citent que ce qu\'ils reçoivent sans exécuter le JavaScript.',
    },
    {
      field: 'geo_citable', label: 'Passages citables (faits, chiffres, zone servie)', max: 5,
      points: website?.has_citable_passage ? 5 : 0,
      measured: website?.has_citable_passage ? 'présents' : 'absents',
      fix: website?.has_citable_passage ? null : 'Ajouter des passages factuels courts et autonomes (zone d\'intervention, délais, tarifs, certifications).',
    },
  ];

  // ── Bloc 5 — Activité et statut (10) ─────────────────────────────────
  const activityItems: AuditItem[] = [
    {
      field: 'status', label: 'Statut de l\'établissement', max: 6,
      points: place.business_status === 'OPERATIONAL' ? 6 : place.business_status ? 0 : 3,
      measured: place.business_status ?? 'inconnu',
      fix: place.business_status === 'OPERATIONAL' ? null : 'Statut non opérationnel sur Google : la fiche est retirée des résultats locaux.',
    },
    {
      field: 'attributes', label: 'Attributs renseignés', max: 4,
      points: place.attributes_checked === 0 ? 0 : clamp((place.attributes_present / place.attributes_checked) * 4, 4),
      measured: `${place.attributes_present}/${place.attributes_checked} attributs publics détectés`,
      fix: place.attributes_present >= place.attributes_checked ? null : 'Renseigner tous les attributs pertinents (accessibilité, paiement, services sur place).',
    },
  ];

  const blocks: AuditBlock[] = [
    { id: 'completeness', label: 'Complétude de la fiche', max: 30, score: 0, items: completeness },
    { id: 'reputation', label: 'Réputation', max: 25, score: 0, items: reputation },
    {
      id: 'nap', label: 'Cohérence fiche ↔ site', max: 20, score: 0,
      items: napItems, unmeasurable: napItems.length === 0,
    },
    { id: 'geo', label: 'Signaux GEO / IA', max: 15, score: 0, items: geoItems },
    { id: 'activity', label: 'Activité et statut', max: 10, score: 0, items: activityItems },
  ];

  for (const b of blocks) b.score = clamp(b.items.reduce((s, i) => s + i.points, 0), b.max);

  // ── Plafonds de cohérence ────────────────────────────────────────────
  const cap = (id: AuditBlock['id'], value: number) => {
    const b = blocks.find((x) => x.id === id)!;
    if (b.score > value) b.score = value;
  };

  if (place.business_status && place.business_status !== 'OPERATIONAL') {
    gates.push({
      axis: 'technical', source: 'technical', rank: 1,
      reason: 'La fiche n\'est pas déclarée opérationnelle par Google.',
      evidence: `statut « ${place.business_status} » → cible « OPERATIONAL » (score global bridé à 40/100)`,
      measured: place.business_status, target: 'OPERATIONAL',
    });
  }
  if (!place.primary_category) {
    gates.push({
      axis: 'technical', source: 'technical', rank: 1,
      reason: 'Aucune catégorie principale : Google ne sait pas sur quelles requêtes présenter la fiche.',
      evidence: 'catégorie absente → 1 catégorie principale précise requise (score global bridé à 65/100)',
      measured: 'absente', target: '1 catégorie précise',
    });
  }
  if (!place.website) {
    gates.push({
      axis: 'geo_comprehension', source: 'geo', rank: 2,
      reason: 'Aucun site web relié : la fiche ne peut ni transmettre ni recevoir d\'autorité.',
      evidence: 'site web absent → 1 URL canonique requise (bloc cohérence non mesurable, global bridé à 70/100)',
      measured: 'absent', target: '1 URL',
    });
  }
  if (website?.render_shell) {
    gates.push({
      axis: 'geo_quotability', source: 'geo', rank: 2,
      reason: 'Le site renvoie un HTML sans texte : les moteurs IA n\'ont rien à citer.',
      evidence: `${website.visible_text_chars} caractères servis → au moins 1 200 attendus (bloc GEO plafonné à 5/15)`,
      measured: `${website.visible_text_chars} caractères`, target: '≥ 1 200 caractères',
    });
    cap('geo', 5);
  }
  if (!place.has_hours) {
    gates.push({
      axis: 'technical', source: 'technical', rank: 1,
      reason: 'Horaires absents : Google déclasse les fiches dont la disponibilité est inconnue.',
      evidence: 'aucun horaire → 7 jours renseignés attendus (score global bridé à 80/100)',
      measured: '0 jour', target: '7 jours',
    });
  }
  if (count < 10 || (rating > 0 && rating < 4.0)) {
    gates.push({
      axis: 'semantic', source: 'technical', rank: 3,
      reason: 'Signal de réputation insuffisant pour concourir dans le pack local.',
      evidence: `${count} avis à ${rating ? rating.toFixed(1) : '—'}/5 → au moins 10 avis à 4,0 (bloc réputation plafonné à 10/25)`,
      measured: `${count} avis · ${rating ? rating.toFixed(1) : '—'}/5`, target: '≥ 10 avis · ≥ 4,0',
    });
    cap('reputation', 10);
  }

  const measuredBlocks = blocks.filter((b) => !b.unmeasurable);
  const max = measuredBlocks.reduce((s, b) => s + b.max, 0);
  let total = measuredBlocks.reduce((s, b) => s + b.score, 0);
  let percent = max > 0 ? Math.round((total / max) * 100) : 0;

  // Bridages globaux (le plus contraignant gagne)
  const globalCaps: number[] = [];
  if (place.business_status && place.business_status !== 'OPERATIONAL') globalCaps.push(40);
  if (!place.primary_category) globalCaps.push(65);
  if (!place.website) globalCaps.push(70);
  if (!place.has_hours) globalCaps.push(80);
  if (globalCaps.length) {
    const capValue = Math.min(...globalCaps);
    if (percent > capValue) {
      percent = capValue;
      total = Math.round((capValue / 100) * max);
      gates.push({
        axis: 'total', source: 'technical', rank: 8,
        reason: 'Score global bridé par au moins un défaut bloquant mesuré ci-dessus.',
        evidence: `plafond appliqué : ${capValue}/100`,
        measured: `${percent}/100`, target: `${capValue}/100`,
      });
    }
  }

  const grade: GmbListingAudit['grade'] =
    percent >= 90 ? 'A' : percent >= 75 ? 'B' : percent >= 60 ? 'C' : percent >= 40 ? 'D' : 'F';

  // ── Priorités : gates d'abord, puis pertes de points décroissantes ────
  const priorities: GmbListingAudit['priorities'] = [];
  for (const g of [...gates].sort((a, b) => a.rank - b.rank)) {
    priorities.push({ rank: priorities.length + 1, label: g.reason, why: g.evidence, impact: 0 });
  }
  const losses = blocks
    .filter((b) => !b.unmeasurable)
    .flatMap((b) => b.items.map((i) => ({ ...i, block: b.label })))
    .filter((i) => i.fix && i.points < i.max)
    .sort((a, b) => (b.max - b.points) - (a.max - a.points))
    .slice(0, 6);
  for (const l of losses) {
    priorities.push({
      rank: priorities.length + 1,
      label: `${l.block} — ${l.fix}`,
      why: `${l.label} : ${l.measured} (${l.points}/${l.max} points)`,
      impact: l.max - l.points,
    });
  }

  return { place, website, blocks, total, max, percent, grade, gates, priorities };
}
