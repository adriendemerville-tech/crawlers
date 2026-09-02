import { extractText, getDocumentProxy } from 'unpdf';

export type KbisCheck = {
  ok: boolean;
  siretFound: boolean;
  nameFound: boolean;
  textLength: number;
  reason: string | null;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Vérifie que le PDF Kbis mentionne bien le SIRET (ou SIREN) et la raison sociale de l'annuaire. */
export async function verifyKbisDocument(
  pdf: ArrayBuffer,
  siret: string,
  legalName: string,
): Promise<KbisCheck> {
  let raw = '';
  try {
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: true });
    raw = Array.isArray(text) ? text.join(' ') : text;
  } catch {
    return { ok: false, siretFound: false, nameFound: false, textLength: 0, reason: 'PDF illisible (document scanné ou protégé).' };
  }

  const digits = raw.replace(/[^0-9]/g, '');
  const flat = normalize(raw);
  if (flat.length < 200) {
    return { ok: false, siretFound: false, nameFound: false, textLength: flat.length, reason: 'Aucun texte exploitable dans le PDF (probablement scanné).' };
  }

  const siren = siret.slice(0, 9);
  const siretFound = digits.includes(siret) || digits.includes(siren);

  // Raison sociale : on exige la majorité des mots significatifs (>= 3 lettres).
  const words = normalize(legalName).split(' ').filter((w) => w.length >= 3);
  const matched = words.filter((w) => flat.includes(w)).length;
  const nameFound = words.length === 0 ? false : matched / words.length >= 0.6;

  const ok = siretFound && nameFound;
  return {
    ok,
    siretFound,
    nameFound,
    textLength: flat.length,
    reason: ok
      ? null
      : !siretFound
        ? 'Le SIRET/SIREN saisi n’apparaît pas dans le Kbis fourni.'
        : 'La raison sociale du Kbis ne correspond pas à celle de l’annuaire officiel.',
  };
}
