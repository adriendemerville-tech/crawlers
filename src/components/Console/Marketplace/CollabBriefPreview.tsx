import { useMemo, useState } from 'react';
import { Instagram, Linkedin, AlertTriangle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hasComplianceMention, type SocialFormat } from '@/lib/marketplace/socialPricing';

const COMPLIANCE_TAGS = ['#pub', '#sponso', '#sponsorise', '#collaborationcommerciale', 'partenariat remunere', 'publicite'];

const FORMAT_LABEL: Record<SocialFormat, string> = {
  feed: 'Post feed (permanent)',
  reel: 'Reel (permanent)',
  story: 'Story (24 h)',
  linkedin_post: 'Post LinkedIn (permanent)',
};

export interface CollabBrief {
  format: SocialFormat;
  accountName: string;
  hook: string;
  caption: string;
  linkLabel: string;
  linkUrl: string;
}

interface Props {
  brief: CollabBrief;
  roundsRemaining: number;
  onFeedback?: (comment: string) => void;
  submitting?: boolean;
}

/**
 * CollabBriefPreview (L6.4) — maquette bilatérale du brief créatif.
 * Même mécanique que la prévisualisation d'insertion de lien : l'acheteur et le
 * vendeur voient exactement le même rendu, la mention de conformité est contrôlée
 * avant envoi, et le feedback est plafonné à 3 tours.
 */
export function CollabBriefPreview({ brief, roundsRemaining, onFeedback, submitting }: Props) {
  const [comment, setComment] = useState('');
  const compliant = useMemo(() => hasComplianceMention(brief.caption, COMPLIANCE_TAGS), [brief.caption]);
  const isStory = brief.format === 'story';
  const isLinkedin = brief.format === 'linkedin_post';

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {isLinkedin ? <Linkedin className="h-4 w-4 text-primary" /> : <Instagram className="h-4 w-4 text-primary" />}
          Brief créatif — {FORMAT_LABEL[brief.format]}
        </CardTitle>
        <Badge variant="outline">{roundsRemaining} tour(s) de feedback restant(s)</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-6 w-6 rounded-full border border-border" aria-hidden="true" />
              {brief.accountName}
            </div>
            <div
              className={`flex items-end rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground ${
                isStory ? 'aspect-[9/16]' : 'aspect-square'
              }`}
            >
              Emplacement visuel — {isStory ? 'story verticale, sticker de lien' : 'visuel carré ou vertical'}
            </div>
            {isStory && (
              <p className="mt-2 text-xs text-muted-foreground">
                Sticker de lien : {brief.linkLabel} → {brief.linkUrl}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Accroche</p>
              <p className="text-sm font-medium">{brief.hook}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Légende</p>
              <p className="whitespace-pre-wrap text-sm">{brief.caption}</p>
            </div>
            {!isStory && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Lien</p>
                <p className="text-sm">
                  {brief.linkLabel} — <span className="text-muted-foreground">{brief.linkUrl}</span>
                  {isLinkedin ? '' : ' (lien en bio, aucun lien cliquable en légende Instagram)'}
                </p>
              </div>
            )}

            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                compliant ? 'border-border' : 'border-primary'
              }`}
            >
              {compliant ? (
                <Check className="mt-0.5 h-4 w-4 text-primary" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
              )}
              <span>
                {compliant
                  ? 'Mention de partenariat rémunéré présente : la publication est conforme ARPP / FTC.'
                  : 'Aucune mention de partenariat rémunéré. La légende doit porter #pub, #sponso ou « partenariat rémunéré » — sans elle, la vérification post-publication rendra un verdict non conforme.'}
              </span>
            </div>
          </div>
        </div>

        {onFeedback && (
          <div className="space-y-2 border-t border-border pt-4">
            <label htmlFor="collab-feedback" className="text-sm font-medium">
              Demande de modification
            </label>
            <Textarea
              id="collab-feedback"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ce qui doit changer dans l'accroche, la légende ou le visuel."
              rows={3}
              disabled={roundsRemaining <= 0 || submitting}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Passé 3 tours sans accord, le dossier part en arbitrage Crawlers.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={roundsRemaining <= 0 || submitting || comment.trim().length < 10}
                onClick={() => {
                  onFeedback(comment.trim());
                  setComment('');
                }}
              >
                Envoyer le retour
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CollabBriefPreview;
