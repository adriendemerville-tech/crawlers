import { useEffect, useMemo, useRef, useState } from 'react';

const TRACK_ROTATION_MS = 30000;
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

  // Track whether the user has actively chosen to play music.
  // Starts false → no autoplay on first load or rotation.
  // Becomes true when user clicks play, false when user clicks pause.
  const userWantsPlaybackRef = useRef(false);
  const isFirstTrackRef = useRef(true);

  const trackQueue = useMemo(() => shuffleTrackIds(PLAYLIST_TRACK_IDS), []);
  const currentTrackId = trackQueue[currentTrackIndex];

  useEffect(() => {
    const rotateInterval = window.setInterval(() => {
      setCurrentTrackIndex((previousIndex) => (previousIndex + 1) % trackQueue.length);
    }, TRACK_ROTATION_MS);

    return () => window.clearInterval(rotateInterval);
  }, [trackQueue.length]);

  useEffect(() => {
    let isCancelled = false;
    const container = embedContainerRef.current;

    if (!container || !currentTrackId) {
      return;
    }

    const spotifyUri = `spotify:track:${currentTrackId}`;

    const queuePlaybackIfUserWants = () => {
      // Only auto-play if the user previously clicked play
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
        controllerRef.current.loadUri(spotifyUri);
        // On track rotation, only resume if user was already playing
        queuePlaybackIfUserWants();
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

          // Listen for playback state changes to track user intent
          controller.addListener('playback_update', (data: unknown) => {
            const update = data as { data?: { isPaused?: boolean } };
            if (update?.data) {
              const isPaused = update.data.isPaused;
              if (isPaused === false) {
                // User clicked play (or autoplay succeeded)
                userWantsPlaybackRef.current = true;
                isFirstTrackRef.current = false;
              } else if (isPaused === true && !isFirstTrackRef.current) {
                // User clicked pause (only track after first interaction)
                userWantsPlaybackRef.current = false;
              }
            }
          });

          // Don't auto-play on first load — let the user click play
          // queuePlaybackIfUserWants() would be a no-op here since
          // userWantsPlaybackRef is false initially
        },
      );
    };

    syncController().catch((error) => {
      console.error('Spotify rotation init failed:', error);
    });

    return () => {
      isCancelled = true;
    };
  }, [currentTrackId]);

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

  const stopPlayback = () => {
    controllerRef.current?.destroy?.();
    controllerRef.current = null;
    if (embedContainerRef.current) {
      embedContainerRef.current.innerHTML = '';
    }
  };

  return {
    embedContainerRef,
    stopPlayback,
  };
}
