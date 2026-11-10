export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405, headers: { Allow: "POST" } }
        );
      }

      if (!env.AI) {
        return Response.json(
          { error: "Doge AI is not connected to Cloudflare Workers AI yet." },
          { status: 503 }
        );
      }

      try {
        const body = await request.json();
        if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) {
          return Response.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
        }

        const totalChars = body.messages.reduce((sum, message) => sum + String(message.content ?? "").length, 0);\n        if (totalChars > 100000) {\n          return Response.json({ error: "This conversation is too large. Please upload smaller files or start a new chat." }, { status: 413 });\n        }\n\n        const messages = [
          {
            role: "system",
            content: "You are Doge AI, a friendly, clear, helpful assistant. Keep answers understandable and concise. Do not claim to have tools or abilities you do not have."
          },
          ...body.messages.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: String(message.content ?? "").slice(0, 50000)
          }))
        ];

        const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
          messages,
          max_tokens: 1200,
          temperature: body.advanced ? 0.8 : 0.6
        });

        const reply =
          result?.choices?.[0]?.message?.content ??
          result?.response ??
          result?.result?.response;

        if (typeof reply !== "string" || !reply.trim()) {
          return Response.json({ error: "The AI model returned an empty response. Please try again." }, { status: 502 });
        }

        return Response.json({ reply });
      } catch (error) {
        return Response.json(
          { error: "Doge AI couldn't reach its AI model. Please try again in a moment." },
          { status: 502 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
