import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Star, Camera, Send, MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

interface ContentBlock {
  id: string;
  type: 'poll' | 'rating' | 'text_feedback' | 'screenshot' | 'share';
  question?: string;
  options?: string[];
  max_rating?: number;
  share_channel?: 'whatsapp' | 'sms';
  share_message?: string;
  label?: string;
}

interface ActiveSurvey {
  id: string;
  title: string;
  content_blocks: ContentBlock[];
  variant: 'A' | 'B';
}

export function SurveyModal() {
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null);
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  const checkForSurvey = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Fetch active surveys
    const { data: surveys } = await supabase
      .from('surveys')
      .select('*')
      .eq('status', 'active');

    if (!surveys || surveys.length === 0) return;

    const now = new Date();
    const currentPath = location.pathname;

    for (const s of surveys) {
      // Check schedule
      if (s.schedule_at && new Date(s.schedule_at) > now) continue;

      // Check duration
      if (s.schedule_at) {
        const endDate = new Date(s.schedule_at);
        endDate.setDate(endDate.getDate() + (s.duration_days || 7));
        if (now > endDate) continue;
      }

      // Check target pages
      const targetPages = (s.target_pages || []) as string[];
      if (targetPages.length > 0 && !targetPages.some(p => currentPath.startsWith(p))) continue;

      // Check persona targeting
      const persona = (s.target_persona || {}) as Record<string, any>;
      // For now, basic persona checks could be extended with profile data
      // We skip persona validation on the client side for simplicity

      // Check impressions limit
      const { data: myEvents } = await supabase
        .from('survey_events')
        .select('event_type, created_at')
        .eq('survey_id', s.id)
        .eq('user_id', user.id);

      const myImpressions = (myEvents || []).filter(e => e.event_type === 'impression');
      const maxImpressions = s.max_impressions_per_user || 1;
      if (myImpressions.length >= maxImpressions) continue;

      // Check delay between impressions
      if (myImpressions.length > 0) {
        const lastImpression = new Date(myImpressions[myImpressions.length - 1].created_at);
        const delayHours = s.delay_between_impressions_hours || 24;
        const nextAllowed = new Date(lastImpression.getTime() + delayHours * 60 * 60 * 1000);
        if (now < nextAllowed) continue;
      }

      // Check if already responded
      const hasResponded = (myEvents || []).some(e => e.event_type === 'response');
      if (hasResponded) continue;

      // Determine variant
      let variant: 'A' | 'B' = 'A';
      let blocks = (s.content_blocks || []) as unknown as ContentBlock[];
      if (s.ab_enabled) {
        const rand = Math.random() * 100;
        if (rand >= (s.ab_ratio || 50)) {
          variant = 'B';
          blocks = (s.variant_b_content_blocks || s.content_blocks || []) as unknown as ContentBlock[];
        }
      }

      // Track impression
      await supabase.from('survey_events').insert({
        survey_id: s.id,
        user_id: user.id,
        event_type: 'impression',
        variant,
      });

      setSurvey({ id: s.id, title: s.title, content_blocks: blocks, variant });
      setOpen(true);
      setCurrentBlockIndex(0);
      setResponses({});
      break; // Show only one survey at a time
    }
  }, [location.pathname]);

  useEffect(() => {
    const timer = setTimeout(checkForSurvey, 3000); // Delay 3s after page load
    return () => clearTimeout(timer);
  }, [checkForSurvey]);

  const handleDismiss = async () => {
    if (survey && userId) {
      await supabase.from('survey_events').insert({
        survey_id: survey.id,
        user_id: userId,
        event_type: 'dismiss',
        variant: survey.variant,
      });
    }
    setOpen(false);
    setSurvey(null);
  };

  const handleSubmit = async () => {
    if (!survey || !userId) return;

    await supabase.from('survey_events').insert({
      survey_id: survey.id,
      user_id: userId,
      event_type: 'response',
      variant: survey.variant,
      response_data: responses,
    });

    toast.success('Merci pour votre retour !');
    setOpen(false);
    setSurvey(null);
  };

  const handleScreenshot = async (blockId: string) => {
    try {
      const canvas = await html2canvas(document.body, { useCORS: true, scale: 0.5 });
      const dataUrl = canvas.toDataURL('image/png');
      setResponses(r => ({ ...r, [blockId]: dataUrl.substring(0, 500) + '...[captured]' }));
      toast.success('Capture enregistrée');
    } catch {
      toast.error('Erreur lors de la capture');
    }
  };

  const handleShare = (block: ContentBlock) => {
    const message = encodeURIComponent(block.share_message || 'Découvrez ikTracker !');
    const url = block.share_channel === 'sms'
      ? `sms:?body=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
    setResponses(r => ({ ...r, [block.id]: 'shared' }));
  };

  if (!survey || !open) return null;

  const blocks = survey.content_blocks;
  const isLastBlock = currentBlockIndex >= blocks.length - 1;
  const allBlocksAnswered = blocks.every(b => responses[b.id] !== undefined);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{survey.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {blocks.map((block, i) => (
            <div key={block.id} className={cn(i !== currentBlockIndex && blocks.length > 3 ? 'hidden' : '')}>
              {block.type === 'poll' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{block.question}</Label>
                  <div className="space-y-1.5">
                    {(block.options || []).map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => setResponses(r => ({ ...r, [block.id]: opt }))}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border text-sm transition-colors",
                          responses[block.id] === opt
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {block.type === 'rating' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{block.question}</Label>
                  <div className="flex gap-1">
                    {Array.from({ length: block.max_rating || 5 }, (_, j) => (
                      <button
                        key={j}
                        onClick={() => setResponses(r => ({ ...r, [block.id]: j + 1 }))}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6",
                            (responses[block.id] || 0) > j
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {block.type === 'text_feedback' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{block.question}</Label>
                  <Textarea
                    value={responses[block.id] || ''}
                    onChange={e => setResponses(r => ({ ...r, [block.id]: e.target.value }))}
                    placeholder="Votre réponse..."
                    rows={3}
                  />
                </div>
              )}

              {block.type === 'screenshot' && (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => handleScreenshot(block.id)} className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    {block.label || 'Envoyer une capture d\'écran'}
                  </Button>
                  {responses[block.id] && <p className="text-xs text-green-600">✓ Capture enregistrée</p>}
                </div>
              )}

              {block.type === 'share' && (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => handleShare(block)} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Partager via {block.share_channel === 'sms' ? 'SMS' : 'WhatsApp'}
                  </Button>
                  {responses[block.id] && <p className="text-xs text-green-600">✓ Lien partagé</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          {blocks.length > 3 ? (
            <div className="flex gap-2">
              {currentBlockIndex > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCurrentBlockIndex(i => i - 1)}>Précédent</Button>
              )}
              {!isLastBlock && (
                <Button variant="outline" size="sm" onClick={() => setCurrentBlockIndex(i => i + 1)}>Suivant</Button>
              )}
            </div>
          ) : <div />}
          <Button size="sm" onClick={handleSubmit} disabled={!allBlocksAnswered && blocks.length <= 3}>
            Envoyer
          </Button>
        </div>

        {blocks.length > 3 && (
          <div className="flex justify-center gap-1">
            {blocks.map((_, i) => (
              <div key={i} className={cn("h-1.5 w-1.5 rounded-full", i === currentBlockIndex ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
