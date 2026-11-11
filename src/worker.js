const CHAT_MODELS = {
  fast: "@cf/zai-org/glm-4.7-flash",
  thinking: "@cf/openai/gpt-oss-120b"
};
const json = (data, status=200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (!env.AI) return json({ error: "Doge AI is not connected to Workers AI yet." }, 503);
      try {
        const body = await request.json();
        if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return json({ error: "Send between 1 and 40 messages." }, 400);
        const totalChars = body.messages.reduce((sum, m) => sum + String(m.content ?? "").length, 0);
        if (totalChars > 100000) return json({ error: "This conversation is too large. Start a new chat or attach smaller files." }, 413);
        const styles = {
          Friendly: "Use a friendly, natural, encouraging tone.",
          Concise: "Be concise and direct. Prefer short answers unless detail is needed.",
          Detailed: "Give thorough explanations with useful examples when appropriate.",
          Professional: "Use a clear, professional and neutral tone."
        };
        const memory = typeof body.memory === "string" ? body.memory.slice(0, 3000) : "";
        const model = CHAT_MODELS[body.model] || CHAT_MODELS.fast;
        const messages = [
          { role: "system", content: "You are Doge AI, a helpful assistant. Be accurate and understandable. Never claim to have used a tool unless its results are included in the conversation. " + (styles[body.personality] || styles.Friendly) + (memory ? "\nUser-approved memory/preferences (use only when relevant): " + memory : "") },
          ...body.messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 50000) }))
        ];
        if (body.stream) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const result = await env.AI.run(model, { messages, max_tokens: body.model === "thinking" ? 3000 : 1800, temperature: body.advanced ? 0.8 : 0.6, stream: true });
              if (result instanceof Response) return result;
              if (result && typeof result.getReader === "function") return new Response(result, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
              if (result?.body) return new Response(result.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
              throw new Error("No streaming response");
            } catch (error) { if (attempt === 2) return json({ error: "Doge AI couldn't start a response. Please try again." }, 502); await new Promise(r => setTimeout(r, 350 * (attempt + 1))); }
          }
        }
        const result = await env.AI.run(model, { messages, max_tokens: 1800, temperature: body.advanced ? 0.8 : 0.6 });
        const reply = result?.choices?.[0]?.message?.content ?? result?.response ?? result?.result?.response;
        if (typeof reply !== "string" || !reply.trim()) return json({ error: "The model returned an empty answer." }, 502);
        return json({ reply });
      } catch { return json({ error: "Doge AI couldn't reach its AI model. Please try again." }, 502); }
    }

    if (url.pathname === "/api/image") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (!env.AI) return json({ error: "Workers AI is not connected." }, 503);
      try {
        const body = await request.json();
        const prompt = String(body.prompt || "").trim();
        if (!prompt || prompt.length > 1800) return json({ error: "Enter an image prompt under 1,800 characters." }, 400);
        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
        if (!result?.image) return json({ error: "The image model returned no image." }, 502);
        return json({ image: "data:image/jpeg;base64," + result.image });
      } catch { return json({ error: "Image generation failed. Please try again." }, 502); }
    }

    if (url.pathname === "/api/search") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const query = (url.searchParams.get("q") || "").trim();
      if (!query || query.length > 240) return json({ error: "Enter a search query under 240 characters." }, 400);
      try {
        const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
        const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DogeAI/2.0)" } });
        if (!response.ok) return json({ error: "Web search is temporarily unavailable." }, 502);
        const html = await response.text();
        const results = [];
        const blocks = html.split(/class="result\b/).slice(1);
        for (const block of blocks) {
          const link = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
          if (!link) continue;
          const decode = s => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
          let href = link[1].replace(/&amp;/g, "&");
          try { const parsed = new URL(href); if (parsed.hostname.includes("duckduckgo.com") && parsed.searchParams.has("uddg")) href = parsed.searchParams.get("uddg"); } catch {}
          if (!/^https?:\/\//i.test(href)) continue;
          results.push({ title: decode(link[2]), url: href, snippet: decode(snippet?.[1] || "") });
          if (results.length >= 6) break;
        }
        return json({ results });
      } catch { return json({ error: "Couldn't complete web search." }, 502); }
    }

    return env.ASSETS.fetch(request);
  }
};
