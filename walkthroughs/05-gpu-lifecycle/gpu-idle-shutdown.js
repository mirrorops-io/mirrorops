/**
 * GPU Lifecycle — Idle Shutdown Check (n8n Code node)
 *
 * Runs on a Schedule Trigger every 5 minutes. Reads the `gpu_last_used`
 * flag (set by the boot node via Redis) and powers the box OFF once it has
 * been idle longer than GPU_IDLE_MINUTES.
 *
 * Wiring: Schedule Trigger (5 min) → Redis "Get" (key gpu_last_used,
 * property gpu_last_used) → THIS Code node.
 *
 * Env vars:
 *   HETZNER_API_TOKEN       Hetzner Cloud API token (read+write)
 *   HETZNER_GPU_SERVER_ID   numeric server id of the GPU box
 *   GPU_IDLE_MINUTES        optional, default 15
 *
 * ponytail: fail-safe is "leave it running". If the flag is missing or the
 * API errors we do NOT power off — a stuck-on box costs money, a wrongly
 * killed box costs a failed job mid-flight. Cost ceiling: one extra idle
 * hour. Upgrade path: alert if idle-but-flagless persists > N cycles.
 */

const HETZNER_API = 'https://api.hetzner.cloud/v1';
const TOKEN = $env.HETZNER_API_TOKEN;
const SERVER_ID = $env.HETZNER_GPU_SERVER_ID;
const IDLE_MS = parseInt($env.GPU_IDLE_MINUTES || '15', 10) * 60 * 1000;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Redis "Get" puts the value on the incoming item as gpu_last_used
const raw = $json.gpu_last_used;
const lastUsed = raw ? parseInt(raw, 10) : null;

if (!lastUsed) {
  return [{ json: { action: 'skip', reason: 'no gpu_last_used flag' } }];
}

const idleMs = Date.now() - lastUsed;
if (idleMs < IDLE_MS) {
  return [{ json: { action: 'keep', idle_minutes: Math.round(idleMs / 60000) } }];
}

const statusRes = await fetch(`${HETZNER_API}/servers/${SERVER_ID}`, { headers });
if (!statusRes.ok) {
  return [{ json: { action: 'skip', reason: `status ${statusRes.status}` } }];
}
const status = (await statusRes.json()).server.status;
if (status !== 'running') {
  return [{ json: { action: 'noop', reason: `already ${status}` } }];
}

const off = await fetch(`${HETZNER_API}/servers/${SERVER_ID}/actions/poweroff`, {
  method: 'POST',
  headers,
});
if (!off.ok) throw new Error(`Hetzner poweroff ${off.status}`);

return [{ json: { action: 'poweroff', idle_minutes: Math.round(idleMs / 60000) } }];
