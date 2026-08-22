/**
 * taxProfile.server.ts (L1a.22)
 *
 * Profil fiscal du vendeur — prérequis bloquant à toute mise en vente (§6).
 * Le mandat d'auto-facturation doit être accepté explicitement : Crawlers émet
 * la facture au nom du vendeur, ce qui exige un mandat horodaté.
 */

import type { TaxStatus } from './types';

export interface TaxProfileInput {
  tax_status: TaxStatus;
  legal_name: string;
  address?: string;
  country_code: string;
  siren_siret?: string;
  vat_number?: string;
  accept_self_billing: boolean;
}

export interface TaxProfileRecord {
  tax_status: TaxStatus | null;
  legal_name: string | null;
  address: string | null;
  country_code: string;
  siren_siret: string | null;
  vat_number: string | null;
  vat_number_valid: boolean | null;
  self_billing_mandate_accepted_at: string | null;
  is_complete: boolean;
  missing: string[];
}

const VAT_FORMAT = /^[A-Z]{2}[0-9A-Z]{2,13}$/;
const SIREN_SIRET = /^\d{9}(\d{5})?$/;

function missingFields(input: TaxProfileInput): string[] {
  const missing: string[] = [];
  if (!input.legal_name?.trim()) missing.push('legal_name');
  if (!input.country_code?.trim()) missing.push('country_code');
  if (input.tax_status !== 'individual' && !input.siren_siret?.trim()) missing.push('siren_siret');
  if (input.tax_status === 'company_vat' && !input.vat_number?.trim()) missing.push('vat_number');
  if (!input.accept_self_billing) missing.push('self_billing_mandate');
  return missing;
}

export async function readTaxProfile(
  sb: { from: (t: string) => any },
  userId: string,
): Promise<TaxProfileRecord> {
  const { data, error } = await sb
    .from('marketplace_tax_profiles')
    .select(
      'tax_status, legal_name, address, country_code, siren_siret, vat_number, vat_number_valid, self_billing_mandate_accepted_at, is_complete',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Profil fiscal illisible : ${error.message}`);
  if (!data) {
    return {
      tax_status: null,
      legal_name: null,
      address: null,
      country_code: 'FR',
      siren_siret: null,
      vat_number: null,
      vat_number_valid: null,
      self_billing_mandate_accepted_at: null,
      is_complete: false,
      missing: ['legal_name', 'siren_siret', 'self_billing_mandate'],
    };
  }
  return { ...data, missing: data.is_complete ? [] : ['profil à compléter'] } as TaxProfileRecord;
}

export async function saveTaxProfile(
  sb: { from: (t: string) => any },
  userId: string,
  input: TaxProfileInput,
): Promise<TaxProfileRecord> {
  const missing = missingFields(input);

  const siren = input.siren_siret?.replace(/\s+/g, '') || null;
  if (siren && !SIREN_SIRET.test(siren)) throw new Error('SIREN/SIRET invalide (9 ou 14 chiffres)');

  const vat = input.vat_number?.replace(/\s+/g, '').toUpperCase() || null;
  if (vat && !VAT_FORMAT.test(vat)) throw new Error('Numéro de TVA au format invalide');

  const now = new Date().toISOString();
  const { error } = await sb.from('marketplace_tax_profiles').upsert(
    {
      user_id: userId,
      tax_status: input.tax_status,
      legal_name: input.legal_name.trim(),
      address: input.address?.trim() || null,
      country_code: input.country_code.toUpperCase(),
      siren_siret: siren,
      vat_number: vat,
      // La validation VIES arrive avec le lot Stripe/KYC (L1b) : on n'affirme rien ici.
      vat_number_valid: null,
      self_billing_mandate_accepted_at: input.accept_self_billing ? now : null,
      self_billing_mandate_version: input.accept_self_billing ? 1 : null,
      is_complete: missing.length === 0,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`Profil fiscal non enregistré : ${error.message}`);

  return readTaxProfile(sb, userId);
}
