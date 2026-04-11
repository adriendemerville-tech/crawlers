/**
 * Social Content Hub — Frontend API layer
 * Wraps all social edge functions into a clean API.
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───
export interface SocialPost {
  id: string;
  user_id: string;
  tracked_site_id: string | null;
  template_id: string | null;
  title: string | null;
  content_linkedin: string | null;
  content_facebook: string | null;
  content_instagram: string | null;
  hashtags: string[];
  mentions: any[];
  smart_link_url: string | null;
  smart_link_short: string | null;
  utm_params: any;
  image_urls: string[];
  canvas_data: any;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  external_ids: Record<string, string>;
  publish_platforms: string[];
  error_message: string | null;
  workbench_item_id: string | null;
  seasonal_context_id: string | null;
  source_keyword: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: string;
  platform: 'linkedin' | 'facebook' | 'instagram';
  account_name: string | null;
  page_id: string | null;
  status: string;
  tracked_site_id: string | null;
}

export interface SocialCalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  recurrence: string;
  color: string;
  post_id: string | null;
  platforms: string[];
  is_auto_generated: boolean;
}

export interface SocialMetrics {
  post_id: string;
  platform: string;
  impressions: number;
  clicks: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
  reach: number;
  measured_at: string;
}

// ─── CRUD Operations (direct Supabase) ───

export async function fetchPosts(trackedSiteId?: string, status?: string) {
  let query = supabase.from('social_posts' as any).select('*').order('created_at', { ascending: false }).limit(100);
  if (trackedSiteId) query = query.eq('tracked_site_id', trackedSiteId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as SocialPost[];
}

export async function createPost(post: Partial<SocialPost>) {
  const { data, error } = await supabase.from('social_posts' as any).insert(post).select().single();
  if (error) throw error;
  return data as unknown as SocialPost;
}

export async function updatePost(id: string, updates: Partial<SocialPost>) {
  const { data, error } = await supabase.from('social_posts' as any).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as unknown as SocialPost;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('social_posts' as any).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAccounts(trackedSiteId?: string) {
  let query = supabase.from('social_accounts' as any).select('*').eq('status', 'active');
  if (trackedSiteId) query = query.eq('tracked_site_id', trackedSiteId);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as SocialAccount[];
}

export async function fetchCalendarEvents(trackedSiteId: string, month?: string) {
  let query = supabase.from('social_calendars' as any).select('*').eq('tracked_site_id', trackedSiteId).order('event_date', { ascending: true });
  if (month) {
    const start = `${month}-01`;
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0);
    query = query.gte('event_date', start).lte('event_date', endDate.toISOString().split('T')[0]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as SocialCalendarEvent[];
}

export async function fetchPostMetrics(postId: string) {
  const { data, error } = await supabase.from('social_post_metrics' as any).select('*').eq('post_id', postId).order('measured_at', { ascending: false });
  if (error) throw error;
  return data as unknown as SocialMetrics[];
}

// ─── Edge Function Calls ───

export async function generateContent(params: { topic?: string; keyword?: string; workbench_item_id?: string; tracked_site_id?: string; platforms?: string[]; tone?: string; custom_instructions?: string }) {
  const { data, error } = await supabase.functions.invoke('generate-social-content', { body: params });
  if (error) throw error;
  return data;
}

export async function generateImage(params: { prompt: string; canvas_data?: any; platform?: string; branding?: any }) {
  const { data, error } = await supabase.functions.invoke('generate-social-image', { body: params });
  if (error) throw error;
  return data;
}

export async function publishPost(postId: string) {
  const { data, error } = await supabase.functions.invoke('publish-to-social', { body: { post_id: postId } });
  if (error) throw error;
  return data;
}

export async function exportZip(postIds: string[]) {
  const { data, error } = await supabase.functions.invoke('export-social-zip', { body: { post_ids: postIds } });
  if (error) throw error;
  return data;
}

export async function refreshStats(postId?: string) {
  const { data, error } = await supabase.functions.invoke('fetch-social-stats', { body: { post_id: postId, fetch_all: !postId } });
  if (error) throw error;
  return data;
}

export async function resolveSmartLink(params: { topic?: string; keyword?: string; tracked_site_id?: string; domain?: string }) {
  const { data, error } = await supabase.functions.invoke('resolve-social-link', { body: params });
  if (error) throw error;
  return data;
}

export async function shortenLink(params: { url: string; platform?: string; campaign?: string; post_id?: string }) {
  const { data, error } = await supabase.functions.invoke('shorten-social-link', { body: params });
  if (error) throw error;
  return data;
}

export async function translatePost(params: { content: string; target_language: string; platform?: string; hashtags?: string[] }) {
  const { data, error } = await supabase.functions.invoke('translate-social-post', { body: params });
  if (error) throw error;
  return data;
}

export async function getComments(params: { action: 'list'; platform: string; post_external_id: string }) {
  const { data, error } = await supabase.functions.invoke('manage-social-comments', { body: params });
  if (error) throw error;
  return data;
}

export async function replyToComment(params: { platform: string; post_external_id: string; comment_id: string; reply_text: string }) {
  const { data, error } = await supabase.functions.invoke('manage-social-comments', { body: { ...params, action: 'reply' } });
  if (error) throw error;
  return data;
}

export async function suggestEmbed(params: { page_url?: string; keyword?: string; tracked_site_id?: string }) {
  const { data, error } = await supabase.functions.invoke('suggest-social-embed', { body: params });
  if (error) throw error;
  return data;
}

/**
 * Enrich site identity card from connected social accounts (Meta, LinkedIn).
 * Extracts brand info, sector, address, etc. and applies priority resolution.
 */
export async function enrichIdentityFromSocial(trackedSiteId: string, socialAccountId?: string) {
  const { data, error } = await supabase.functions.invoke('enrich-identity-social', {
    body: { tracked_site_id: trackedSiteId, social_account_id: socialAccountId },
  });
  if (error) throw error;
  return data;
}
