# DOGE AI

A lightweight AI assistant with chat, image tools, voice interaction, and shared Cowork rooms.

## Development

```bash
npm install
npm run dev
```

## Windows desktop installer

DOGE AI can also be packaged as a Windows desktop application with Tauri.

- The installer creates a dedicated DOGE AI window and Start Menu entry.
- The desktop shell opens the official hosted DOGE AI service, so chat, provider routing, Cowork, and other online features continue to use the existing backend.
- An internet connection is required. This is a desktop app wrapper, not an offline AI model.
- GitHub Actions builds both NSIS `.exe` and MSI installers when desktop-related files change on `main`.

To build locally on Windows, install the prerequisites for Tauri 2 (Rust, Microsoft C++ Build Tools, and WebView2), then run:

```bash
npm install
npm run desktop:build
```

Installers are written under `src-tauri/target/release/bundle/`.

## AI providers

The Cloudflare Workers AI binding is the primary provider. An optional OpenRouter text fallback can be enabled for quota or availability failures.

Set `OPENROUTER_API_KEY` as a **Cloudflare Worker secret** and set `OPENROUTER_ALLOW_FALLBACK=true` as a Worker variable. The fallback is disabled unless both are configured. You can optionally set `OPENROUTER_MODEL`; the default is `openrouter/free`, which routes to an available free model when one is offered. Free model availability and provider limits can change.

Text chat, conversation titles, Cowork planning, and shared-room AI replies can use the fallback. Image understanding, image generation, and image editing remain Cloudflare-only.

When enabled, text prompts and conversation context may be sent to OpenRouter and its selected upstream model provider. Tell users before enabling this for a public deployment. Never put provider API keys in browser code or commit them to the repository.


## Copyright and licensing

Copyright (c) 2026 2122pspblore-dev. All rights reserved.

DOGE AI is proprietary software. **All rights reserved.** Copying, modifying, redistributing, or commercial reuse requires prior written permission. See [LICENSE](./LICENSE) and [COPYRIGHT.md](./COPYRIGHT.md). Third-party dependencies retain their own licenses.
