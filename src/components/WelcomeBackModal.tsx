import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function WelcomeBackModal() {
  const { user, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    // Only check on /console
    if (window.location.pathname !== '/console') return;

    // Only show once per session
    const dismissed = sessionStorage.getItem('welcome_back_dismissed');
    if (dismissed) return;

    const check = async () => {
      const { data } = await supabase
        .from('archived_users')
        .select('id')
        .eq('email', user.email!)
        .limit(1) as any;

      if (data && data.length > 0) {
        setArchiveId(data[0].id);
        setVisible(true);
      }
    };

    check();
  }, [user]);

  const handleClose = () => {
    sessionStorage.setItem('welcome_back_dismissed', 'true');
    setVisible(false);
  };

  const handleDecline = async () => {
    // Delete archive entry so we don't ask again
    if (archiveId) {
      await supabase.from('archived_users').delete().eq('id', archiveId) as any;
    }
    handleClose();
  };

  const handleRestore = async () => {
    if (!archiveId || !user) return;
    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore-archived-user', {
        body: { archive_id: archiveId },
      });

      if (error) throw error;
      toast.success('Vos données ont été restaurées !');
      await refreshProfile();
      handleClose();
    } catch (e: any) {
      console.error('Restore error:', e);
      toast.error('Erreur lors de la restauration');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-background border border-border rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
          >
            {/* Top accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Vous êtes de retour !
                </h3>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Voulez-vous que nous rétablissions vos données et votre Console ?
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDecline}
                  disabled={restoring}
                >
                  Non merci
                </Button>
                <Button
                  size="sm"
                  onClick={handleRestore}
                  disabled={restoring}
                  className="gap-1.5"
                >
                  {restoring ? (
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Oui, restaurer
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
