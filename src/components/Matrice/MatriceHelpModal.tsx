import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileSpreadsheet, Lightbulb, Layers } from 'lucide-react';

interface MatriceHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELDS = [
  { name: 'prompt', desc: 'Critère ou KPI à évaluer', required: true },
  { name: 'poids', desc: 'Pondération (défaut : 1)', required: false },
  { name: 'axe', desc: 'Catégorie (défaut : Général)', required: false },
  { name: 'seuil_bon / moyen / mauvais', desc: 'Seuils de notation', required: false },
  { name: 'llm_name', desc: 'Modèle IA (défaut : Gemini Flash)', required: false },
];

export function MatriceHelpModal({ open, onOpenChange }: MatriceHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/50">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Matrice d'audit — guide rapide</h2>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* What is it — condensed */}
          <section className="flex gap-2.5">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Créez vos grilles d'audit sur-mesure. Chaque critère est évalué par le <strong className="text-foreground">moteur Crawlers</strong> et par un <strong className="text-foreground">LLM</strong> pour une double lecture de conformité.
            </p>
          </section>

          {/* 3 modes — inline */}
          <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-xs text-muted-foreground flex gap-4">
            <span><strong className="text-foreground">Import</strong> CSV/XLSX/DOCX</span>
            <span className="text-border">|</span>
            <span><strong className="text-foreground">Saisie</strong> manuelle</span>
            <span className="text-border">|</span>
            <span><strong className="text-foreground">Templates</strong> pré-définis</span>
          </div>

          {/* Fields table — compact */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Colonnes reconnues</h3>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="text-left px-3 py-1.5 font-semibold text-foreground">Champ</th>
                    <th className="text-left px-3 py-1.5 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f, i) => (
                    <tr key={f.name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-3 py-1.5 font-mono text-primary whitespace-nowrap">
                        {f.name}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Seul <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">prompt</code> est obligatoire. Le parseur détecte automatiquement les variantes de noms de colonnes.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}