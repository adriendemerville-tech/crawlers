/**
 * MatriceErrorCard — Reusable action card for any matrix-level error.
 * Always offers two paths: Supprimer / Éditer (no dead end).
 * Charte: bordered, no bg fill, no emoji, brand colors only.
 */

import { useState } from 'react';
import { AlertTriangle, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MatriceErrorKind =
  | 'unroutable_criterion'
  | 'weak_prompt'
  | 'quota_exceeded'
  | 'aberrant_score'
  | 'inconsistent_data'
  | 'duplicate_row';

export interface MatriceErrorCardProps {
  kind: MatriceErrorKind;
  title: string;
  message: string;
  currentValue?: string;
  onDelete: () => void;
  onEdit: (newValue: string) => void;
  className?: string;
}

const KIND_LABEL: Record<MatriceErrorKind, string> = {
  unroutable_criterion: 'Critère non routable',
  weak_prompt: 'Prompt LLM faible',
  quota_exceeded: 'Quota dépassé',
  aberrant_score: 'Score aberrant',
  inconsistent_data: 'Donnée incohérente',
  duplicate_row: 'Doublon détecté',
};

export function MatriceErrorCard({
  kind,
  title,
  message,
  currentValue = '',
  onDelete,
  onEdit,
  className,
}: MatriceErrorCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);

  const submitEdit = () => {
    if (draft.trim()) {
      onEdit(draft.trim());
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4',
        'border-2 border-brand-gold rounded-md bg-transparent',
        className,
      )}
      role="alertdialog"
      aria-labelledby={`error-${kind}-title`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-brand-gold font-mono">
            {KIND_LABEL[kind]}
          </p>
          <h4 id={`error-${kind}-title`} className="text-sm font-semibold text-foreground mt-0.5">
            {title}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-transparent border border-brand-violet rounded-md focus:outline-none focus:border-brand-gold resize-y"
            aria-label="Nouvelle valeur"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(currentValue); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-foreground/40 text-foreground rounded-md hover:border-foreground transition-colors bg-transparent"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
            <button
              type="button"
              onClick={submitEdit}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border-2 border-brand-violet text-foreground rounded-md hover:border-brand-gold transition-colors disabled:opacity-50 bg-transparent"
            >
              <Check className="h-4 w-4" />
              Valider
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-foreground/40 text-foreground rounded-md hover:border-destructive hover:text-destructive transition-colors bg-transparent"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border-2 border-brand-violet text-foreground rounded-md hover:border-brand-gold transition-colors bg-transparent"
          >
            <Pencil className="h-4 w-4" />
            Éditer
          </button>
        </div>
      )}
    </div>
  );
}

export default MatriceErrorCard;
