import ClaudeVerdictAnimation from '@/components/Marina/ClaudeVerdictAnimation';

export function ClaudeVerdictBlock({
  className = 'mt-12',
  showSubtitle = true,
}: {
  className?: string;
  showSubtitle?: boolean;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-[77rem] px-4">
        <h3 className="text-xl font-bold text-foreground text-center mb-4">
          Un LLM seul peut-il produire le même audit ?
        </h3>
        {showSubtitle && (
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-2xl mx-auto">
            Nous avons soumis un rapport Marina à Claude en lui demandant s'il pouvait faire mieux.
          </p>
        )}
      </div>
      <ClaudeVerdictAnimation />
    </section>
  );
}

export default ClaudeVerdictBlock;
