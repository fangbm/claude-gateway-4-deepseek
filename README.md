# claude-gateway-4-deepseek (cg4d)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fangbm/claude-gateway-4-deepseek)

[English](README.md) | [简体中文](README_zh.md)

A lightweight Cloudflare Worker that lets **Claude Desktop** (and Claude Code CLI) talk to **DeepSeek** through an Anthropic-compatible API shim.

## What it does

| Endpoint | Action |
|----------|--------|
| `GET /v1/models` | Returns a fake model list so Claude Desktop can start. |
| `POST /v1/messages` | Proxies the request to `https://api.deepseek.com/anthropic/v1/messages`. |

The upstream **DeepSeek API Key is read from the incoming `Authorization` header** — nothing is hard-coded in the Worker.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate Wrangler

```bash
npx wrangler login
```

### 3. Deploy

```bash
npx wrangler deploy
```

Wrangler will output your Worker URL, e.g.:

```
https://claude-gateway-4-deepseek.<your-subdomain>.workers.dev
```

## Configure Claude Desktop / Claude Code

Set the Anthropic base URL and pass your **real DeepSeek API Key** as the Anthropic API key:

### macOS / Linux

```bash
export ANTHROPIC_BASE_URL=https://claude-gateway-4-deepseek.<your-subdomain>.workers.dev
export ANTHROPIC_API_KEY=sk-your-real-deepseek-key
claude
```

### Windows (PowerShell)

```powershell
$env:ANTHROPIC_BASE_URL = "https://claude-gateway-4-deepseek.<your-subdomain>.workers.dev"
$env:ANTHROPIC_API_KEY = "sk-your-real-deepseek-key"
claude
```

### Persistent config (macOS)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export ANTHROPIC_BASE_URL=https://claude-gateway-4-deepseek.<your-subdomain>.workers.dev
export ANTHROPIC_API_KEY=sk-your-real-deepseek-key
```

Then restart Claude Desktop.

## Optional: KV key mapping

If you don't want to store the real DeepSeek key in local env vars, you can bind a **Cloudflare KV namespace** to map a local "fake" key to the real one.

1. Create a KV namespace:

```bash
npx wrangler kv namespace create "API_KEY_MAP"
```

2. Copy the `id` into `wrangler.toml` (uncomment the `[[kv_namespaces]]` block).

3. Add a mapping:

```bash
npx wrangler kv key put --binding=API_KEY_MAP "sk-local-fake-key-123" "sk-your-real-deepseek-key"
```

4. Uncomment the KV lookup code in `src/index.ts`.

Now you can set `ANTHROPIC_API_KEY=sk-local-fake-key-123` locally.

## Project structure

```
.
├── src/
│   └── index.ts          # Worker entry
├── wrangler.toml         # Wrangler config
├── package.json
├── tsconfig.json
└── README.md
```

## Notes

- The Worker supports **streaming (SSE)** responses — required for Claude Desktop's real-time output.
- CORS headers are included for browser-based clients; tighten `ALLOWED_ORIGINS` in production if needed.
- DeepSeek's anthropic-compatible endpoint is used: `https://api.deepseek.com/anthropic/v1/messages`.

## License

MIT
