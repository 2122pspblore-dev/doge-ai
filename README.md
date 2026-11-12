# DOGE AI

A lightweight AI assistant with chat, image tools, voice interaction, and shared Cowork rooms.

## Development

```bash
npm install
npm run dev
```

## AI providers

DOGE AI uses **Cloudflare Workers AI** as its primary text provider. The fast model is GLM-4.7-Flash; the thinking option uses GPT-OSS-120B. Workers AI has a free daily Neurons allowance, but it is shared across models and is not unlimited.

An optional **OpenRouter free-model fallback** can keep text chat, conversation titles, Cowork planning, and Cowork room replies available when Workers AI is unavailable or its quota is exhausted. It is disabled unless you explicitly configure both secrets/settings:

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENROUTER_ALLOW_FALLBACK
```

Set `OPENROUTER_ALLOW_FALLBACK` to `true` as a Worker variable/secret. Optionally set the non-secret `OPENROUTER_MODEL` variable to a model currently marked free by OpenRouter. If omitted, DOGE AI requests `nvidia/nemotron-3-ultra-550b-a55b:free`, a large free reasoning model. You can override it with another model currently marked free. OpenRouter's free plan currently has a 50-request daily limit; model availability and provider limits can change. The fallback may use a model other than GLM, while the primary model remains GLM-4.7-Flash.

**Privacy warning:** Enabling the fallback sends chat messages and conversation context to OpenRouter and its selected upstream model provider. Some free upstream models may log or use prompts according to their own terms. Do not enable it for a public app until users are clearly informed; do not send passwords, private information, or confidential content through the fallback.

Provider keys must be stored as Cloudflare Worker secrets. Never put API keys in frontend code, commit them to Git, or expose them in browser bundles.

Image understanding and image generation/editing still use Cloudflare Workers AI and do not currently use the text fallback. If both text providers are unavailable or over quota, DOGE AI returns a temporary error instead of repeatedly retrying a request.
