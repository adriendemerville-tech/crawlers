/**
 * Diagnostic Parmenion — 100 % déterministe, aucun appel LLM.
 * On récupère la page une fois, on en tire 6 à 10 constats corrigeables
 * formulés sans jargon, puis les correctifs et les 3 sujets de contenu.
 */

export interface PasseFinding {
  id: string;
  label: string;
  detail: string;
  impact: "fort" | "moyen" | "faible";
  fixable: boolean;
}

export interface PasseDiagnostic {
  url: string;
  host: string;
  brand: string;
  score: number;
  findings: PasseFinding[];
  fetchedAt: string;
  unreachable?: boolean;
}

export interface PasseFix {
  findingId: string;
  label: string;
  before: string;
  after: string;
  scope: "page" | "contenu" | "fiche" | "recommandation";
}

const UA =
  "Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr/passe-visibilite)";

export function normalizeUrl(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export function brandFromHost(host: string): string {
  const bare = host.replace(/^www\./, "").split(".")[0] ?? host;
  return bare.replace(/[-_]+/g, " ").trim();
}

export async function runDiagnostic(url: string): Promise<PasseDiagnostic> {
  const target = normalizeUrl(url);
  const host = target ? new URL(target).hostname : url;
  const base: PasseDiagnostic = {
    url: target ?? url,
    host,
    brand: brandFromHost(host),
    score: 0,
    findings: [],
    fetchedAt: new Date().toISOString(),
  };
  if (!target) return { ...base, unreachable: true };

  let html = "";
  let httpsOk = target.startsWith("https:");
  try {
    const res = await fetch(target, {
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(9000),
    });
    httpsOk = res.url.startsWith("https:");
    html = (await res.text()).slice(0, 400_000);
  } catch {
    return { ...base, unreachable: true, findings: [
      {
        id: "unreachable",
        label: "Votre page n'a pas pu être chargée",
        detail: "Le serveur n'a pas répondu à temps. Une page lente ou indisponible n'est ni lue par Google ni par les assistants IA.",
        impact: "fort",
        fixable: false,
      },
    ] };
  }

  const title = stripTags(
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "",
  );
  const description =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html)?.[1] ??
    "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    stripTags(m[1] ?? ""),
  );
  const h2count = [...html.matchAll(/<h2[^>]*>/gi)].length;
  const text = stripTags(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesWithoutAlt = images.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  const hasJsonLd = /application\/ld\+json/i.test(html);
  const hasLocalBusiness = /"@type"\s*:\s*"(LocalBusiness|Organization|ProfessionalService|Store)"/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasOg = /property=["']og:title["']/i.test(html);
  const internalLinks = [...html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => m[1] ?? "")
    .filter((href) => href.startsWith("/") || href.includes(host)).length;
  const phoneOrAddress = /(\+33|0[1-9](?:[\s.-]?\d{2}){4})/.test(text);

  const f: PasseFinding[] = [];
  const add = (
    id: string,
    label: string,
    detail: string,
    impact: PasseFinding["impact"],
    fixable = true,
  ) => f.push({ id, label, detail, impact, fixable });

  if (!title) add("title_missing", "Votre page n'a pas de titre", "Le titre est la première chose lue par Google et par les IA. Sans lui, votre page est presque invisible.", "fort");
  else if (title.length < 30) add("title_short", "Votre titre est trop court", `Titre actuel : « ${title} ». Un titre de 50 à 60 caractères, avec votre métier et votre ville, attire beaucoup plus de clics.`, "fort");
  else if (title.length > 65) add("title_long", "Votre titre est coupé dans Google", `Titre actuel : ${title.length} caractères. Au-delà de 60, la fin n'est plus affichée.`, "moyen");

  if (!description) add("desc_missing", "Aucune description dans les résultats de recherche", "Google écrit alors une phrase au hasard depuis votre page. Une description rédigée augmente nettement les clics.", "fort");
  else if (description.length < 70) add("desc_short", "Votre description est trop courte", `Description actuelle : ${description.length} caractères. Visez 140 à 160 caractères avec une promesse claire.`, "moyen");

  if (h1s.length === 0) add("h1_missing", "Votre page n'a pas de titre principal visible", "Le titre principal indique le sujet de la page. Sans lui, moteurs et assistants doivent devinerv.", "fort");
  else if (h1s.length > 1) add("h1_multiple", "Plusieurs titres principaux sur la même page", `${h1s.length} titres principaux détectés : le sujet de la page devient ambigu.`, "moyen");
  else if (title && jaccard(normalizeWords(title), normalizeWords(h1s[0] ?? "")) >= 0.8) add("h1_duplicate", "Votre titre et votre titre principal sont identiques", "Deux formulations différentes couvrent deux fois plus de recherches.", "moyen");

  if (words < 300) add("thin_content", "Votre page contient très peu de texte", `Environ ${words} mots. En dessous de 300 mots, ni Google ni les assistants n'ont matière à vous citer.`, "fort");

  if (h2count < 2) add("structure_flat", "Votre page n'a pas de sous-titres", "Des sous-titres formulés comme des questions sont ce que les IA reprennent le plus volontiers.", "moyen");

  if (!hasJsonLd || !hasLocalBusiness) add("schema_missing", "Vos informations d'entreprise ne sont pas balisées", "Le balisage entreprise (nom, adresse, horaires, avis) permet d'apparaître en résultat enrichi et d'être repris par les assistants.", "fort");

  if (imagesWithoutAlt > 0) add("images_alt", "Des images sans description", `${imagesWithoutAlt} image(s) sans texte alternatif : elles ne sont ni comprises ni indexées.`, "faible");

  if (!hasCanonical) add("canonical_missing", "Aucune adresse de référence déclarée", "Sans adresse de référence, plusieurs versions de la même page peuvent se concurrencer.", "moyen");

  if (!hasViewport) add("viewport_missing", "Votre page n'est pas déclarée compatible mobile", "La majorité des visites vient du téléphone.", "fort");

  if (!hasOg) add("social_missing", "Aucun aperçu lors des partages", "Sans aperçu, vos liens partagés sur les réseaux ou par messagerie n'affichent ni image ni titre.", "faible");

  if (internalLinks < 5) add("mesh_thin", "Trop peu de liens entre vos pages", `${internalLinks} lien(s) interne(s) détecté(s). Les liens internes guident les visiteurs et les moteurs vers vos pages qui vendent.`, "moyen");

  if (!httpsOk) add("https_missing", "Votre site n'est pas en connexion sécurisée", "Les navigateurs affichent un avertissement, ce qui fait fuir les visiteurs.", "fort", false);

  if (!phoneOrAddress) add("contact_missing", "Ni téléphone ni adresse repérés sur la page", "Ces informations sont indispensables pour être proposé dans les recherches locales.", "moyen");

  const order = { fort: 0, moyen: 1, faible: 2 } as const;
  const findings = f.sort((a, b) => order[a.impact] - order[b.impact]).slice(0, 10);

  const penalty = findings.reduce(
    (sum, x) => sum + (x.impact === "fort" ? 12 : x.impact === "moyen" ? 6 : 3),
    0,
  );
  const score = Math.max(5, Math.min(98, 100 - penalty));

  return { ...base, score, findings };
}

/** Correctifs déduits du diagnostic — périmètre borné, aucune promesse d'illimité. */
export function deriveFixes(diag: PasseDiagnostic): PasseFix[] {
  const brand = diag.brand || diag.host;
  const map: Record<string, PasseFix> = {
    title_missing: { findingId: "title_missing", label: "Écriture du titre de page", before: "Aucun titre", after: `${brand} — métier et ville dans un titre de 55 caractères`, scope: "page" },
    title_short: { findingId: "title_short", label: "Réécriture du titre de page", before: "Titre trop court", after: "Titre de 50 à 60 caractères, métier et zone d'intervention", scope: "page" },
    title_long: { findingId: "title_long", label: "Raccourcissement du titre", before: "Titre coupé dans Google", after: "Titre lisible en entier", scope: "page" },
    desc_missing: { findingId: "desc_missing", label: "Rédaction de la description", before: "Aucune description", after: "Description de 150 caractères avec promesse et appel à l'action", scope: "page" },
    desc_short: { findingId: "desc_short", label: "Réécriture de la description", before: "Description trop courte", after: "Description de 140 à 160 caractères", scope: "page" },
    h1_missing: { findingId: "h1_missing", label: "Ajout du titre principal", before: "Aucun titre principal", after: "Un titre principal unique et explicite", scope: "page" },
    h1_multiple: { findingId: "h1_multiple", label: "Un seul titre principal", before: "Plusieurs titres principaux", after: "Un titre principal, les autres passés en sous-titres", scope: "page" },
    h1_duplicate: { findingId: "h1_duplicate", label: "Différenciation titre / titre principal", before: "Formulations identiques", after: "Deux formulations complémentaires", scope: "page" },
    thin_content: { findingId: "thin_content", label: "Enrichissement du contenu", before: "Page trop courte", after: "3 pages rédigées et publiées sur vos sujets porteurs", scope: "contenu" },
    structure_flat: { findingId: "structure_flat", label: "Ajout de sous-titres en questions", before: "Aucun sous-titre", after: "Sous-titres formulés comme les questions de vos clients", scope: "page" },
    schema_missing: { findingId: "schema_missing", label: "Balisage de vos informations d'entreprise", before: "Aucun balisage", after: "Balisage entreprise complet : nom, adresse, horaires, téléphone", scope: "page" },
    images_alt: { findingId: "images_alt", label: "Description des images", before: "Images sans description", after: "Description ajoutée sur chaque image de la page", scope: "page" },
    canonical_missing: { findingId: "canonical_missing", label: "Adresse de référence déclarée", before: "Absente", after: "Adresse de référence unique par page", scope: "page" },
    viewport_missing: { findingId: "viewport_missing", label: "Compatibilité mobile déclarée", before: "Absente", after: "Déclaration mobile ajoutée", scope: "page" },
    social_missing: { findingId: "social_missing", label: "Aperçu de partage", before: "Aucun aperçu", after: "Titre, description et image d'aperçu", scope: "page" },
    mesh_thin: { findingId: "mesh_thin", label: "Liens entre vos pages", before: "Trop peu de liens internes", after: "Liens ajoutés depuis et vers les 3 nouvelles pages", scope: "contenu" },
    contact_missing: { findingId: "contact_missing", label: "Coordonnées visibles et balisées", before: "Ni téléphone ni adresse repérés", after: "Téléphone, adresse et horaires visibles et balisés", scope: "fiche" },
    https_missing: { findingId: "https_missing", label: "Connexion sécurisée", before: "Site en http", after: "À activer chez votre hébergeur — recommandation, hors périmètre de la passe", scope: "recommandation" },
    unreachable: { findingId: "unreachable", label: "Disponibilité du site", before: "Page injoignable", after: "À vérifier avec votre hébergeur — recommandation", scope: "recommandation" },
  };

  const fixes = diag.findings.map((x) => map[x.id]).filter((x): x is PasseFix => Boolean(x));

  // Toujours inclus dans la passe, quel que soit le diagnostic.
  fixes.push({
    findingId: "gmb_optimization",
    label: "Optimisation de votre fiche Google Maps",
    before: "Fiche non optimisée",
    after: "Description, catégories, horaires, site web et une publication",
    scope: "fiche",
  });
  return fixes;
}

/** 3 sujets de contenu déduits du diagnostic — jamais une tactique SEO comme sujet. */
export function deriveTopics(diag: PasseDiagnostic): string[] {
  const brand = diag.brand || diag.host;
  return [
    `Nos prestations : ce que ${brand} réalise concrètement, étape par étape`,
    `Combien coûte une intervention de ${brand} et ce qui fait varier le prix`,
    `Comment choisir son prestataire : les questions à poser avant de signer`,
  ];
}
