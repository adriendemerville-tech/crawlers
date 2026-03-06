import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Normalization ───────────────────────────────────────────

export function normalizeUrl(input: string): string {
  let normalized = input.trim();
  if (!normalized) return '';
  normalized = normalized.replace(/^["'<]+|["'>]+$/g, '');
  let withoutProtocol = normalized.toLowerCase().replace(/^https?:\/\//, '');
  // Replace spaces with hyphens (brand names like "croix rouge" → "croix-rouge")
  withoutProtocol = withoutProtocol.replace(/\s+/g, '-');
  withoutProtocol = withoutProtocol.replace(/\.{2,}/g, '.');
  withoutProtocol = withoutProtocol.replace(/\.(\/)/, '$1').replace(/\.$/, '');
  return `https://${withoutProtocol}`;
}

// ─── Typo candidate generator ──────────────────────────────

export function generateTypoCandidates(domain: string): string[] {
  const candidates: string[] = [];
  const domainPart = domain.split('/')[0];
  const pathPart = domain.includes('/') ? domain.slice(domain.indexOf('/')) : '';
  const tlds = ['com', 'fr', 'org', 'net', 'io', 'co', 'eu', 'de', 'es', 'it', 'uk', 'be', 'ch'];

  // 1. TLD typo fixes
  const domainTypoFixes: Record<string, string> = {
    '.con': '.com', '.cmo': '.com', '.ocm': '.com', '.co,': '.com',
    '.fre': '.fr', '.f': '.fr', '.frr': '.fr',
    '.rog': '.org', '.ogr': '.org',
    '.nte': '.net', '.met': '.net',
    '.oi': '.io', '.gio': '.io',
  };
  for (const [typo, fix] of Object.entries(domainTypoFixes)) {
    if (domainPart.endsWith(typo)) {
      candidates.push(domainPart.replace(typo, fix) + pathPart);
    }
  }

  // 2. Missing dot before TLD
  for (const ext of tlds) {
    const regex = new RegExp(`([a-z0-9])${ext}$`, 'i');
    if (!domainPart.includes('.') && regex.test(domainPart)) {
      candidates.push(domainPart.replace(regex, `$1.${ext}`) + pathPart);
    }
  }

  // 3. No TLD at all
  if (!domainPart.includes('.')) {
    for (const ext of ['fr', 'com', 'org', 'net', 'io']) {
      candidates.push(domainPart + '.' + ext + pathPart);
    }
  }

  // 4. Alternative TLDs
  if (domainPart.includes('.')) {
    const parts = domainPart.split('.');
    const name = parts.slice(0, -1).join('.');
    const currentTld = parts[parts.length - 1];
    const altTlds = ['fr', 'com', 'org', 'net', 'io', 'eu', 'co'].filter(t => t !== currentTld);
    for (const alt of altTlds) {
      candidates.push(name + '.' + alt + pathPart);
    }
  }

  // 5. Character-level substitutions
  const charSubs: Record<string, string[]> = {
    z: ['s'], s: ['z'], c: ['k'], k: ['c'], ph: ['f'], f: ['ph'],
    x: ['s', 'ks'], q: ['k'], w: ['v'], v: ['w'], y: ['i'], i: ['y'],
    ee: ['e'], oo: ['o'], ll: ['l'], ss: ['s'], tt: ['t'], nn: ['n'],
  };
  const namePart = domainPart.includes('.') ? domainPart.split('.').slice(0, -1).join('.') : domainPart;
  const tldPart = domainPart.includes('.') ? '.' + domainPart.split('.').pop() : '';
  const tldsToTry = tldPart ? [tldPart, ...['.fr', '.com'].filter(t => t !== tldPart)] : ['.fr', '.com'];

  for (const [from, toList] of Object.entries(charSubs)) {
    if (namePart.includes(from)) {
      for (const to of toList) {
        const fixed = namePart.replace(from, to);
        for (const t of tldsToTry) {
          candidates.push(fixed + t + pathPart);
        }
      }
    }
  }

  // 6. Remove each character one at a time
  if (namePart.length > 3) {
    for (let i = 0; i < namePart.length; i++) {
      const fixed = namePart.slice(0, i) + namePart.slice(i + 1);
      if (fixed.length >= 3) {
        for (const t of tldsToTry) {
          candidates.push(fixed + t + pathPart);
        }
      }
    }
  }

  // 7. Swap adjacent characters
  if (namePart.length > 2) {
    for (let i = 0; i < namePart.length - 1; i++) {
      const swapped = namePart.slice(0, i) + namePart[i + 1] + namePart[i] + namePart.slice(i + 2);
      for (const t of tldsToTry) {
        candidates.push(swapped + t + pathPart);
      }
    }
  }

  return [...new Set(candidates)];
}

// ─── Server-side validation ─────────────────────────────────

async function validateUrls(
  urls: string[],
  searchBrand?: string
): Promise<{ results: Array<{ url: string; valid: boolean }>; brandResult?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-url', {
      body: { urls, searchBrand },
    });
    if (error || !data?.results) return { results: urls.map(u => ({ url: u, valid: false })) };
    return { results: data.results, brandResult: data.brandResult || undefined };
  } catch {
    return { results: urls.map(u => ({ url: u, valid: false })) };
  }
}

