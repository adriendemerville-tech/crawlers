import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Radar, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const translations = {
  fr: {
    track: 'Suivre ce site',
    tracking: 'Suivi actif',
    added: 'Site ajouté au tracking',
    addedDesc: 'Retrouvez l\'évolution de ce site dans votre profil.',
    loginRequired: 'Connectez-vous pour suivre un site',
    error: 'Erreur lors de l\'ajout',
  },
  en: {
    track: 'Track this site',
    tracking: 'Tracking active',
    added: 'Site added to tracking',
    addedDesc: 'Track this site\'s evolution in your profile.',
    loginRequired: 'Log in to track a site',
    error: 'Error adding site',
  },
  es: {
    track: 'Seguir este sitio',
    tracking: 'Seguimiento activo',
    added: 'Sitio añadido al seguimiento',
    addedDesc: 'Encuentra la evolución de este sitio en tu perfil.',
    loginRequired: 'Inicia sesión para seguir un sitio',
    error: 'Error al añadir',
  },
};

interface TrackSiteButtonProps {
  domain: string;
  url: string;
  auditResult?: any;
}

export function TrackSiteButton({ domain, url, auditResult }: TrackSiteButtonProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [isTracked, setIsTracked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !domain) return;
    supabase
      .from('tracked_sites')
      .select('id')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsTracked(true);
      });
  }, [user, domain]);

  const handleTrack = async () => {
    if (!user) {
      toast.error(t.loginRequired);
      return;
    }
    setLoading(true);
    try {
      const { data: site, error } = await supabase
        .from('tracked_sites')
        .insert({
          user_id: user.id,
          domain,
          site_name: domain,
          last_audit_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Save initial stats if audit result available
      if (auditResult && site) {
        const seoScore = auditResult.totalScore || 0;
        const strategicAnalysis = auditResult.strategicAnalysis;
        const geoScore = strategicAnalysis?.geoReadiness?.globalScore || strategicAnalysis?.geoAnalysis?.score || 0;
        const citationRate = strategicAnalysis?.llmVisibility?.citationRate || 0;
        const sentiment = strategicAnalysis?.llmVisibility?.overallSentiment || 'neutral';
        const semanticAuth = strategicAnalysis?.brandAuthority?.semanticAuthority || 0;
        const voiceShare = strategicAnalysis?.competitiveLandscape?.voiceShare || 0;

        await supabase.from('user_stats_history').insert({
          user_id: user.id,
          tracked_site_id: site.id,
          domain,
          seo_score: seoScore,
          geo_score: Math.round(geoScore),
          llm_citation_rate: citationRate,
          ai_sentiment: sentiment,
          semantic_authority: semanticAuth,
          voice_share: voiceShare,
          raw_data: { url, auditSummary: { totalScore: seoScore, maxScore: 200 } },
        });
      }

      setIsTracked(true);
      toast.success(t.added, { description: t.addedDesc });
    } catch {
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (isTracked) {
    return (
      <Button variant="outline" disabled className="gap-2 border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        {t.tracking}
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleTrack} disabled={loading} className="gap-2">
      <Radar className="h-4 w-4" />
      {t.track}
    </Button>
  );
}
