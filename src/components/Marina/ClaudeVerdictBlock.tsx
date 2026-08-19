import ClaudeVerdictAnimation from '@/components/Marina/ClaudeVerdictAnimation';

export function ClaudeVerdictBlock({ className = 'mt-12' }: { className?: string }) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-3xl px-4">
        <h3 className="text-xl font-bold text-foreground text-center mb-4">
          Un LLM seul peut-il produire le même audit ?
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-2xl mx-auto">
          Nous avons soumis un rapport Marina à Claude en lui demandant s'il pouvait faire mieux. Sa réponse est
          la démonstration la plus courte de la différence entre un avis générique et une mesure instrumentée.
        </p>
      </div>
      <ClaudeVerdictAnimation />
    </section>
  );
}

export default ClaudeVerdictBlock;
