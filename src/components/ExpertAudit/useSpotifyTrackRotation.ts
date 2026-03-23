import { useEffect, useMemo, useRef, useState } from 'react';
const STORAGE_KEY = 'crawlers_custom_spotify_playlist';
const SPOTIFY_IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

export const PLAYLIST_TRACK_IDS = [
  '17nOJOcPbcl4sKzM2yyYDp',
  '51rPRW8NjxZoWPPjnRGzHw',
  '2jX5c5RFp0A9E1GDsvGxIa',
  '6eZZcBjuiLVOxO0VX2xEfF',
  '39qYD4J4BKvZMQgxfXl5bv',
  '5CQ30WqJwcep0pYcV4AMNc',
  '51tUT1gHE30GQPhn1agudM',
  '1vxw6aYJls2oq3gW0DujAo',
  '1dEy9Pl81QopSxNsPxXQxv',
  '0Q0IVlqMV64kNLlwjPj0Hl',
  '08QmEfykPyTLC5uCC9WCHv',
  '0YMFcrMtBowDdD5bPz0cgy',
  '6ztstiyZL6FXzh4aG46ZPD',
  '0DwClY2t9YAWHBROMIgrXb',
  '3spdoTYpuCpmq19tuD0bOe',
  '2g4oQ1siRRrg8yAkQLVx0c',
  '6zeE5tKyr8Nu882DQhhSQI',
  '2YplrdHMBoRdnHgMeHEwHm',
  '2Fxmhks0bxGSBdJ92vM42m',
  '2Foc5Q5nqNiosCNqttzHof',
  '6FLwmdmW77N1Pxb1aWsZmO',
  '7wC8EVTpYfKxe73eXmbiMe',
  '4KFM3A5QF2IMcc6nHsu3Wp',
  '2gNjmvuQiEd2z9SqyYi8HH',
  '1jGkLUJCl46NmXIM6rUghn',
  '5gOnivVq0hLxPvIPC00ZhF',
  '1fmoCZ6mtMiqA5GHWPcZz9',
  '29GuoJqjg7aMxUmEO3XLEp',
  '7aZjExRehKGrH6vZ3MNXlq',
  '0rqCsgBpf8mojW1bMy6DQU',
  '688swhveYzWFjUpyR060tG',
  '5CQ30WqJwcep0pYcV4AMNc',
  '2ZQVJD9I6GCqXmkmMuEoLa',
  '5y788ya4NvwhBznoDIcXwK',
  '2FH3BLTMhJlCH1Dmkua5DW',
  '0GNI8K3VATWBABQFAzBAYe',
  '0biKl6K9vgQtXNqoOrH9QM',
  '2H6BI0TAiEYHVfhcjgGEZS',
  '5IV5Wh6hdncGcsnbVhhVug',
];

type SpotifyEmbedController = {
  loadUri: (spotifyUri: string) => void;
  play: () => void;
  destroy?: () => void;
  addListener: (event: string, callback: (data: unknown) => void) => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      uri: string;
      width: string;
      height: string;
      theme: 'dark' | 'light';
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    SpotifyIframeApi?: SpotifyIframeApi;
    onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIframeApi) => void;
  }
}

let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | null = null;

function shuffleTrackIds(trackIds: string[]) {
  const shuffled = [...trackIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function loadSpotifyIframeApi() {
  if (window.SpotifyIframeApi) {
    return Promise.resolve(window.SpotifyIframeApi);
  }

  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise;
  }

  spotifyIframeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-spotify-iframe-api="true"]');
    const timeoutId = window.setTimeout(() => reject(new Error('Spotify iframe API timeout')), 10000);
    const previousReadyHandler = window.onSpotifyIframeApiReady;

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.clearTimeout(timeoutId);
      window.SpotifyIframeApi = IFrameAPI;
      previousReadyHandler?.(IFrameAPI);
      resolve(IFrameAPI);
    };

    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;
    script.setAttribute('data-spotify-iframe-api', 'true');
    script.addEventListener('error', () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Spotify iframe API failed to load'));
    });
    document.body.appendChild(script);
  });

  return spotifyIframeApiPromise;
}

export function useSpotifyTrackRotation(active = true) {
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const manualSkipRef = useRef(false);

  // Check for user-defined playlist in localStorage
  const customPlaylistUri = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }, []);

  // Track whether the user has actively chosen to play music.
  const userWantsPlaybackRef = useRef(false);
  const isFirstTrackRef = useRef(true);

  const trackQueue = useMemo(() => shuffleTrackIds(PLAYLIST_TRACK_IDS), []);
  const currentTrackId = trackQueue[currentTrackIndex];

  // No auto-rotation — tracks play fully until the user skips manually

  useEffect(() => {
    let isCancelled = false;
    const container = embedContainerRef.current;

    if (!container) return;

    // Determine the Spotify URI: custom playlist or individual track
    const spotifyUri = customPlaylistUri || (currentTrackId ? `spotify:track:${currentTrackId}` : null);
    if (!spotifyUri) return;

    const queuePlaybackIfUserWants = () => {
      if (!userWantsPlaybackRef.current) return;

      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }

      playTimeoutRef.current = window.setTimeout(() => {
        controllerRef.current?.play();
      }, 150);
    };

    const syncController = async () => {
      const IFrameAPI = await loadSpotifyIframeApi();

      if (isCancelled) {
        return;
      }

      if (controllerRef.current) {
        // For custom playlists, don't reload on track rotation
        if (!customPlaylistUri) {
          controllerRef.current.loadUri(spotifyUri);
          queuePlaybackIfUserWants();
        }
        return;
      }

      container.innerHTML = '';
      IFrameAPI.createController(
        container,
        {
          uri: spotifyUri,
          width: '100%',
          height: '152',
          theme: 'dark',
        },
        (controller) => {
          if (isCancelled) {
            controller.destroy?.();
            return;
          }

          controllerRef.current = controller;

          controller.addListener('playback_update', (data: unknown) => {
            const update = data as { data?: { isPaused?: boolean } };
            if (update?.data) {
              const isPaused = update.data.isPaused;
              if (isPaused === false) {
                userWantsPlaybackRef.current = true;
                isFirstTrackRef.current = false;
              } else if (isPaused === true && !isFirstTrackRef.current) {
                userWantsPlaybackRef.current = false;
              }
            }
          });
        },
      );
    };

    syncController().catch((error) => {
      console.error('Spotify rotation init failed:', error);
    });

    return () => {
      isCancelled = true;
    };
  }, [currentTrackId, active, customPlaylistUri]);

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        window.clearTimeout(playTimeoutRef.current);
      }

      controllerRef.current?.destroy?.();
      controllerRef.current = null;

      if (embedContainerRef.current) {
        embedContainerRef.current.innerHTML = '';
      }
    };
  }, []);

  const pausePlayback = () => {
    controllerRef.current?.pause?.();
  };

  const stopPlayback = () => {
    controllerRef.current?.destroy?.();
    controllerRef.current = null;
    if (embedContainerRef.current) {
      embedContainerRef.current.innerHTML = '';
    }
  };

  const goNext = () => {
    manualSkipRef.current = true;
    setCurrentTrackIndex((prev) => (prev + 1) % trackQueue.length);
  };

  const goPrev = () => {
    manualSkipRef.current = true;
    setCurrentTrackIndex((prev) => (prev - 1 + trackQueue.length) % trackQueue.length);
  };

  return {
    embedContainerRef,
    stopPlayback,
    pausePlayback,
    isCustomPlaylist: !!customPlaylistUri,
    goNext,
    goPrev,
  };
}
