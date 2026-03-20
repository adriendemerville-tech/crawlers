import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Save, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
  auditType?: 'technical' | 'strategic';
  onSaved?: () => void;
}

const translations = {
  fr: {
    save: 'Sauvegarder dans mon espace',
    saving: 'Sauvegarde...',
    saved: 'Sauvegardé',
    success: 'Plan d\'action sauvegardé dans votre espace',
    error: 'Erreur lors de la sauvegarde',
    loginRequired: 'Connectez-vous pour sauvegarder',
  },
  en: {
    save: 'Save to my account',
    saving: 'Saving...',
    saved: 'Saved',
    success: 'Action plan saved to your account',
    error: 'Error saving action plan',
    loginRequired: 'Log in to save',
  },
  es: {
    save: 'Guardar en mi espacio',
    saving: 'Guardando...',
    saved: 'Guardado',
    success: 'Plan de acción guardado en tu espacio',
    error: 'Error al guardar el plan',
    loginRequired: 'Inicia sesión para guardar',
  },
};

export function ActionPlanSaveButton({ tasks, url, auditType = 'technical', onSaved }: ActionPlanSaveButtonProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Extract domain from URL for title
      let domain = url;
      try {
        domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      } catch {
        // Keep original if parsing fails
      }

      const title = `${auditType === 'technical' ? 'Audit Technique SEO' : 'Audit Stratégique GEO'} - ${domain}`;

      const { error } = await supabase.from('action_plans').insert({
        user_id: user.id,
        url,
        title,
        audit_type: auditType,
        tasks: JSON.parse(JSON.stringify(tasks)),
      });

      if (error) {
        console.error('Error saving action plan:', error);
        toast.error(t.error);
        return;
      }
      
      setIsSaved(true);
      onSaved?.();
    } catch (error) {
      console.error('Error saving action plan:', error);
      toast.error(t.error);
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
            {t.saving}
          </>
        ) : isSaved ? (
          <>
            <Check className="h-4 w-4" />
            {t.saved}
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {t.save}
          </>
        )}
      </Button>
    </motion.div>
  );
}
