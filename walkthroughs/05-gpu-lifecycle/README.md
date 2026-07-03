# 05 — GPU Lifecycle: €170 → €14/month

On-demand GPU automation for a self-hosted Llama/Ollama box. n8n powers the
Hetzner GPU instance **on** when a workflow needs it, keeps it warm through
bursts, and shuts it **off** after it goes idle. Result: ~60 GPU hours/month
instead of 720 → **~€14.40 instead of ~€173**, same hardware.

> Companion to the [MirrorOps](https://youtube.com/@MirrorOps) video of the
> same name. MIT licensed — drop it into your own n8n and point it at your box.

## How it works

```
   ┌─ any GPU workflow ─────────────┐        ┌─ every 5 min (cron) ──────────┐
   │ Boot node → Redis Set          │        │ Schedule → Redis Get → Check  │
   │  power on if off               │        │  idle > 15 min? → power off   │
   │  wait until Ollama answers      │        └───────────────────────────────┘
   │  refresh gpu_last_used flag     │
   └────────────────────────────────┘
```

Two independent pieces sharing one Redis flag, `gpu_last_used`:

1. **Boot-on-demand** (`gpu-lifecycle-boot.js`) — a Code node you place at the
   start of any GPU workflow. Powers the box on if needed, waits for readiness
   with a hard timeout, and outputs `gpu_last_used = now`. Follow it with a
   Redis **Set** node writing that value to the key `gpu_last_used`. Because it
   runs on every GPU call, the idle timer resets on use — a busy box stays up.

2. **Idle-shutdown** (`idle-shutdown.workflow.json` / `gpu-idle-shutdown.js`) —
   a standalone workflow on a 5-minute schedule. Reads `gpu_last_used`, and if
   the box has been idle past `GPU_IDLE_MINUTES`, powers it off.

## Cold start

Booting a cold box and loading a 70B model takes ~90s. That is the entire
tradeoff. Two mitigations, both in the code:

- `waitForReady()` polls Ollama's `/api/tags` (not just Hetzner power state) so
  the workflow only proceeds once the model server actually answers.
- Raise `GPU_BOOT_TIMEOUT_SEC` if your box loads slowly. For latency-sensitive,
  predictable traffic, pre-warm on a schedule instead of on-demand — but then
  you are back to paying for idle. On-demand wins for bursty workloads.

## Setup

1. **Redis** — this uses the Redis already in the [$43 stack](../04-43-dollar-stack/).
   In n8n, create a Redis credential pointing at it.
2. **Env vars** — copy `.env.example` and fill in your values (Hetzner token,
   server id, Ollama URL). Set them in n8n → Settings → Variables.
3. **Import the shutdown workflow** — `idle-shutdown.workflow.json` → n8n
   *Import from File*. Open the *Get gpu_last_used* node and select your Redis
   credential (the import ships a placeholder). Activate it.
4. **Add the boot node** — paste `gpu-lifecycle-boot.js` into a Code node at the
   start of each GPU workflow, then add a Redis **Set** node after it:
   key `gpu_last_used`, value `{{ $json.gpu_last_used }}`.

## Files

| File | What |
|---|---|
| `gpu-lifecycle-boot.js` | Boot-on-demand Code node (snippet) |
| `gpu-idle-shutdown.js` | Idle-shutdown Code node (readable copy of the workflow's code) |
| `idle-shutdown.workflow.json` | Importable n8n workflow (Schedule → Redis Get → Check) |
| `.env.example` | Required environment variables |

> The `.js` files are the canonical, readable source. The workflow JSON embeds
> the same shutdown code and targets n8n ≥ 1.x — if a node param differs on your
> version, just re-pick the operation in the UI. The logic is what matters.

## The math

| | Always-on | Lifecycle |
|---|---|---|
| GPU hours / month | 720 | ~60 |
| Cost @ ~€0.24/h | ~€173 | ~€14.40 |

## When this is the *wrong* call

- Sub-second latency SLAs — 90s cold starts will burn you.
- The box is genuinely busy most of the day — you would just churn power cycles.
- You have not built the shutdown check yet. **Build shutdown first.** A boot
  automation without a reliable shutdown is a bill generator, not a saver.

## License

[MIT](../../LICENSE).
