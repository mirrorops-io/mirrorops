/**
 * GPU Lifecycle — Boot-on-Demand (n8n Code node)
 *
 * Put this in a "Code" node at the START of any workflow that needs the
 * GPU (Llama / Ollama). It:
 *   1. Checks the Hetzner server power state.
 *   2. Powers it on if it's off, then waits until it's actually ready
 *      (running + Ollama answering), with a hard timeout.
 *   3. Emits `gpu_last_used` so the next node (a Redis "Set") can refresh
 *      the idle flag that the shutdown-check workflow reads.
 *
 * Runs on EVERY GPU call, not just cold boots — so the idle timer resets
 * each time the box is used. That is what keeps a warm box warm.
 *
 * Env vars (n8n Settings → Variables, or container env):
 *   HETZNER_API_TOKEN       Hetzner Cloud API token (read+write)
 *   HETZNER_GPU_SERVER_ID   numeric server id of the GPU box
 *   OLLAMA_URL              e.g. http://10.0.0.5:11434 (private net)
 *   GPU_BOOT_TIMEOUT_SEC    optional, default 180
 *
 * ponytail: waitForReady polls Ollama /api/tags, not just power state —
 * "running" in Hetzner != model server accepting connections. Bump the
 * timeout, not the poll interval, if your box is slow to load the model.
 */

const HETZNER_API = 'https://api.hetzner.cloud/v1';
const TOKEN = $env.HETZNER_API_TOKEN;
const SERVER_ID = $env.HETZNER_GPU_SERVER_ID;
const OLLAMA_URL = $env.OLLAMA_URL;
const BOOT_TIMEOUT_SEC = parseInt($env.GPU_BOOT_TIMEOUT_SEC || '180', 10);

if (!TOKEN || !SERVER_ID) {
  throw new Error('HETZNER_API_TOKEN and HETZNER_GPU_SERVER_ID must be set');
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function serverStatus() {
  const res = await fetch(`${HETZNER_API}/servers/${SERVER_ID}`, { headers });
  if (!res.ok) throw new Error(`Hetzner GET server ${res.status}`);
  const data = await res.json();
  return data.server.status; // off | starting | running | stopping
}

async function powerOn() {
  const res = await fetch(
    `${HETZNER_API}/servers/${SERVER_ID}/actions/poweron`,
    { method: 'POST', headers },
  );
  if (!res.ok) throw new Error(`Hetzner poweron ${res.status}`);
}

async function ollamaReady() {
  if (!OLLAMA_URL) return true; // no health url configured → trust power state
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForReady() {
  const deadline = Date.now() + BOOT_TIMEOUT_SEC * 1000;
  while (Date.now() < deadline) {
    if ((await serverStatus()) === 'running' && (await ollamaReady())) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`GPU not ready within ${BOOT_TIMEOUT_SEC}s`);
}

const status = await serverStatus();
if (status === 'off') {
  await powerOn();
  await waitForReady();
} else if (status === 'starting') {
  await waitForReady();
} else if (status !== 'running') {
  throw new Error(`GPU in unexpected state: ${status}`);
}

// Downstream: Redis "Set" node → key `gpu_last_used`, value `{{ $json.gpu_last_used }}`
return [{ json: { gpu_status: 'running', gpu_last_used: Date.now() } }];
