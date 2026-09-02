import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Building2, CheckCircle2, FileCheck2, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from '@/lib/router-compat';
import { claimStartupTrialToken, verifyStartupSiret } from '@/lib/startupTrial.functions';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function StartupTrialOffer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const verify = useServerFn(verifyStartupSiret);
  const claim = useServerFn(claimStartupTrialToken);
  const [open, setOpen] = useState(false);
  const [siret, setSiret] = useState('');
  const [company, setCompany] = useState<{ legalName: string; creationDate: string; siret: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [manualReview, setManualReview] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { siret } }),
    onSuccess: (result) => {
      if (!result.eligible || !result.legalName || !result.creationDate || !result.siret) {
        setCompany(null);
        setError(result.reason ?? 'Entreprise non éligible.');
        return;
      }
      setError('');
      setCompany({ legalName: result.legalName, creationDate: result.creationDate, siret: result.siret });
    },
    onError: (err: Error) => setError(err.message),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!company || !file) throw new Error('Complétez la vérification et joignez le Kbis.');
      if (file.type !== 'application/pdf' || file.size > MAX_FILE_SIZE) throw new Error('Le Kbis doit être un PDF de 10 Mo maximum.');
      const kbisPdfBase64 = await fileToBase64(file);
      return claim({ data: { siret: company.siret, kbisPdfBase64 } });
    },
    onSuccess: (result) => {
      if (result.status === 'approved' && result.token) {
        // Le jeton encode la gratuité : il est consommé dès qu'une session existe.
        sessionStorage.setItem('startup_trial_token', result.token);
        toast.success('Kbis conforme : créez votre compte pour activer vos 12 mois offerts.');
        if (user) {
          navigate('/app/console?startup=' + encodeURIComponent(result.token));
        } else {
          navigate('/signup?startup=' + encodeURIComponent(result.token));
        }
        return;
      }
      if (result.status === 'review') {
        setManualReview(true);
        return;
      }
      setError(result.reason ?? 'Vérification refusée.');
    },
    onError: (err: Error) => setError(err.message),
  });

  if (manualReview) {
    return (
      <Alert className="border-amber-500/50 bg-amber-500/5">
        <FileCheck2 className="h-5 w-5 text-amber-500" />
        <AlertTitle>Dossier en attente de vérification</AlertTitle>
        <AlertDescription>Le SIRET est éligible, mais le Kbis nécessite une vérification manuelle avant l’activation de l’offre.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-amber-500" />
          <div>
            <CardTitle>Un an offert pour les jeunes entreprises</CardTitle>
            <CardDescription className="mt-1">Entreprises et freelances immatriculés depuis moins de 12 mois : Pro Agency offert pendant un an, sans compte préalable.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>Vérifier mon éligibilité</Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="startup-siret">SIRET</Label>
                <Input id="startup-siret" inputMode="numeric" value={siret} onChange={(event) => { setSiret(event.target.value); setCompany(null); setError(''); }} placeholder="14 chiffres" />
              </div>
              <Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending && <Loader2 className="animate-spin" />}
                Vérifier le SIRET
              </Button>
            </div>

            {company && (
              <div className="flex items-start gap-3 border border-emerald-500/40 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div><p className="font-medium">{company.legalName}</p><p className="text-muted-foreground">Création : {new Date(company.creationDate).toLocaleDateString('fr-FR')}</p></div>
              </div>
            )}

            {company && <div className="space-y-2"><Label htmlFor="startup-kbis">Extrait Kbis (PDF, 10 Mo maximum)</Label><Input id="startup-kbis" type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Le document est conservé dans un espace privé et rapproché automatiquement du SIRET et de la raison sociale.</p></div>}

            {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            {company && <Button variant="outline" onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending || !file}>
              {claimMutation.isPending ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
              {user ? 'Activer mon année Pro Agency' : 'Valider et créer mon compte'}
            </Button>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Upload className="h-3.5 w-3.5" />Si le Kbis est conforme, vous êtes redirigé vers l’inscription avec vos 12 mois déjà acquis.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
