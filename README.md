# DOGE AI

A lightweight AI assistant with chat, image tools, voice interaction, and shared Cowork rooms.

## Development

```bash
npm install
npm run dev
```

## AI providers

DOGE AI uses **Cloudflare Workers AI** as its primary text provider. The fast model is GLM-4.7-Flash; the thinking option uses GPT-OSS-120B. Workers AI has a free daily Neurons allowance, but it is shared across models and is not unlimited.

An optional **OpenRouter free-model fallback** can keep text chat, conversation titles, Cowork planning, and Cowork room replies available when Workers AI is unavailable or its quota is exhausted. The fallback is opt-in and requires a separate API key:

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

Optionally pin a currently free OpenRouter model using a non-secret Worker variable named `OPENROUTER_MODEL`. If omitted, DOGE AI requests `openrouter/free`, which selects from the free models currently available on OpenRouter. Free model availability, limits, and model quality can change; check the provider dashboard before relying on it. The fallback model may not be GLM, while the primary model remains GLM-4.7-Flash.

Provider keys must be stored as Cloudflare Worker secrets. Never put API keys in frontend code, commit them to Git, or expose them in browser bundles.

Image understanding and image generation/editing still use Cloudflare Workers AI and do not currently use the text fallback. If both text providers are unavailable or over quota, DOGE AI returns a temporary error instead of repeatedly retrying a request.
