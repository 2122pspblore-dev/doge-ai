# DOGE AI

A lightweight AI assistant with chat, image tools, voice interaction, and shared Cowork rooms.

## Development

```bash
npm install
npm run dev
```

## AI providers

The Cloudflare Workers AI binding is the primary provider. An optional OpenRouter text fallback can be enabled for quota or availability failures.

Set `OPENROUTER_API_KEY` as a **Cloudflare Worker secret** and set `OPENROUTER_ALLOW_FALLBACK=true` as a Worker variable. The fallback is disabled unless both are configured. You can optionally set `OPENROUTER_MODEL`; the default is `openrouter/free`, which routes to an available free model when one is offered. Free model availability and provider limits can change.

Text chat, conversation titles, Cowork planning, and shared-room AI replies can use the fallback. Image understanding, image generation, and image editing remain Cloudflare-only.

When enabled, text prompts and conversation context may be sent to OpenRouter and its selected upstream model provider. Tell users before enabling this for a public deployment. Never put provider API keys in browser code or commit them to the repository.
