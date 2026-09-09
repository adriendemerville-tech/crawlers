import { memo } from 'react';
import { Gauge, KeyRound, Sparkles, Smartphone } from 'lucide-react';

const SCORES = [
  { icon: Sparkles, label: 'Score GEO (citabilité IA)', before: '42/100', after: '78/100' },
  { icon: Gauge, label: 'Score SEO technique', before: '61/100', after: '86/100' },
  { icon: Smartphone, label: 'Vitesse mobile', before: '3,8 s', after: '1,9 s' },
  { icon: KeyRound, label: 'Mots-clés suivis', before: '0', after: '12 positionnés' },
];

/**
 * Aperçu illustratif d'un rapport d'audit : scores avant/après + extrait de correctif.
 * Aucune donnée réelle : tout est marqué comme exemple.
 */
function AuditReportPreviewComponent(): React.ReactElement {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold">Rapport Marina — extrait</p>
        <span className="rounded-full border border-brand-gold/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-gold">
          Exemple illustratif
        </span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCORES.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-background p-4">
            <s.icon className="mb-3 h-5 w-5 text-brand-violet" />
            <p className="mb-2 text-xs text-muted-foreground">{s.label}</p>
            <p className="text-sm">
              <span className="mr-2 text-muted-foreground line-through">{s.before}</span>
              <span className="font-semibold text-brand-violet">{s.after}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Correctif n°1 — titre de la page d'accueil
        </p>
        <div className="space-y-2 font-mono text-xs sm:text-sm">
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-muted-foreground">
            <span className="mr-2 font-semibold">Avant</span>
            &lt;title&gt;Accueil&lt;/title&gt;
          </p>
          <p className="rounded-lg border border-brand-violet/40 bg-brand-violet-muted px-3 py-2">
            <span className="mr-2 font-semibold text-brand-violet">Après</span>
            &lt;title&gt;Plomberie Martin — Dépannage 7j/7 à Lyon 3e&lt;/title&gt;
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Chaque correctif est expliqué en langage simple, avec l'impact attendu et la priorité.
        </p>
      </div>
    </div>
  );
}

export default memo(AuditReportPreviewComponent);
