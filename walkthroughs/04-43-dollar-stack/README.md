# Walkthrough 04 — The $43/month Self-Hosted AI Stack

📺 [Watch the video on YouTube](https://youtube.com/@MirrorOps)

This walkthrough breaks down the complete production stack referenced in Video 4. Real numbers, real configs, real Hetzner invoice.

## Architecture Overview

Three machines:

| Machine | Specs | Cost | Role |
|---|---|---|---|
| Hetzner CCX23 | 3 vCPU dedicated, 8 GB RAM, 80 GB SSD | 25.20 EUR/mo | n8n, Postgres, Redis, Qdrant, Caddy, Uptime Kuma, Whisper |
| Hetzner GEX44 (GPU) | L40S, 44 GB VRAM | 14.40 EUR/mo avg | Ollama with Llama 3.3 70B (only on when needed) |
| Hetzner Storage Box BX11 | 1 TB | 3.30 EUR/mo | Encrypted backups |

**Total monthly cost: ~$47 USD** (43.90 EUR + domains amortized).

## What This Stack Replaces

| Service | Cloud Cost | Self-Hosted |
|---|---|---|
| n8n Cloud Pro | $240/mo | included |
| OpenAI (equivalent volume) | ~$600/mo | included via Llama |
| Whisper API | ~$90/mo | included |
| Pinecone (200k vectors) | ~$70/mo | included via Qdrant |
| Datadog starter | $15/mo | included via Uptime Kuma |
| **Total cloud equivalent** | **~$1,015/mo** | **$47/mo** |

Annual difference: ~$11,600.

## Files in This Walkthrough

| File | What |
|---|---|
| [`docker-compose.yml`](../../docker-compose.yml) | All container services on the CCX23 (top-level) |
| [`caddy/Caddyfile`](../../caddy/Caddyfile) | Reverse proxy + auto-SSL |
| [`gpu-lifecycle.js`](./gpu-lifecycle.js) | n8n code node that powers GPU on/off |
| [`monitoring.md`](./monitoring.md) | Uptime Kuma setup notes (placeholder) |

## The GPU Lifecycle Trick

The most expensive component (GPU) doesn't run 24/7. n8n powers it on when needed, schedules shutdown after 15 min idle.

See [`gpu-lifecycle.js`](./gpu-lifecycle.js).

Result: 60 hours/month average usage = €14.40 instead of €173.

## Reproducing This Setup

1. Order a Hetzner CCX23 in any region. Use `cloud-init.yml` if you want full automation; otherwise SSH after provisioning.
2. Clone this repo: `git clone https://github.com/mirrorops-io/mirrorops.git`
3. Copy `.env.example` to `.env` and fill in:
   - Postgres password
   - n8n encryption key
   - Caddy admin email
   - Domain you control
4. `docker compose up -d`
5. SSL is automatic the first time you hit your domain over HTTPS.
6. For GPU: provision Hetzner GEX44 separately, install Ollama as systemd service, pull `llama3.3:70b-instruct-q4_K_M`.

## Limitations (Honest)

- **Concurrency cap:** CCX23 saturates around 80 concurrent n8n executions.
- **No SLA:** Hetzner datacenter issues = your stack is down.
- **GPU cold start:** 90 seconds. Not suitable for latency-sensitive interactive use.
- **Llama 3.3 70B ≠ GPT-4o** for everything. Some tasks still need frontier models.

## Questions or Issues

Open an issue: <https://github.com/mirrorops-io/mirrorops/issues>

Or watch the video and check the comments — common questions get answered there.

---

**License:** MIT. Use freely. No warranty.
