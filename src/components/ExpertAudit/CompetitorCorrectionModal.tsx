import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Target, Rocket, Sparkles, RefreshCw } from 'lucide-react';
import { CompetitiveLandscape, CompetitorActor } from '@/types/expertAudit';

export interface CompetitorCorrections {
  leader: { name: string; url: string };
  direct_competitor: { name: string; url: string };
  challenger: { name: string; url: string };
  inspiration_source: { name: string; url: string };
}

interface CompetitorCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landscape: CompetitiveLandscape;
  onSubmit: (corrections: CompetitorCorrections) => void;
  isLoading?: boolean;
}

const roleInfo = [
  { key: 'leader', label: 'Leader (Goliath)', icon: Crown, color: 'text-amber-500' },
  { key: 'direct_competitor', label: 'Concurrent Direct', icon: Target, color: 'text-blue-500' },
  { key: 'challenger', label: 'Challenger', icon: Rocket, color: 'text-purple-500' },
  { key: 'inspiration_source', label: 'Source d\'Inspiration', icon: Sparkles, color: 'text-emerald-500' },
] as const;

export function CompetitorCorrectionModal({
  open,
  onOpenChange,
  landscape,
  onSubmit,
  isLoading = false,
}: CompetitorCorrectionModalProps) {
  const [corrections, setCorrections] = useState<CompetitorCorrections>({
    leader: { name: '', url: '' },
    direct_competitor: { name: '', url: '' },
    challenger: { name: '', url: '' },
    inspiration_source: { name: '', url: '' },
  });

  // Initialize from landscape when modal opens
  useEffect(() => {
    if (open && landscape) {
      setCorrections({
        leader: { name: landscape.leader?.name || '', url: landscape.leader?.url || '' },
        direct_competitor: { name: landscape.direct_competitor?.name || '', url: landscape.direct_competitor?.url || '' },
        challenger: { name: landscape.challenger?.name || '', url: landscape.challenger?.url || '' },
        inspiration_source: { name: landscape.inspiration_source?.name || '', url: landscape.inspiration_source?.url || '' },
      });
    }
  }, [open, landscape]);

  const handleChange = (role: keyof CompetitorCorrections, field: 'name' | 'url', value: string) => {
    setCorrections((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  };

  const handleSubmit = () => {
    onSubmit(corrections);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Corriger l'Écosystème Concurrentiel
          </DialogTitle>
          <DialogDescription>
            Modifiez les noms et domaines des concurrents. L'analyse stratégique sera automatiquement relancée avec vos corrections.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {roleInfo.map(({ key, label, icon: Icon, color }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid gap-3"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${key}-name`} className="text-xs text-muted-foreground">
                    Nom
                  </Label>
                  <Input
                    id={`${key}-name`}
                    value={corrections[key].name}
                    onChange={(e) => handleChange(key, 'name', e.target.value)}
                    placeholder="Nom du concurrent"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${key}-url`} className="text-xs text-muted-foreground">
                    Domaine
                  </Label>
                  <Input
                    id={`${key}-url`}
                    value={corrections[key].url}
                    onChange={(e) => handleChange(key, 'url', e.target.value)}
                    placeholder="example.com"
                    className="h-9"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyse...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Relancer l'analyse
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
