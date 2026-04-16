import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Cpu } from "lucide-react";
import { toast } from "sonner";

// Mirror of supabase/functions/_shared/editorialPipeline.ts
const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "fast" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "balanced" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "premium" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "fast" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "balanced" },
  { value: "openai/gpt-5", label: "GPT-5", tier: "premium" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", tier: "premium" },
  { value: "mistralai/mistral-large-latest", label: "Mistral Large", tier: "balanced" },
];

const CONTENT_TYPES = [
  { value: "blog_article", label: "Article blog" },
  { value: "seo_page", label: "Page SEO" },
  { value: "social_post", label: "Post social" },
  { value: "email", label: "Email" },
  { value: "landing_page", label: "Landing page" },
  { value: "guide", label: "Guide" },
  { value: "faq", label: "FAQ" },
];

interface TrackedSite {
  id: string;
  domain: string;
}

interface RoutingRow {
  content_type: string;
  strategist_model: string | null;
  writer_model: string | null;
  tonalizer_model: string | null;
}

const AUTO = "__auto__";

export function EditorialLLMRoutingMatrix({ externalDomain }: { externalDomain?: string | null }) {
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [rows, setRows] = useState<Record<string, RoutingRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load sites
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("tracked_sites")
        .select("id, domain")
        .eq("user_id", user.id)
        .order("domain");
      if (data && data.length > 0) {
        setSites(data);
        setSelectedDomain(externalDomain || data[0].domain);
      }
    })();
  }, []);

  useEffect(() => {
    if (externalDomain) setSelectedDomain(externalDomain);
  }, [externalDomain]);

  // Load routing rules for selected domain
  useEffect(() => {
    if (!selectedDomain || !userId) return;
    loadRules();
  }, [selectedDomain, userId]);

  const loadRules = async () => {
    if (!userId || !selectedDomain) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("editorial_llm_routing")
        .select("content_type, strategist_model, writer_model, tonalizer_model")
        .eq("user_id", userId)
        .eq("domain", selectedDomain);

      if (error) throw error;

      const map: Record<string, RoutingRow> = {};
      CONTENT_TYPES.forEach((t) => {
        const found = (data ?? []).find((r) => r.content_type === t.value);
        map[t.value] = found ?? {
          content_type: t.value,
          strategist_model: null,
          writer_model: null,
          tonalizer_model: null,
        };
      });
      setRows(map);
    } catch (err) {
      console.error("[EditorialLLMRoutingMatrix] load error", err);
      toast.error("Erreur de chargement des règles de routage");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (contentType: string, field: keyof RoutingRow, value: string) => {
    setRows((prev) => ({
      ...prev,
      [contentType]: {
        ...prev[contentType],
        [field]: value === AUTO ? null : value,
      },
    }));
  };

  const saveAll = async () => {
    if (!userId || !selectedDomain) return;
    setSaving(true);
    try {
      // Upsert each non-empty row, delete fully-auto rows
      const ops = await Promise.all(
        Object.values(rows).map(async (row) => {
          const isAllAuto =
            !row.strategist_model && !row.writer_model && !row.tonalizer_model;
          if (isAllAuto) {
            return supabase
              .from("editorial_llm_routing")
              .delete()
              .eq("user_id", userId)
              .eq("domain", selectedDomain)
              .eq("content_type", row.content_type);
          }
          return supabase.from("editorial_llm_routing").upsert(
            {
              user_id: userId,
              domain: selectedDomain,
              content_type: row.content_type,
              strategist_model: row.strategist_model,
              writer_model: row.writer_model,
              tonalizer_model: row.tonalizer_model,
            },
            { onConflict: "user_id,domain,content_type" },
          );
        }),
      );

      const errs = ops.filter((o) => o.error);
      if (errs.length) throw new Error(`${errs.length} erreurs`);
      toast.success("Routage LLM sauvegardé");
    } catch (err) {
      console.error("[EditorialLLMRoutingMatrix] save error", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    const empty: Record<string, RoutingRow> = {};
    CONTENT_TYPES.forEach((t) => {
      empty[t.value] = {
        content_type: t.value,
        strategist_model: null,
        writer_model: null,
        tonalizer_model: null,
      };
    });
    setRows(empty);
    toast.info("Tous les overrides réinitialisés (non sauvegardé)");
  };

  const tierBadge = useMemo(
    () => (model: string | null) => {
      if (!model) return null;
      const m = AVAILABLE_MODELS.find((x) => x.value === model);
      if (!m) return null;
      const colors: Record<string, string> = {
        fast: "border-muted-foreground/30",
        balanced: "border-primary/40",
        premium: "border-yellow-500/50",
      };
      return (
        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${colors[m.tier]}`}>
          {m.tier}
        </Badge>
      );
    },
    [],
  );

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Routage LLM éditorial</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Choisir un domaine" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.domain} className="text-xs">
                    {s.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={resetAll}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Sauvegarder
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Override par type de contenu. Laisser sur <strong>Auto</strong> pour utiliser la sélection automatique
          basée sur la complexité du site × type. Les 3 étages (Stratège, Rédacteur, Tonalisateur) sont
          configurables indépendamment.
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="py-2 pr-3 font-medium">Type de contenu</th>
                  <th className="py-2 px-3 font-medium">Stratège (étage 1)</th>
                  <th className="py-2 px-3 font-medium">Rédacteur (étage 2)</th>
                  <th className="py-2 px-3 font-medium">Tonalisateur (étage 3)</th>
                </tr>
              </thead>
              <tbody>
                {CONTENT_TYPES.map((ct) => {
                  const row = rows[ct.value] ?? {
                    content_type: ct.value,
                    strategist_model: null,
                    writer_model: null,
                    tonalizer_model: null,
                  };
                  return (
                    <tr key={ct.value} className="border-b border-border/20">
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">{ct.label}</td>
                      {(["strategist_model", "writer_model", "tonalizer_model"] as const).map((field) => (
                        <td key={field} className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={row[field] ?? AUTO}
                              onValueChange={(v) => updateRow(ct.value, field, v)}
                            >
                              <SelectTrigger className="h-8 text-xs min-w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={AUTO} className="text-xs italic text-muted-foreground">
                                  Auto (par défaut)
                                </SelectItem>
                                {AVAILABLE_MODELS.map((m) => (
                                  <SelectItem key={m.value} value={m.value} className="text-xs">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {tierBadge(row[field])}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
