/**
 * Canva Integration — Frontend API layer
 * Wraps Canva edge functions into a clean API.
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───

export interface CanvaConnection {
  id: string;
  user_id: string;
  tracked_site_id: string | null;
  canva_user_id: string | null;
  canva_team_id: string | null;
  display_name: string | null;
  scopes: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CanvaDesign {
  id: string;
  title: string;
  url: string;
  thumbnail?: { url: string; width: number; height: number };
  created_at: string;
  updated_at: string;
}

export interface CanvaTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string };
}

// ─── OAuth ───

export async function initiateCanvaOAuth(trackedSiteId?: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('canva-oauth-init', {
    body: { tracked_site_id: trackedSiteId },
  });
  if (error) throw error;
  return data;
}

export async function disconnectCanva(trackedSiteId?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('canva-api-proxy', {
    body: { action: 'disconnect', tracked_site_id: trackedSiteId },
  });
  if (error) throw error;
}

// ─── Connection Status ───

export async function fetchCanvaConnection(trackedSiteId?: string): Promise<CanvaConnection | null> {
  let query = supabase
    .from('canva_connections' as any)
    .select('id, user_id, tracked_site_id, canva_user_id, canva_team_id, display_name, scopes, status, created_at, updated_at')
    .eq('status', 'active');

  if (trackedSiteId) {
    query = query.eq('tracked_site_id', trackedSiteId);
  }

  const { data, error } = await query.limit(1).single();
  if (error?.code === 'PGRST116') return null; // No rows
  if (error) throw error;
  return data as unknown as CanvaConnection;
}

// ─── Canva API Actions ───

async function canvaAction(action: string, params: Record<string, any> = {}, trackedSiteId?: string) {
  const { data, error } = await supabase.functions.invoke('canva-api-proxy', {
    body: { action, tracked_site_id: trackedSiteId, params },
  });
  if (error) throw error;
  return data;
}

export async function getCanvaUser(trackedSiteId?: string) {
  return canvaAction('get_user', {}, trackedSiteId);
}

export async function listCanvaDesigns(query?: string, trackedSiteId?: string) {
  return canvaAction('list_designs', { query }, trackedSiteId);
}

export async function getCanvaDesign(designId: string, trackedSiteId?: string) {
  return canvaAction('get_design', { design_id: designId }, trackedSiteId);
}

export async function listCanvaTemplates(trackedSiteId?: string) {
  return canvaAction('list_templates', {}, trackedSiteId);
}

export async function createCanvaDesign(params: { title: string; template_id?: string; design_type?: string }, trackedSiteId?: string) {
  return canvaAction('create_design', params, trackedSiteId);
}

export async function exportCanvaDesign(designId: string, format: 'png' | 'jpg' | 'pdf' = 'png', trackedSiteId?: string) {
  return canvaAction('export_design', { design_id: designId, format }, trackedSiteId);
}

export async function getCanvaExport(exportId: string, trackedSiteId?: string) {
  return canvaAction('get_export', { export_id: exportId }, trackedSiteId);
}

export async function uploadCanvaAsset(name: string, folderId?: string, trackedSiteId?: string) {
  return canvaAction('upload_asset', { name, folder_id: folderId }, trackedSiteId);
}

export async function listCanvaFolders(trackedSiteId?: string) {
  return canvaAction('list_folders', {}, trackedSiteId);
}

export async function autofillCanvaTemplate(templateId: string, data: Record<string, any>, title?: string, trackedSiteId?: string) {
  return canvaAction('autofill', { template_id: templateId, data, title }, trackedSiteId);
}
