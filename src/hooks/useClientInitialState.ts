import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * SSR/hydration-safe replacement for `useState(() => <browser API read>)`.
 *
 * The server (and the client's first hydration render) use `ssrDefault`,
 * keeping server and client markup identical; the real value is read from
 * the browser (localStorage, URL params, …) right after mount.
 */
export function useClientInitialState<T>(
  init: () => T,
  ssrDefault: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(ssrDefault);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    setValue(initRef.current());
  }, []);

  return [value, setValue];
}
