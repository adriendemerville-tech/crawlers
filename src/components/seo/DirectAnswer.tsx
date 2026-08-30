/**
 * Bloc « direct answer » (AEO / GEO).
 *
 * Placé tout en haut de page, sous le H1, avant tout visuel. Structure figée :
 *   - un H3 formulé exactement comme un prompt utilisateur ;
 *   - une réponse circonstanciée de deux à trois phrases maximum ;
 *   - des faits complémentaires répondant à qui / quoi / où / quand / combien /
 *     pourquoi, uniquement ceux pertinents pour le thème de la page ;
 *   - 450 mots maximum au total (garde en développement).
 *
 * Le texte doit être dérivé du contenu réel de la page, jamais inventé.
 */
import { useMemo } from 'react';

export type DirectAnswerFactLabel =
  | 'Qui'
  | 'Quoi'
  | 'Où'
  | 'Quand'
  | 'Combien'
  | 'Pourquoi'
  | 'Comment';

export interface DirectAnswerFact {
  label: DirectAnswerFactLabel;
  value: React.ReactNode;
}

interface DirectAnswerProps {
  /** Question formulée comme un prompt ("Comment savoir si GPTBot visite mon site ?"). */
  question: string;
  /** Réponse autoportante, 2 à 3 phrases maximum. */
  answer: React.ReactNode;
  /** Faits 5W pertinents pour le thème (facultatif, ordre libre). */
  facts?: DirectAnswerFact[];
  /** Chemin canonique de la page (ex. "/pagespeed") — alimente le JSON-LD Speakable. */
  path: string;
  className?: string;
}

const WORD_LIMIT = 450;

function countWords(node: React.ReactNode): number {
  if (node == null || typeof node === 'boolean') return 0;
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).trim().split(/\s+/).filter(Boolean).length;
  }
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + countWords(n), 0);
  const children = (node as { props?: { children?: React.ReactNode } })?.props?.children;
  return children ? countWords(children) : 0;
}

export function DirectAnswer({ question, answer, facts, path, className = '' }: DirectAnswerProps) {
  const total = useMemo(
    () => countWords(question) + countWords(answer) + (facts ?? []).reduce((s, f) => s + countWords(f.value) + 1, 0),
    [question, answer, facts],
  );

  if (import.meta.env.DEV && total > WORD_LIMIT) {
    console.warn(`[DirectAnswer] ${total} mots (> ${WORD_LIMIT}) — « ${question} »`);
  }

  const answerId = `da-${slug(question)}`;
  const speakableJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `https://crawlers.fr${path}`,
    url: `https://crawlers.fr${path}`,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: [`#${answerId}`, `#${answerId} + .citable-passage`],
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(speakableJsonLd)}</script>
    <section
      className={`direct-answer mx-auto max-w-3xl rounded-lg border border-primary/30 bg-card/60 p-5 text-left sm:p-6 ${className}`}
      aria-labelledby={answerId}
      data-direct-answer=""
    >
      <h3
        id={answerId}
        className="mb-3 text-base font-semibold leading-snug text-foreground sm:text-lg"
      >
        {question}
      </h3>
      <p className="citable-passage m-0 border-l-2 border-primary/60 pl-4 text-base leading-relaxed text-foreground">
        {answer}
      </p>
      {facts?.length ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-2">
              <dt className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="m-0 text-foreground/90">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
    </>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}
