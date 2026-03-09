import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Database, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onUploadComplete: () => void;
}

const DATA_SOURCES = [
  { value: 'semrush', label: 'SEMrush' },
  { value: 'ahrefs', label: 'Ahrefs' },
  { value: 'sistrix', label: 'Sistrix' },
  { value: 'searchconsole', label: 'Google Search Console (export)' },
  { value: 'screaming_frog', label: 'Screaming Frog' },
  { value: 'majestic', label: 'Majestic SEO' },
  { value: 'moz', label: 'Moz' },
  { value: 'other', label: 'Autre SaaS / CSV tiers' },
];

export function PdfUploader({ onUploadComplete }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dataSource, setDataSource] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleUpload = async () => {
    if (!file || !dataSource || !targetDomain) {
      toast({ title: 'Erreur', description: 'Remplissez tous les champs obligatoires', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // 1. Upload file to storage
      const filePath = `third-party/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('pdf-audits')
        .upload(filePath, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      // 2. Create record (using pdf_audits table with metadata)
      const { data: audit, error: insertErr } = await supabase
        .from('pdf_audits')
        .insert({
          client_id: (await supabase.auth.getUser()).data.user!.id,
          file_path: filePath,
          status: 'pending',
          extracted_data: {
            _source: dataSource,
            _target_domain: targetDomain,
            _context_notes: contextNotes,
            _file_type: file.type,
            _original_name: file.name,
          },
        } as any)
        .select()
        .single();

      if (insertErr) throw insertErr;

      toast({ title: 'Fichier uploadé', description: 'Compilation IA en cours via Claude...' });
      setUploading(false);
      setProcessing(true);

      // 3. Trigger extraction & calibration
      const { data: extractResult, error: extractErr } = await supabase.functions.invoke('extract-pdf-data', {
        body: { audit_id: (audit as any).id },
      });

      if (extractErr) throw extractErr;

      setResult(extractResult);
      toast({ title: 'Calibration terminée ✅', description: 'Données compilées et signaux de calibration générés' });
      onUploadComplete();

    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Importer des données tiers
        </CardTitle>
        <CardDescription>
          Uploadez un export d'un SaaS tiers (SEMrush, Ahrefs, Sistrix, GSC…). Claude compilera les données
          et produira des signaux de calibration pour affiner l'algorithme de prédiction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Source des données *</Label>
          <Select value={dataSource} onValueChange={setDataSource}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner la source" />
            </SelectTrigger>
            <SelectContent>
              {DATA_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Domaine cible *</Label>
          <Input
            placeholder="example.com"
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Fichier (PDF, CSV, XLSX) *</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.json,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-2">
          <Label>Notes de contexte (optionnel)</Label>
          <Textarea
            placeholder="Ex: export SEMrush organic keywords France, période mars 2026, focus e-commerce…"
            value={contextNotes}
            onChange={(e) => setContextNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !dataSource || !targetDomain || uploading || processing}
          className="w-full"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Upload en cours...</>
          ) : processing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Compilation Claude en cours...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Importer et calibrer</>
          )}
        </Button>

        {result?.calibration_signals && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Calibration réussie</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Confiance: <Badge variant="outline">{result.calibration_signals.confidence_level}</Badge></span>
                </div>

                {result.calibration_signals.keyword_benchmarks && (
                  <div>
                    <strong>Benchmarks mots-clés:</strong> {result.calibration_signals.keyword_benchmarks.total_keywords} mots-clés,
                    vol. moyen {result.calibration_signals.keyword_benchmarks.avg_volume}
                  </div>
                )}

                {result.calibration_signals.ranking_distribution && (
                  <div>
                    <strong>Distribution ranking:</strong>{' '}
                    Top 3: {result.calibration_signals.ranking_distribution.top_3},
                    Top 10: {result.calibration_signals.ranking_distribution.top_10},
                    Top 20: {result.calibration_signals.ranking_distribution.top_20}
                  </div>
                )}

                {result.calibration_signals.adjustments?.length > 0 && (
                  <div>
                    <strong>Ajustements proposés:</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {result.calibration_signals.adjustments.map((adj: any, i: number) => (
                        <li key={i} className="text-muted-foreground">
                          <Badge variant={adj.impact === 'high' ? 'default' : 'secondary'} className="mr-1 text-xs">
                            {adj.impact}
                          </Badge>
                          {adj.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.calibration_signals.summary && (
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  {result.calibration_signals.summary}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
