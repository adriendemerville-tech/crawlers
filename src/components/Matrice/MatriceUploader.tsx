/**
 * MatriceUploader — Drop zone for DOCX / CSV / XLSX matrix files.
 * Charte: violet border, no bg fill, no emoji, no IA-blue.
 */

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED = ['.docx', '.csv', '.xlsx', '.xls'];
const MAX_SIZE_MB = 20;

export interface MatriceUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

export function MatriceUploader({ onFileSelected, disabled, className }: MatriceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateAndSet = useCallback((file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Format non supporté. Accepté : ${ACCEPTED.join(', ')}`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo)`);
      return;
    }
    setSelected(file);
    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  }, [disabled, validateAndSet]);

  const reset = () => {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (selected) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-3',
          'border-2 border-brand-violet rounded-md bg-transparent',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-brand-violet shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selected.size / 1024).toFixed(1)} Ko
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label="Retirer le fichier"
          className="border border-foreground/40 text-foreground rounded-md p-1.5 hover:border-foreground transition-colors bg-transparent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <label
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 py-10',
          'border-2 border-dashed rounded-md cursor-pointer transition-colors bg-transparent',
          dragActive ? 'border-brand-gold' : 'border-brand-violet',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Upload className="h-8 w-8 text-brand-violet" aria-hidden />
        <div className="text-center">
          <p className="text-sm font-medium">
            Déposer votre matrice ou cliquer pour choisir
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            DOCX, CSV, XLSX — max {MAX_SIZE_MB} Mo
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) validateAndSet(f);
          }}
          className="sr-only"
        />
      </label>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}

export default MatriceUploader;
