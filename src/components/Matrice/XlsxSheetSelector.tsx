import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
  open: boolean;
  sheetNames: string[];
  onSelect: (sheetName: string) => void;
  onClose: () => void;
}

export default function XlsxSheetSelector({ open, sheetNames, onSelect, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choisir un onglet</DialogTitle>
          <DialogDescription>
            Ce fichier contient {sheetNames.length} onglets. Sélectionnez celui à importer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {sheetNames.map((name) => (
            <Button
              key={name}
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => onSelect(name)}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
