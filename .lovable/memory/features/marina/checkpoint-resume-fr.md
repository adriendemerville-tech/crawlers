---
name: Marina reprise sur checkpoint
description: Marina persiste un checkpoint de phase (audit_cache marina_checkpoint_<jobId>) et un cron de 5 min reprend les jobs tués par le wall-time au lieu de les échouer
type: feature
---

- Chaque `selfInvokePhase` persiste `{ url, lang, phase, intermediate, resumes }` dans `audit_cache` sous `marina_checkpoint_<jobId>` (TTL 3 h).
- `resumeJobFromCheckpoint(jobId)` remet le job en `processing` et ré-invoque exactement la phase sauvegardée ; plafond `MAX_PHASE_RESUMES = 6`.
- Le nettoyage automatique ne tue plus les jobs muets : après 6 min sans progression il tente une reprise, et n'échoue que si le checkpoint est absent ou les reprises épuisées.
- Action manuelle : `{ action: 'resume_job', job_id }`. Action watchdog : `{ action: 'reap_jobs' }`, appelée par le cron `marina-resume-stalled-5min` (*/5).
- Phase 2 (crawl) : tours d'attente courts (70 s) × 20 tours max ; le run qui lance le crawl rend la main immédiatement après le lancement (détection d'URLs + démarrage suffisent à saturer le wall-time sur gros site), le tour suivant se raccroche au crawl en vol.
