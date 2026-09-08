# @parmenion/sdk

Official TypeScript SDK for the [Parménion API](https://crawlers.fr/developers) — pull model pour récupérer et exécuter les tâches de contenu de l'Autopilote.

```bash
npm install @parmenion/sdk
```

## Quickstart — worker prêt à l'emploi

```ts
import { ParmenionClient } from '@parmenion/sdk';

const parmenion = new ParmenionClient({ apiKey: process.env.PARMENION_API_KEY! });

await parmenion.runWorker(async (task) => {
  // task.type === "create_post" | "update_post" | …
  const url = await publishToYourCms(task.payload);
  return { url, cms_post_id: 'wp_42' };
});
```

Le worker poll toutes les 30 s, ack chaque tâche, appelle ton handler et reporte `published` ou `failed` automatiquement.

## API bas-niveau

```ts
const tasks = await parmenion.pending(10);
await parmenion.ack(tasks[0].id);
await parmenion.published(tasks[0].id, { url: 'https://...', cms_post_id: '42' });
// ou
await parmenion.failed(tasks[0].id, { error_message: 'CMS down', error_category: 'cms_unreachable' });
```

## Arrêt propre

```ts
const ctrl = new AbortController();
process.on('SIGTERM', () => ctrl.abort());
await parmenion.runWorker(handler, { signal: ctrl.signal });
```

## License

MIT
