/**
 * Pré-charge le résultat d'un scan Machine Layer pour Code Architect.
 * Architect lit cette clé au démarrage si elle existe.
 */
const KEY = 'crawlers.architect.preload.machineLayer';

export interface MachineLayerPreload {
  url: string;
  domain: string;
  rules: Array<{
    payload_type: string;
    url_pattern: string;
    payload_data: { snippet: string; family: string; key: string; title: string };
    severity: string;
  }>;
  source: 'machine-layer-scanner';
  scan_id: string | null;
  created_at: string;
}

export function setMachineLayerPreload(payload: MachineLayerPreload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {/* quota or denied */}
}

export function getMachineLayerPreload(): MachineLayerPreload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MachineLayerPreload;
  } catch { return null; }
}

export function clearMachineLayerPreload(): void {
  try { sessionStorage.removeItem(KEY); } catch {/* ignore */}
}