// ─── Core validation function ───────────────────────────────

export type UrlValidationResult = {
  validUrl: string | null;
  originalValid: boolean;
};

export async function findValidUrl(normalizedUrl: string): Promise<UrlValidationResult> {
  const withoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');

  const candidates = generateTypoCandidates(withoutProtocol);
  const allUrls = [normalizedUrl, ...candidates.slice(0, 9).map(c => `https://${c}`)];
  const uniqueUrls = [...new Set(allUrls)];

  // Pass the brand name for LLM search fallback
  const brandName = withoutProtocol.split('.')[0].split('/')[0];
  const { results, brandResult } = await validateUrls(uniqueUrls, brandName);

  const originalResult = results.find(r => r.url === normalizedUrl);
  if (originalResult?.valid) return { validUrl: normalizedUrl, originalValid: true };

  const validCandidate = results.find(r => r.valid && r.url !== normalizedUrl);
  if (validCandidate) return { validUrl: validCandidate.url, originalValid: false };

  // Fallback: use brand search result from LLM
  if (brandResult) return { validUrl: brandResult, originalValid: false };

  return { validUrl: null, originalValid: false };
}

// ─── React hook ─────────────────────────────────────────────

export type UrlValidationState = {
  isValidating: boolean;
  suggestedUrl: string | null;
  urlNotFound: boolean;
};

export function useUrlValidation(language: string = 'fr') {
  const [isValidating, setIsValidating] = useState(false);
  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const [urlNotFound, setUrlNotFound] = useState(false);

  const resetValidation = useCallback(() => {
    setSuggestedUrl(null);
    setUrlNotFound(false);
  }, []);

  const dismissSuggestion = useCallback(() => {
    setSuggestedUrl(null);
  }, []);

  const dismissNotFound = useCallback(() => {
    setUrlNotFound(false);
  }, []);

  /**
   * Validate and correct a URL before submitting to a scan/audit.
   * Returns the valid URL if original is OK, or null if correction/error UI is shown.
   * When a suggestion is found, it sets `suggestedUrl` state.
   * When nothing is found, it sets `urlNotFound` state.
   */
  const validateAndCorrect = useCallback(async (
    rawUrl: string,
    onValidUrl: (url: string) => void,
  ) => {
    if (!rawUrl.trim()) return;
    const normalizedUrl = normalizeUrl(rawUrl);
    setSuggestedUrl(null);
    setUrlNotFound(false);
    setIsValidating(true);

    try {
      const { validUrl, originalValid } = await findValidUrl(normalizedUrl);

      if (originalValid) {
        setIsValidating(false);
        onValidUrl(normalizedUrl);
        return;
      }

      if (validUrl) {
        // Found a correction — ask the user
        setIsValidating(false);
        setSuggestedUrl(validUrl);
        return;
      }

      // No valid URL found at all
      setIsValidating(false);
      setUrlNotFound(true);
      setTimeout(() => setUrlNotFound(false), 5000);
    } catch {
      // Validation network error — proceed with original
      setIsValidating(false);
      onValidUrl(normalizedUrl);
    }
  }, []);

  const getNotFoundMessage = useCallback(() => {
    switch (language) {
      case 'fr': return 'Cette URL ne pointe vers aucune page existante';
      case 'es': return 'Esta URL no apunta a ninguna página existente';
      default: return 'This URL does not point to any existing page';
    }
  }, [language]);

  const getSuggestionPrefix = useCallback(() => {
    switch (language) {
      case 'fr': return 'Voulez-vous dire';
      case 'es': return '¿Quiso decir';
      default: return 'Did you mean';
    }
  }, [language]);

  return {
    isValidating,
    suggestedUrl,
    urlNotFound,
    validateAndCorrect,
    resetValidation,
    dismissSuggestion,
    dismissNotFound,
    acceptSuggestion: (url: string, onValidUrl: (url: string) => void) => {
      setSuggestedUrl(null);
      onValidUrl(url);
    },
    getNotFoundMessage,
    getSuggestionPrefix,
  };
}
