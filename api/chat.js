export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI is not configured yet. Add OPENAI_API_KEY in your deployment environment." });

  try {
    const { messages, advanced = false } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return res.status(400).json({ error: "Send between 1 and 40 messages." });
    }
    const clean = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 8000),
    }));
    let lastStatus = 502;
    let lastMessage = "The AI provider did not return an answer.";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are Doge AI, a friendly, clear, helpful assistant. Keep answers understandable and concise. Do not claim to have tools or abilities you do not have." },
              ...clean,
            ],
            temperature: advanced ? 0.8 : 0.6,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const reply = data.choices?.[0]?.message?.content;
          if (typeof reply === "string" && reply.trim()) {
            return res.status(200).json({ reply: reply.trim() });
          }
          lastMessage = "The AI provider returned an empty answer.";
          lastStatus = 502;
        } else {
          lastMessage = data.error?.message || "The AI provider returned an error.";
          lastStatus = response.status;
          if (response.status < 500 && response.status !== 429) {
            return res.status(response.status).json({ error: lastMessage });
          }
        }
      } catch {
        lastMessage = "Doge AI temporarily lost connection to its AI provider.";
        lastStatus = 502;
      }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    return res.status(lastStatus >= 500 || lastStatus === 429 ? 502 : lastStatus).json({ error: lastMessage + " Please try again." });
  } catch {
    return res.status(500).json({ error: "Something went wrong while contacting the AI." });
  }
}
