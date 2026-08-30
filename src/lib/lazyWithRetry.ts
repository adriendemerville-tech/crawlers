/**
 * Chargement dynamique tolérant aux pannes réseau / déploiements.
 *
 * Un `import()` qui échoue (chunk absent après déploiement, coupure réseau,
 * CDN qui renvoie une 5xx) fait remonter l'erreur jusqu'à la frontière la plus
 * proche — en SSR cela peut se transformer en 500. Ici on retente l'import avec
 * un backoff court, puis en cassant le cache HTTP, avant de laisser l'erreur
 * remonter vers `<LazyBoundary>`.
 */
export function retryImport<T>(
  factory: () => Promise<T>,
  attempts = 3,
  delayMs = 400,
): Promise<T> {
  return factory().catch((error) => {
    if (attempts <= 1) throw error;
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        retryImport(factory, attempts - 1, delayMs * 2).then(resolve, reject);
      }, delayMs);
    });
  });
}

/** Fabrique une factory compatible `React.lazy` avec retry intégré. */
export function lazyRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  return () => retryImport(factory);
}
