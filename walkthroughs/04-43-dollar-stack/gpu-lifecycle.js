/**
 * GPU Lifecycle Manager for n8n
 *
 * This code lives in an n8n "Function" or "Code" node before any
 * Llama-using workflow. It boots the GPU instance on demand and
 * schedules automatic shutdown after idle period.
 *
 * Result: ~60h/month GPU usage instead of 720h.
 * Cost: ~€14.40 instead of ~€173.
 *
 * Required env vars on n8n:
 *   HETZNER_API_TOKEN         - Hetzner Cloud API token
 *   HETZNER_GPU_SERVER_ID     - Server ID of your GPU instance
 *   GPU_IDLE_MINUTES          - How long to wait before shutdown (default 15)
 *
 * Required dependencies installed in n8n container:
 *   - axios (or use $http helper)
 */

const HETZNER_API = 'https://api.hetzner.cloud/v1';
const TOKEN = $env.HETZNER_API_TOKEN;
const SERVER_ID = $env.HETZNER_GPU_SERVER_ID;
const IDLE_MINUTES = parseInt($env.GPU_IDLE_MINUTES || '15');
const BOOT_TIMEOUT_SECONDS = 120;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function getServerStatus() {
  const res = await fetch(`${HETZNER_API}/servers/${SERVER_ID}`, { headers });
  const data = await res.json();
  return data.server.status; // 'off', 'starting', 'running', 'stopping'
}

async function powerOn() {
  await fetch(`${HETZNER_API}/servers/${SERVER_ID}/actions/poweron`, {
    method: 'POST',
    headers
  });
}

async function waitForReady() {
  const start = Date.now();
  while (Date.now() - start < BOOT_TIMEOUT_SECONDS * 1000) {
    const status = await getServerStatus();
    if (status === 'running') {
      // Wait a bit more for SSH / Ollama to actually accept connections
      await new Promise(r => setTimeout(r, 15000));
      return;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`GPU did not become ready within ${BOOT_TIMEOUT_SECONDS}s`);
}

async function scheduleShutdown() {
  // Use a separate n8n schedule trigger OR a workflow with a Wait node
  // followed by a Power-Off node. Implementation pattern depends on your
  // n8n setup. The simplest version:
  //
  // 1. Set a flag in Redis: gpu_last_used = Date.now()
  // 2. Run a separate cron-triggered n8n workflow every 5 minutes
  //    that checks: if (Date.now() - gpu_last_used > IDLE_MINUTES * 60000)
  //    then power off the server.
  //
  // Below: set the timestamp. Cron handles the rest.

  // Pseudocode — replace with your Redis/Postgres client of choice
  await $redis.set('gpu_last_used', Date.now().toString());
}

// =========================================================================
// MAIN
// =========================================================================

const status = await getServerStatus();

if (status === 'off') {
  console.log('GPU is off, powering on...');
  await powerOn();
  await waitForReady();
  console.log('GPU is now running.');
} else if (status === 'running') {
  console.log('GPU already running.');
} else {
  throw new Error(`GPU in unexpected state: ${status}`);
}

await scheduleShutdown();

// Return success — workflow continues with actual Llama call
return [{ json: { gpu_status: 'running', timestamp: Date.now() } }];
