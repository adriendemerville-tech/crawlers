import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Save, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ActionPlanTask {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  isCompleted: boolean;
}

interface ActionPlanSaveButtonProps {
  tasks: ActionPlanTask[];
  url: string;
  onSaved?: () => void;
}

export function ActionPlanSaveButton({ tasks, url, onSaved }: ActionPlanSaveButtonProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // TODO: Implement actual save to Supabase
      // For now, simulate save with localStorage
      const planData = {
        id: crypto.randomUUID(),
        url,
        tasks,
        savedAt: new Date().toISOString(),
        completedCount: tasks.filter(t => t.isCompleted).length,
        totalCount: tasks.length,
      };
      
      // Get existing plans
      const existingPlans = JSON.parse(localStorage.getItem('actionPlans') || '[]');
      existingPlans.push(planData);
      localStorage.setItem('actionPlans', JSON.stringify(existingPlans));
      
      setIsSaved(true);
      toast.success('Plan d\'action sauvegardé dans votre espace');
      onSaved?.();
      
      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
    >
      <Button
        onClick={handleSave}
        disabled={isSaving || isSaved}
        className="gap-2 shadow-[2px_4px_12px_rgba(0,0,0,0.15)]"
        variant={isSaved ? 'secondary' : 'default'}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sauvegarde...
          </>
        ) : isSaved ? (
          <>
            <Check className="h-4 w-4" />
            Sauvegardé
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Sauvegarder dans mon espace
          </>
        )}
      </Button>
    </motion.div>
  );
}
