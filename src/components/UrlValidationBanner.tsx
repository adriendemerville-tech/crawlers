import { memo } from 'react';

interface UrlValidationBannerProps {
  suggestedUrl: string | null;
  urlNotFound: boolean;
  suggestionPrefix: string;
  notFoundMessage: string;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  onDismissNotFound: () => void;
}

function UrlValidationBannerComponent({
  suggestedUrl,
  urlNotFound,
  suggestionPrefix,
  notFoundMessage,
  onAcceptSuggestion,
  onDismissSuggestion,
  onDismissNotFound,
}: UrlValidationBannerProps) {
  if (!suggestedUrl && !urlNotFound) return null;

  return (
    <>
      {suggestedUrl && (
        <div className="mx-auto mt-3 max-w-3xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-sm text-foreground">
              {suggestionPrefix}{' '}
              <button
                onClick={onAcceptSuggestion}
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                {suggestedUrl.replace(/^https?:\/\//, '')}
              </button>
              {' ?'}
            </p>
            <button
              onClick={onDismissSuggestion}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {urlNotFound && (
        <div className="mx-auto mt-4 max-w-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4 shadow-lg">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <p className="text-sm font-medium text-foreground text-center">
              {notFoundMessage}
            </p>
            <button
              onClick={onDismissNotFound}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const UrlValidationBanner = memo(UrlValidationBannerComponent);
