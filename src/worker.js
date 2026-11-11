export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
      if (!env.AI) return Response.json({ error: "Doge AI is not connected to Cloudflare Workers AI yet." }, { status: 503 });
      try {
        const body = await request.json();
        if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
        const totalChars = body.messages.reduce((sum, message) => sum + String(message.content ?? "").length, 0);
        if (totalChars > 100000) return Response.json({ error: "This conversation is too large. Please start a new chat or attach smaller files." }, { status: 413 });
        const styles = {
          Friendly: "Use a friendly, natural, encouraging tone.",
          Concise: "Be concise and direct. Prefer short answers unless detail is needed.",
          Detailed: "Give thorough explanations with useful examples when appropriate.",
          Professional: "Use a clear, professional and neutral tone."
        };
        const messages = [
          { role: "system", content: "You are Doge AI, a helpful assistant. Keep answers understandable. Do not claim to have tools or abilities you do not have. " + (styles[body.personality] || styles.Friendly) },
          ...body.messages.map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: String(message.content ?? "").slice(0, 50000) }))
        ];
        if (body.stream) {
          let lastError;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
                messages, max_tokens: 1600, temperature: body.advanced ? 0.8 : 0.6, stream: true
              });
              if (result instanceof Response) return result;
              if (result && typeof result.getReader === "function") return new Response(result, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
              if (result?.body) return new Response(result.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
              throw new Error("The model did not return a streaming response.");
            } catch (error) {
              lastError = error;
              if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
            }
          }
          return Response.json({ error: "Doge AI couldn't start a response after a few tries. Please try again." }, { status: 502 });
        }
        let reply = "", lastModelError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", { messages, max_tokens: 1600, temperature: body.advanced ? 0.8 : 0.6 });
            const candidate = result?.choices?.[0]?.message?.content ?? result?.response ?? result?.result?.response;
            if (typeof candidate === "string" && candidate.trim()) { reply = candidate.trim(); break; }
            lastModelError = new Error("The model returned an empty response.");
          } catch (error) { lastModelError = error; }
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
        }
        if (!reply) return Response.json({ error: "Doge AI couldn't generate an answer after a few tries. Please try again." }, { status: 502 });
        return Response.json({ reply });
      } catch (error) {
        return Response.json({ error: "Doge AI couldn't reach its AI model. Please try again in a moment." }, { status: 502 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
