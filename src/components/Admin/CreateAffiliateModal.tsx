import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface CreateAffiliateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  userId: string;
}

export function CreateAffiliateModal({ open, onOpenChange, userName, userEmail, userId }: CreateAffiliateModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('100');
  const [durationMonths, setDurationMonths] = useState('1');
  const [maxActivations, setMaxActivations] = useState('1');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const code = generateCode();
      const discount = Math.min(100, Math.max(0, parseInt(discountPercent) || 100));
      const duration = Math.min(60, Math.max(1, parseInt(durationMonths) || 1));
      const maxAct = Math.min(10000, Math.max(1, parseInt(maxActivations) || 1));

      const { error } = await supabase
        .from('affiliate_codes')
        .insert({
          code,
          created_by: user.id,
          assigned_to_user_id: userId,
          discount_percent: discount,
          duration_months: duration,
          max_activations: maxAct,
        } as any);

      if (error) throw error;

      setGeneratedCode(code);
      toast.success('Code d\'affiliation créé avec succès');
    } catch (err) {
      console.error('Error creating affiliate code:', err);
      toast.error('Erreur lors de la création du code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success('Code copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setGeneratedCode(null);
      setCopied(false);
      setDiscountPercent('100');
      setDurationMonths('1');
      setMaxActivations('1');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-violet-500" />
            Créer un code d'affiliation
          </DialogTitle>
          <DialogDescription>
            Pour {userName} ({userEmail})
          </DialogDescription>
        </DialogHeader>

        {generatedCode ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <p className="text-xs text-muted-foreground">Code généré</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-widest text-violet-600 dark:text-violet-400">
                  {generatedCode}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Badge variant="secondary" className="text-xs">
                  {discountPercent}% réduction
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {durationMonths} mois Pro Agency
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {maxActivations} activation{parseInt(maxActivations) > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Réduction sur l'abonnement Pro Agency</Label>
              <Select value={discountPercent} onValueChange={setDiscountPercent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100% — Gratuit</SelectItem>
                  <SelectItem value="75">75% — 14,75€/mois</SelectItem>
                  <SelectItem value="50">50% — 29,50€/mois</SelectItem>
                  <SelectItem value="25">25% — 44,25€/mois</SelectItem>
                  <SelectItem value="10">10% — 53,10€/mois</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Durée de la réduction</Label>
              <Select value={durationMonths} onValueChange={setDurationMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mois</SelectItem>
                  <SelectItem value="2">2 mois</SelectItem>
                  <SelectItem value="3">3 mois</SelectItem>
                  <SelectItem value="6">6 mois</SelectItem>
                  <SelectItem value="12">12 mois (1 an)</SelectItem>
                  <SelectItem value="24">24 mois (2 ans)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nombre d'activations autorisées</Label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={maxActivations}
                onChange={(e) => setMaxActivations(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Combien de comptes peuvent utiliser ce code
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedCode ? (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Fermer
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Générer le code
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
