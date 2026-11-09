export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" } });
      if (!env.OPENAI_API_KEY) return Response.json({ error: "AI isn't configured yet. Add OPENAI_API_KEY as a Worker secret." }, { status: 503 });
      try {
        const body = await request.json();
        const messages = body.messages;
        if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
        const clean = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 8000) }));
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [{ role: "system", content: "You are Doge AI, a friendly, clear, helpful assistant. Keep answers understandable and concise. Do not claim to have tools or abilities you do not have." }, ...clean],
            temperature: body.advanced ? 0.8 : 0.6
          })
        });
        const data = await upstream.json();
        if (!upstream.ok) return Response.json({ error: data.error?.message || "The AI provider returned an error." }, { status: upstream.status });
        return Response.json({ reply: data.choices?.[0]?.message?.content || "I couldn't generate a response." });
      } catch { return Response.json({ error: "Invalid request or AI connection failed." }, { status: 500 }); }
    }
    return env.ASSETS.fetch(request);
  }
};