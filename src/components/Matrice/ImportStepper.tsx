import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Search, Trash2, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { detectMatriceType, type MatriceType, type DetectionResult } from '@/utils/matrice/typeDetector';
import { cleanImportedData, type CleaningResult } from '@/utils/matrice/columnCleaner';

/* ── Types ─────────────────────────────────────────────────────────── */

type Step = 'sheet' | 'type' | 'clean' | 'confirm';

interface Props {
  open: boolean;
  sheetNames: string[];
  workbook: any; // xlsx WorkbookType
  onComplete: (data: {
    rows: Record<string, any>[];
    sheetName: string;
    matriceType: MatriceType;
    cleaningResult: CleaningResult;
  }) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<MatriceType, { label: string; desc: string; color: string }> = {
  seo: { label: 'SEO', desc: 'Audit technique, balises, performance, structured data', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  geo: { label: 'GEO', desc: 'Citabilité IA, visibilité moteurs génératifs, scoring multi-LLM', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  hybrid: { label: 'Hybride', desc: 'Critères SEO + GEO combinés', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

const STEPS: { key: Step; label: string }[] = [
  { key: 'sheet', label: 'Onglet' },
  { key: 'type', label: 'Type' },
  { key: 'clean', label: 'Nettoyage' },
  { key: 'confirm', label: 'Import' },
];

/* ── Component ─────────────────────────────────────────────────────── */

export default function ImportStepper({ open, sheetNames, workbook, onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>(sheetNames.length > 1 ? 'sheet' : 'type');
  const [selectedSheet, setSelectedSheet] = useState<string>(sheetNames[0] || '');
  const [selectedType, setSelectedType] = useState<MatriceType | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [cleaning, setCleaning] = useState<CleaningResult | null>(null);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // ── Sheet selection ────────────────────────────────────────────────
  const handleSheetSelect = async (sheetName: string) => {
    setSelectedSheet(sheetName);
    const { utils } = await import('xlsx');
    const sheet = workbook.Sheets[sheetName];
    const rows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    if (!rows.length) return;
    const h = Object.keys(rows[0]);
    setHeaders(h);
    setRawRows(rows);

    // Auto-detect type
    const det = detectMatriceType(h, rows.slice(0, 10));
    setDetection(det);
    setSelectedType(det.type);
    setStep('type');
  };

  // If single sheet, auto-load on open
  useMemo(() => {
    if (sheetNames.length === 1 && workbook && rawRows.length === 0) {
      handleSheetSelect(sheetNames[0]);
    }
  }, [sheetNames, workbook]);

  // ── Type confirmation → trigger clean ──────────────────────────────
  const handleTypeConfirm = () => {
    if (!selectedType) return;
    const result = cleanImportedData(headers, rawRows);
    setCleaning(result);
    setStep('clean');
  };

  // ── Final import ───────────────────────────────────────────────────
  const handleImport = () => {
    if (!cleaning || !selectedType) return;
    onComplete({
      rows: cleaning.cleanedRows,
      sheetName: selectedSheet,
      matriceType: selectedType,
      cleaningResult: cleaning,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Matrice</DialogTitle>
        </DialogHeader>

        {/* ── Stepper bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => {
            // Skip sheet step if single sheet
            if (s.key === 'sheet' && sheetNames.length <= 1) return null;
            const isActive = s.key === step;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors w-full justify-center
                  ${isActive ? 'bg-primary/10 text-primary border border-primary/30' : ''}
                  ${isDone ? 'text-muted-foreground' : ''}
                  ${!isActive && !isDone ? 'text-muted-foreground/50' : ''}
                `}>
                  {isDone && <CheckCircle2 className="h-3 w-3" />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ── Step: Sheet ──────────────────────────────────────────── */}
        {step === 'sheet' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground mb-1">
              Ce fichier contient {sheetNames.length} onglets. Lequel importer ?
            </p>
            {sheetNames.map(name => (
              <Button
                key={name}
                variant="outline"
                className="justify-start gap-2 h-auto py-3"
                onClick={() => handleSheetSelect(name)}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </Button>
            ))}
          </div>
        )}

        {/* ── Step: Type ───────────────────────────────────────────── */}
        {step === 'type' && detection && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Type détecté automatiquement à partir des {headers.length} colonnes.
              Vous pouvez corriger si nécessaire.
            </p>

            {detection.confidence < 0.5 && (
              <p className="text-xs text-amber-400">
                ⚠ Confiance faible ({Math.round(detection.confidence * 100)}%) — vérifiez le type.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {(Object.keys(TYPE_LABELS) as MatriceType[]).map(t => {
                const info = TYPE_LABELS[t];
                const isSelected = selectedType === t;
                const isDetected = detection.type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                      ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                    `}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{info.label}</span>
                        {isDetected && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            détecté
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`} />
                  </button>
                );
              })}
            </div>

            {(detection.matchedGeo.length > 0 || detection.matchedSeo.length > 0) && (
              <div className="text-xs text-muted-foreground mt-1">
                <Search className="h-3 w-3 inline mr-1" />
                Signaux : {detection.matchedGeo.length} GEO, {detection.matchedSeo.length} SEO
              </div>
            )}

            <div className="flex justify-between mt-2">
              {sheetNames.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setStep('sheet')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Onglet
                </Button>
              )}
              <Button size="sm" className="ml-auto" onClick={handleTypeConfirm} disabled={!selectedType}>
                Continuer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Clean ──────────────────────────────────────────── */}
        {step === 'clean' && cleaning && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Nettoyage effectué. Les colonnes de résultats et données résiduelles ont été retirées.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-2xl font-bold text-foreground">{cleaning.stats.keptColumns}</div>
                <div className="text-xs text-muted-foreground">colonnes conservées</div>
              </div>
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="text-2xl font-bold text-destructive">{cleaning.stats.removedColumns}</div>
                <div className="text-xs text-muted-foreground">colonnes retirées</div>
              </div>
            </div>

            {cleaning.removedColumns.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs space-y-1 bg-muted/30 rounded-md p-2">
                {cleaning.removedColumns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3 text-destructive/60 shrink-0" />
                    <span className="text-muted-foreground truncate">{col.header}</span>
                    <span className="text-muted-foreground/50 ml-auto shrink-0">({col.reason})</span>
                  </div>
                ))}
              </div>
            )}

            {cleaning.keptColumns.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <strong>Colonnes gardées :</strong> {cleaning.keptColumns.join(', ')}
              </div>
            )}

            <div className="flex justify-between mt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Type
              </Button>
              <Button size="sm" onClick={() => setStep('confirm')}>
                Continuer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Confirm ────────────────────────────────────────── */}
        {step === 'confirm' && cleaning && selectedType && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Prêt à importer. Récapitulatif :
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Onglet</span>
                <span className="font-medium">{selectedSheet}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className={TYPE_LABELS[selectedType].color}>
                  {TYPE_LABELS[selectedType].label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Critères</span>
                <span className="font-medium">{cleaning.stats.cleanedRows} lignes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Colonnes</span>
                <span className="font-medium">{cleaning.stats.keptColumns} / {cleaning.stats.originalColumns}</span>
              </div>
            </div>

            <div className="flex justify-between mt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('clean')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Nettoyage
              </Button>
              <Button size="sm" onClick={handleImport}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Importer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
