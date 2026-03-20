import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ApiItem {
  id: string;
  api_name: string;
  api_url: string;
  seo_segment: string;
  crawlers_feature: string;
}

export function BundleOptionTab() {
  const { user } = useAuth();
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bundle_api_catalog' as any)
        .select('id, api_name, api_url, seo_segment, crawlers_feature')
        .eq('is_active', true)
        .order('display_order') as any;
      if (data) setApis(data as ApiItem[]);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const price = selected.size;

  const handleSubscribe = async () => {
    if (!user || selected.size === 0) return;
    toast.info(`Bundle ${selected.size} API${selected.size > 1 ? 's' : ''} — ${price}€/mois — bientôt disponible`);
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground text-sm">Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Bundle Option</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez les API tierces à intégrer à votre stack Crawlers.</p>
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="w-[200px]">API</TableHead>
              <TableHead className="w-[50px]" />
              <TableHead>Segment SEO</TableHead>
              <TableHead>Fonction Crawlers</TableHead>
              <TableHead className="w-[50px] text-center">✓</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apis.map((api) => (
              <TableRow key={api.id} className="border-border/30 hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{api.api_name}</TableCell>
                <TableCell>
                  <a
                    href={api.api_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{api.seo_segment}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{api.crawlers_feature}</TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={selected.has(api.id)}
                    onCheckedChange={() => toggle(api.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-4 pt-2">
        <span className="text-sm text-muted-foreground tabular-nums">
          {selected.size > 0 ? (
            <>
              <span className="font-semibold text-foreground">{price}€</span>/mois
              <span className="ml-1">({selected.size} API{selected.size > 1 ? 's' : ''})</span>
            </>
          ) : (
            'Aucune API sélectionnée'
          )}
        </span>
        <Button
          onClick={handleSubscribe}
          disabled={selected.size === 0}
          size="sm"
        >
          S'abonner
        </Button>
      </div>
    </div>
  );
}
