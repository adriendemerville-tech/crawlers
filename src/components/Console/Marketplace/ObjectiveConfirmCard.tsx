import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { confirmNeedObjective } from '@/lib/marketplace/marketplace.functions';
import { OBJECTIVE_LABEL, type NeedObjective, type NeedRow } from '@/lib/marketplace/matchTypes';

const OBJECTIVES: NeedObjective[] = ['autorite', 'geo', 'trafic', 'mixte'];

/**
 * Étape bloquante « Mon objectif » (L2.8) : l'objectif est pré-rempli depuis le
 * besoin dérivé, avec sa justification. Sans confirmation, aucun appariement
 * n'est calculé et aucun ajout au panier n'est possible.
 */
export function ObjectiveConfirmCard({ need }: { need: NeedRow }) {
  const queryClient = useQueryClient();
  const confirm = useServerFn(confirmNeedObjective);
  const [choice, setChoice] = useState<NeedObjective>(need.need_objective ?? need.need_primary);

  const mutate = useMutation({
    mutationFn: async () => confirm({ data: { needId: need.id, objective: choice } }),
    onSuccess: () => {
      toast.success('Objectif confirmé');
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'matches'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmed = need.need_objective_confirmed_at !== null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium">{need.target_url}</CardTitle>
        <p className="text-xs text-muted-foreground">{need.justification}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((o) => (
            <Button
              key={o}
              variant="outline"
              size="sm"
              className={o === choice ? 'border-primary' : ''}
              onClick={() => setChoice(o)}
            >
              {OBJECTIVE_LABEL[o]}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {confirmed
              ? `Objectif enregistré (${need.need_objective_source === 'user_overridden' ? 'corrigé' : 'confirmé'})`
              : "Confirmez l'objectif pour voir les emplacements réellement compatibles."}
          </span>
          <div className="flex items-center gap-2">
            {confirmed && <Badge variant="outline">{OBJECTIVE_LABEL[need.need_objective!]}</Badge>}
            <Button
              variant="outline"
              size="sm"
              disabled={mutate.isPending}
              onClick={() => mutate.mutate()}
            >
              {confirmed ? 'Mettre à jour' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
