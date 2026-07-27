/**
 * DocShareLinksDialog
 * -------------------
 * Modal admin permettant de créer et gérer des liens éphémères
 * de partage de la documentation technique (audit par une IA externe).
 */
import { useEffect, useState } from 'react';
import { Link2, Copy, Check, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { backendDocSections } from '@/data/backendDocumentation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

type ShareLink = {
  id: string;
  token: string;
  label: string;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  revoked: boolean;
  created_at: string;
  last_viewed_at: string | null;
};

export function DocShareLinksDialog() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [label, setLabel] = useState('Audit IA — documentation technique');
  const [ttlHours, setTtlHours] = useState(24);
  const [maxViews, setMaxViews] = useState<number | ''>('');
  const [selectedSections, setSelectedSections] = useState<string[]>(
    backendDocSections.map((s) => s.id),
  );

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  async function authHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${data.session?.access_token ?? anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    };
  }

  async function loadLinks() {
    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/doc-share?list=1`, {
        headers: await authHeaders(),
      });
      const json = await res.json();
      setLinks(json.links || []);
    } catch {
      toast.error('Chargement impossible');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function createLink() {
    if (selectedSections.length === 0) {
      toast.error('Sélectionne au moins une section');
      return;
    }
    setCreating(true);
    const sections = backendDocSections
      .filter((s) => selectedSections.includes(s.id))
      .map((s) => ({ id: s.id, title: s.title, content: s.content }));

    const { data, error } = await supabase.functions.invoke('doc-share', {
      method: 'POST',
      body: {
        label,
        sections,
        ttl_hours: ttlHours,
        max_views: maxViews === '' ? null : Number(maxViews),
      },
    });
    setCreating(false);

    if (error) {
      toast.error('Création impossible');
      return;
    }
    const res = data as { url: string };
    await navigator.clipboard.writeText(res.url).catch(() => {});
    toast.success('Lien créé et copié dans le presse-papier');
    loadLinks();
  }

  async function revoke(token: string) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/doc-share?token=${token}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success('Lien révoqué');
      loadLinks();
    } catch {
      toast.error('Révocation impossible');
    }
  }

  const buildUrl = (token: string, format?: string) =>
    `${supabaseUrl}/functions/v1/doc-share?token=${token}${format ? `&format=${format}` : ''}`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function toggleSection(id: string) {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="h-4 w-4" />
          Lien éphémère
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Liens éphémères — audit IA externe
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-6">
            {/* Création */}
            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Créer un nouveau lien</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <Label htmlFor="label" className="text-xs">Libellé</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Audit Claude — 2026-07"
                  />
                </div>
                <div>
                  <Label htmlFor="ttl" className="text-xs">Expiration (heures)</Label>
                  <Input
                    id="ttl"
                    type="number"
                    min={1}
                    max={720}
                    value={ttlHours}
                    onChange={(e) => setTtlHours(Number(e.target.value) || 24)}
                  />
                </div>
                <div>
                  <Label htmlFor="mv" className="text-xs">Vues max (optionnel)</Label>
                  <Input
                    id="mv"
                    type="number"
                    min={1}
                    value={maxViews}
                    onChange={(e) => setMaxViews(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="illimité"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={createLink}
                    disabled={creating}
                    className="w-full"
                    variant="outline"
                  >
                    {creating ? 'Création…' : 'Créer & copier le lien'}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Sections partagées ({selectedSections.length}/{backendDocSections.length})</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] underline text-muted-foreground"
                      onClick={() => setSelectedSections(backendDocSections.map((s) => s.id))}
                    >
                      Toutes
                    </button>
                    <button
                      type="button"
                      className="text-[11px] underline text-muted-foreground"
                      onClick={() => setSelectedSections([])}
                    >
                      Aucune
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {backendDocSections.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-xs rounded border px-2 py-1.5 cursor-pointer hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedSections.includes(s.id)}
                        onCheckedChange={() => toggleSection(s.id)}
                      />
                      <span className="truncate">{s.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Liste */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Liens actifs</h3>
                <Button variant="ghost" size="sm" onClick={loadLinks} disabled={loading}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Rafraîchir
                </Button>
              </div>

              {links.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Aucun lien pour le moment.
                </p>
              )}

              <div className="space-y-2">
                {links.map((l) => {
                  const expired = new Date(l.expires_at) < new Date();
                  const exhausted = l.max_views != null && l.view_count >= l.max_views;
                  const active = !l.revoked && !expired && !exhausted;
                  const url = buildUrl(l.token);
                  return (
                    <div key={l.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{l.label}</span>
                            {active ? (
                              <Badge variant="outline" className="text-[10px]">actif</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {l.revoked ? 'révoqué' : expired ? 'expiré' : 'épuisé'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Expire {new Date(l.expires_at).toLocaleString('fr-FR')} ·{' '}
                            {l.view_count}
                            {l.max_views ? ` / ${l.max_views}` : ''} vues
                            {l.last_viewed_at && ` · dernière vue ${new Date(l.last_viewed_at).toLocaleString('fr-FR')}`}
                          </div>
                        </div>
                        {!l.revoked && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => revoke(l.token)}
                            title="Révoquer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(['html', 'md', 'json'] as const).map((fmt) => {
                          const u = fmt === 'html' ? url : buildUrl(l.token, fmt);
                          const key = `${l.id}-${fmt}`;
                          return (
                            <div
                              key={fmt}
                              className="flex items-center gap-1 text-[11px] rounded border px-2 py-1 bg-muted/40"
                            >
                              <span className="uppercase font-mono text-muted-foreground">{fmt}</span>
                              <button
                                onClick={() => copy(u, key)}
                                className="hover:text-primary flex items-center gap-1"
                                title="Copier"
                              >
                                {copied === key ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                              {fmt === 'html' && (
                                <a
                                  href={u}
                                  target="_blank"
                                  rel="noopener"
                                  className="hover:text-primary"
                                  title="Ouvrir"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="text-[11px] text-muted-foreground rounded-lg border border-dashed p-3">
              <strong>Comment ça marche :</strong> le lien renvoie la documentation
              (HTML, Markdown ou JSON) sans authentification tant qu'il n'a pas expiré
              ou dépassé son quota. Idéal pour transmettre la doc à Claude, ChatGPT ou
              tout auditeur externe. Les vues sont comptées et le lien peut être révoqué
              à tout moment. Aucun contenu utilisateur ni secret n'est exposé — seule la
              documentation figée au moment de la création est servie.
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
