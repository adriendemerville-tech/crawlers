import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type ReportType = 'seo_technical' | 'seo_strategic' | 'llm' | 'geo' | 'pagespeed' | 'crawlers' | 'cocoon';

interface SaveReportParams {
  reportType: ReportType;
  title: string;
  url: string;
  reportData: any;
  pdfBlob?: Blob;
}

const translations = {
  fr: {
    saved: 'Rapport sauvegardé',
    error: 'Erreur lors de la sauvegarde',
    loginRequired: 'Connectez-vous pour sauvegarder vos rapports',
  },
  en: {
    saved: 'Report saved',
    error: 'Error saving report',
    loginRequired: 'Log in to save your reports',
  },
  es: {
    saved: 'Informe guardado',
    error: 'Error al guardar el informe',
    loginRequired: 'Inicia sesión para guardar tus informes',
  },
};

export function useSaveReport() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const saveReport = async ({ reportType, title, url, reportData, pdfBlob }: SaveReportParams): Promise<boolean> => {
    if (!user) {
      toast.error(t.loginRequired);
      return false;
    }

    try {
      let pdfUrl: string | null = null;

      // Upload PDF if provided
      if (pdfBlob) {
        const fileName = `${user.id}/${Date.now()}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-reports')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
          });

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('user-reports')
            .getPublicUrl(fileName);
          
          pdfUrl = urlData.publicUrl;
        }
      }

      // Get current max position
      const { data: existingReports } = await supabase
        .from('saved_reports')
        .select('position')
        .eq('user_id', user.id)
        .is('folder_id', null)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingReports && existingReports.length > 0 
        ? (existingReports[0].position || 0) + 1 
        : 0;

      // Save report to database
      const { error } = await supabase.from('saved_reports').insert({
        user_id: user.id,
        report_type: reportType,
        title,
        url,
        report_data: reportData,
        pdf_url: pdfUrl,
        position: nextPosition,
      });

      if (error) {
        console.error('Error saving report:', error);
        toast.error(t.error);
        return false;
      }

      toast.success(t.saved);
      return true;
    } catch (error) {
      console.error('Error in saveReport:', error);
      toast.error(t.error);
      return false;
    }
  };

  return { saveReport, isAuthenticated: !!user };
}
