import ClaudeVerdictAnimation from '@/components/Marina/ClaudeVerdictAnimation';

export function ClaudeVerdictBlock({
  className = 'mt-12',
  showSubtitle = true,
  collapsible = false,
}: {
  className?: string;
  showSubtitle?: boolean;
  /** Replié par défaut : évite d'allonger la page, l'animation reste accessible en un clic. */
  collapsible?: boolean;
}) {
  const heading = 'Un LLM seul peut-il produire le même audit ?';
  const subtitle = "Nous avons soumis un rapport Marina à Claude en lui demandant s'il pouvait faire mieux.";

  if (collapsible) {
    return (
      <section className={className}>
        <details className="group mx-auto max-w-[77rem] px-4">
          <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5">
            {heading}
            <span className="text-muted-foreground transition-transform group-open:rotate-180">v</span>
          </summary>
          {showSubtitle && (
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-4">
            <ClaudeVerdictAnimation />
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className={className}>
      <div className="mx-auto max-w-[77rem] px-4">
        <h3 className="text-xl font-bold text-foreground text-center mb-4">{heading}</h3>
        {showSubtitle && (
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-2xl mx-auto">{subtitle}</p>
        )}
      </div>
      <ClaudeVerdictAnimation />
    </section>
  );
}

export default ClaudeVerdictBlock;
