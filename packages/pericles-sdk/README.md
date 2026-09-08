# @pericles/sdk

Official TypeScript SDK for the [Périclès API](https://crawlers.fr/developers) — pull model pour récupérer et exécuter les tâches de contenu de l'Autopilote.

```bash
npm install @pericles/sdk
```

## Quickstart — worker prêt à l'emploi

```ts
import { PericlesClient } from '@pericles/sdk';

const pericles = new PericlesClient({ apiKey: process.env.PERICLES_API_KEY! });

await pericles.runWorker(async (task) => {
  // task.type === "create_post" | "update_post" | …
  const url = await publishToYourCms(task.payload);
  return { url, cms_post_id: 'wp_42' };
});
```

Le worker poll toutes les 30 s, ack chaque tâche, appelle ton handler et reporte `published` ou `failed` automatiquement.

## API bas-niveau

```ts
const tasks = await pericles.pending(10);
await pericles.ack(tasks[0].id);
await pericles.published(tasks[0].id, { url: 'https://...', cms_post_id: '42' });
// ou
await pericles.failed(tasks[0].id, { error_message: 'CMS down', error_category: 'cms_unreachable' });
```

## Arrêt propre

```ts
const ctrl = new AbortController();
process.on('SIGTERM', () => ctrl.abort());
await pericles.runWorker(handler, { signal: ctrl.signal });
```

## License

MIT
