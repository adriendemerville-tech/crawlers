import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, FileSpreadsheet, Lightbulb, Layers } from 'lucide-react';
import { CrawlersLogo } from '@/components/Support/CrawlersLogo';

interface MatriceHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELDS = [
  { name: 'prompt', desc: 'Le critère ou KPI à évaluer', aliases: 'critère, kpi, indicateur, question, rule, label…', required: true },
  { name: 'poids', desc: 'Pondération du critère (défaut : 1)', aliases: 'weight, importance, priorité, coefficient', required: false },
  { name: 'axe', desc: 'Catégorie de classement (défaut : Général)', aliases: 'catégorie, category, domaine, section, thème', required: false },
  { name: 'seuil_bon', desc: 'Score minimum pour "bon" (défaut : 70)', aliases: 'threshold good, bon, green, target', required: false },
  { name: 'seuil_moyen', desc: 'Score minimum pour "moyen" (défaut : 40)', aliases: 'threshold medium, moyen, orange, warning', required: false },
  { name: 'seuil_mauvais', desc: 'Score plancher "mauvais" (défaut : 0)', aliases: 'threshold bad, mauvais, rouge, red, fail', required: false },
  { name: 'llm_name', desc: 'Modèle IA à utiliser (défaut : Gemini Flash)', aliases: 'llm, model, modèle, moteur, engine', required: false },
];

export function MatriceHelpModal({ open, onOpenChange }: MatriceHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Comment utiliser la Matrice d'audit</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Section 1 — What is it */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">À quoi ça sert ?</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              La Matrice d'audit est un <strong className="text-foreground">moteur d'évaluation sur-mesure</strong>. 
              Elle vous permet de créer vos propres grilles d'audit en définissant vos critères, pondérations et seuils. 
              Chaque critère est évalué automatiquement par notre moteur (Crawlers Score) et par un LLM (Parsed Score), 
              ce qui vous donne une <strong className="text-foreground">double lecture</strong> de la conformité de vos pages.
            </p>
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong className="text-foreground">3 façons de l'utiliser :</strong></p>
              <ol className="list-decimal pl-4 space-y-1">
                <li><strong>Import de fichier</strong> — importez un CSV, XLSX ou DOCX contenant vos critères. Le parseur détecte automatiquement les colonnes grâce à un algorithme de correspondance floue (Dice coefficient).</li>
                <li><strong>Saisie manuelle</strong> — ajoutez vos critères un par un directement dans le tableau.</li>
                <li><strong>Templates</strong> — chargez un lot de critères pré-définis (E-E-A-T, Technique, Performance) et personnalisez-les.</li>
              </ol>
            </div>
          </section>

          {/* Section 2 — Document structure */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Bien structurer son document</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nommez vos colonnes avec les termes ci-dessous. Le parseur reconnaît aussi leurs variantes 
              (français, anglais, abréviations). Seul <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">prompt</code> est obligatoire.
            </p>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Champ</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground">Description</th>
                    <th className="text-left px-3 py-2 font-semibold text-foreground hidden sm:table-cell">Alias reconnus</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f, i) => (
                    <tr key={f.name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-3 py-2 font-mono text-primary whitespace-nowrap">
                        {f.name}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{f.desc}</td>
                      <td className="px-3 py-2 text-muted-foreground/70 hidden sm:table-cell">{f.aliases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              💡 Si vos colonnes ont des noms différents, le parseur essaie de les deviner par analyse du contenu (texte long → prompt, nombre 0-100 → seuil, etc.).
            </p>
          </section>

          {/* Felix CTA */}
          <div className="flex items-center gap-3 pt-2 pb-1 border-t border-border/30">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <CrawlersLogo size={18} />
            </div>
            <p className="text-sm text-muted-foreground">
              Et si tu as besoin d'aide, <strong className="text-foreground">demande à Félix !</strong>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
