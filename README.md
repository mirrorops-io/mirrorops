# MirrorOps Stack

> Production AI infrastructure you actually own. Self-hosted, MCP-first, cost-conscious.

This repository contains the configuration files, scripts, and walkthroughs for the [MirrorOps YouTube channel](https://youtube.com/@MirrorOps).

Each video that involves code links here. Everything is MIT-licensed.

## Current Stack

| Component | Role | Where |
|---|---|---|
| **n8n** | Workflow automation, orchestration | `docker-compose.yml` |
| **Caddy** | Reverse proxy, SSL, basic auth | `caddy/` |
| **Postgres** | Database for n8n + custom apps | `docker-compose.yml` |
| **Redis** | Queue + caching | `docker-compose.yml` |
| **Qdrant** | Vector database (RAG layer) | `docker-compose.yml` |
| **Whisper** | Audio transcription | `docker-compose.yml` |
| **Uptime Kuma** | Service monitoring | `docker-compose.yml` |
| **Ollama** | LLM inference (separate GPU instance) | `walkthroughs/04-43-dollar-stack/` |
| **GPU Lifecycle** | On-demand power up/down for the GPU box | `walkthroughs/05-gpu-lifecycle/` |

## Walkthroughs

Per-video deep dives with deployment-ready configs.

| # | Walkthrough | Video |
|---|---|---|
| 04 | [The $43/month stack](walkthroughs/04-43-dollar-stack/) | [Watch on YouTube](https://youtube.com/@MirrorOps) |
| 05 | [GPU Lifecycle: €170 → €14/month](walkthroughs/05-gpu-lifecycle/) | [Watch on YouTube](https://youtube.com/@MirrorOps) |

## Quick Start

```bash
git clone https://github.com/mirrorops-io/mirrorops.git
cd stack
cp .env.example .env
# edit .env with your values
docker compose up -d
```

Then point a Hetzner CCX23 (or equivalent: 4 CPU, 8 GB RAM minimum) at this. SSL is automatic via Caddy + Let's Encrypt.

## Cost Reference

Real monthly cost of running this stack: **~$47 USD** as of 2026-05.

Detailed breakdown in [Walkthrough 04](walkthroughs/04-43-dollar-stack/).

## Contributing

Issues, pull requests, and config improvements are welcome. Keep PRs focused — one concern per PR.

If you replicate this stack and have questions, [open an issue](https://github.com/mirrorops-io/mirrorops/issues) rather than DMing — others probably have the same question.

## License

[MIT](LICENSE). Use it for anything, commercially or otherwise. No warranty.

## Channel

Production AI agents you actually own.

- YouTube: [@MirrorOps](https://youtube.com/@MirrorOps)
- Website: [mirrorops.io](https://mirrorops.io)
- Contact: hello@mirrorops.io

New videos Tuesday + Friday.
