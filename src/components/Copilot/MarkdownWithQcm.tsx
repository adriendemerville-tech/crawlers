/**
 * MarkdownWithQcm — Rendu markdown enrichi qui détecte les QCM générés par
 * le LLM (lignes A) B) C) D)…) et les transforme en boutons cliquables.
 *
 * Si une ligne "Réponse : X" suit le bloc, la bonne réponse est révélée
 * après le clic. Sinon, le clic sélectionne simplement l'option.
 *
 * Charte : noir/blanc/violet/jaune d'or, boutons sans fond.
 */
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QcmOption {
  letter: string;
  text: string;
}

interface QcmBlock {
  type: 'qcm';
  question?: string;
  options: QcmOption[];
  correctLetter?: string;
}

interface MdBlock {
  type: 'md';
  content: string;
}

type Block = QcmBlock | MdBlock;

// Accepte: "A) ...", "A. ...", "**A)** ...", "- A) ..."
const OPTION_RE = /^\s*[-*]?\s*\*{0,2}([A-D])[).]\*{0,2}\s+(.+?)\s*$/;
const ANSWER_RE = /(?:Bonne\s+)?[Rr]éponse(?:\s+correcte)?\s*[:=]\s*\*{0,2}([A-D])\*{0,2}/;

export function parseQcm(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let mdBuf: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const m = OPTION_RE.exec(lines[i]);
    if (m && m[1] === 'A') {
      const opts: QcmOption[] = [];
      let j = i;
      let expected = 'A'.charCodeAt(0);
      while (j < lines.length) {
        const lm = OPTION_RE.exec(lines[j]);
        if (!lm || lm[1].charCodeAt(0) !== expected) break;
        opts.push({ letter: lm[1], text: lm[2].replace(/\*\*/g, '').trim() });
        expected++;
        j++;
      }
      if (opts.length >= 2) {
        // récupère la dernière ligne non-vide comme question
        let question: string | undefined;
        for (let k = mdBuf.length - 1; k >= 0; k--) {
          const t = mdBuf[k].trim();
          if (t) {
            question = t.replace(/^[#>\s*_-]+/, '').replace(/\*\*/g, '').trim();
            mdBuf = mdBuf.slice(0, k);
            break;
          }
        }
        if (mdBuf.length) blocks.push({ type: 'md', content: mdBuf.join('\n') });
        mdBuf = [];
        blocks.push({ type: 'qcm', question, options: opts });
        i = j;
        continue;
      }
    }
    mdBuf.push(lines[i]);
    i++;
  }
  if (mdBuf.length) blocks.push({ type: 'md', content: mdBuf.join('\n') });

  // Rattache une éventuelle "Réponse : X" au QCM précédent et la masque.
  for (let k = 0; k < blocks.length; k++) {
    const blk = blocks[k];
    if (blk.type !== 'qcm') continue;
    for (let l = k + 1; l < blocks.length; l++) {
      const nxt = blocks[l];
      if (nxt.type !== 'md') continue;
      const am = ANSWER_RE.exec(nxt.content);
      if (am) {
        blk.correctLetter = am[1];
        nxt.content = nxt.content.replace(ANSWER_RE, '').trim();
        break;
      }
      if (nxt.content.trim()) break;
    }
  }

  return blocks;
}

function QcmInteractive({ block }: { block: QcmBlock }) {
  const [picked, setPicked] = useState<string | null>(null);
  const revealed = picked !== null;
  const hasAnswer = !!block.correctLetter;

  return (
    <div className="my-3 space-y-2">
      {block.question && (
        <p className="text-sm font-medium text-foreground">{block.question}</p>
      )}
      <div className="space-y-1.5">
        {block.options.map((opt) => {
          const isPicked = picked === opt.letter;
          const isCorrect = block.correctLetter === opt.letter;
          let cls = 'border-border hover:border-foreground/60 cursor-pointer';
          if (revealed) {
            if (hasAnswer && isCorrect) {
              cls = 'border-emerald-500/60 bg-emerald-500/10';
            } else if (hasAnswer && isPicked) {
              cls = 'border-destructive/60 bg-destructive/10';
            } else if (isPicked) {
              cls = 'border-primary';
            } else {
              cls = 'border-border opacity-60';
            }
          }
          return (
            <button
              key={opt.letter}
              type="button"
              disabled={revealed}
              onClick={() => setPicked(opt.letter)}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm text-foreground transition disabled:cursor-default',
                cls,
              )}
            >
              <span className="font-mono text-xs opacity-70">{opt.letter}.</span>
              <span className="flex-1">{opt.text}</span>
              {revealed && hasAnswer && isCorrect && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              {revealed && hasAnswer && isPicked && !isCorrect && (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
            </button>
          );
        })}
      </div>
      {revealed && hasAnswer && picked !== block.correctLetter && (
        <p className="text-[11px] text-muted-foreground">
          Bonne réponse : <span className="font-semibold">{block.correctLetter}</span>
        </p>
      )}
    </div>
  );
}

export function MarkdownWithQcm({ content }: { content: string }) {
  const blocks = parseQcm(content);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'md') {
          if (!b.content.trim()) return null;
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
              {b.content}
            </ReactMarkdown>
          );
        }
        return <QcmInteractive key={i} block={b} />;
      })}
    </>
  );
}
