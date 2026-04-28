// Crawlers Extension — auth helpers (talks to Supabase GoTrue directly)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const STORAGE_KEY = 'crawlers_session';

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Authentication failed');
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  return data;
}

export async function signOut() {
  const session = await getSession();
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch (e) { /* ignore */ }
  }
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getSession() {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  const session = obj[STORAGE_KEY];
  if (!session) return null;

  // Refresh if expiring within 60s
  const expiresAt = (session.expires_at || 0) * 1000;
  if (expiresAt && Date.now() > expiresAt - 60000 && session.refresh_token) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (res.ok) {
        const refreshed = await res.json();
        await chrome.storage.local.set({ [STORAGE_KEY]: refreshed });
        return refreshed;
      }
    } catch (e) { /* ignore */ }
  }
  return session;
}

export async function isAuthenticated() {
  const s = await getSession();
  return !!s?.access_token;
}
