import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  onUploadComplete: () => void;
}

export function PdfUploader({ onUploadComplete }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<{ user_id: string; email: string; first_name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load clients list on first render
  useState(() => {
    supabase.from('profiles').select('user_id, email, first_name, last_name').then(({ data }) => {
      if (data) setClients(data as any);
    });
  });

  const handleUpload = async () => {
    if (!file || !clientId) {
      toast({ title: 'Erreur', description: 'Sélectionnez un fichier et un client', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // 1. Upload to storage
      const filePath = `${clientId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('pdf-audits')
        .upload(filePath, file, { contentType: 'application/pdf' });

      if (uploadErr) throw uploadErr;

      // 2. Create audit record
      const { data: audit, error: insertErr } = await supabase
        .from('pdf_audits')
        .insert({ client_id: clientId, file_path: filePath, status: 'pending' } as any)
        .select()
        .single();

      if (insertErr) throw insertErr;

      toast({ title: 'PDF uploadé', description: 'Extraction IA en cours...' });
      setUploading(false);
      setExtracting(true);

      // 3. Trigger extraction
      const { data: extractResult, error: extractErr } = await supabase.functions.invoke('extract-pdf-data', {
        body: { audit_id: (audit as any).id },
      });

      if (extractErr) throw extractErr;

      setResult(extractResult);
      toast({ title: 'Extraction terminée ✅', description: 'Données structurées extraites avec succès' });
      onUploadComplete();

    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Déposer un audit PDF
        </CardTitle>
        <CardDescription>
          Uploadez un rapport d'audit SEO/GEO. L'IA extraira automatiquement les données structurées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.first_name} — {c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fichier PDF</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !clientId || uploading || extracting}
          className="w-full"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Upload en cours...</>
          ) : extracting ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Extraction IA...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Uploader et analyser</>
          )}
        </Button>

        {result?.extracted_data && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Extraction réussie</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Erreurs techniques: <strong>{result.extracted_data.errors}</strong></div>
                <div>Score technique: <strong>{result.extracted_data.technical_score}/100</strong></div>
                <div>Mots-clés GEO: <strong>{result.extracted_data.geo_keywords?.length || 0}</strong></div>
                <div>Cible: <strong>{result.extracted_data.location_target}</strong></div>
              </div>
              {result.extracted_data.summary && (
                <p className="text-xs text-muted-foreground mt-2">{result.extracted_data.summary}</p>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
