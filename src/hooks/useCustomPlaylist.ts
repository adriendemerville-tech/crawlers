import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crawlers_custom_spotify_playlist';

/**
 * Extract a Spotify playlist/album URI from a pasted URL or URI.
 * Accepts:
 *  - https://open.spotify.com/playlist/XXXXX?si=...
 *  - https://open.spotify.com/album/XXXXX
 *  - spotify:playlist:XXXXX
 */
export function parseSpotifyUri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a spotify URI
  if (/^spotify:(playlist|album):[a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'open.spotify.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['playlist', 'album'].includes(parts[0])) {
        return `spotify:${parts[0]}:${parts[1]}`;
      }
    }
  } catch {
    // not a URL
  }

  return null;
}

export function useCustomPlaylist() {
  const [playlistUri, setPlaylistUri] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const savePlaylist = useCallback((input: string) => {
    const uri = parseSpotifyUri(input);
    if (uri) {
      localStorage.setItem(STORAGE_KEY, uri);
      setPlaylistUri(uri);
      return true;
    }
    return false;
  }, []);

  const clearPlaylist = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPlaylistUri(null);
  }, []);

  return { playlistUri, savePlaylist, clearPlaylist };
}
