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
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "The AI provider returned an error." });
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "I couldn't generate a response." });
  } catch {
    return res.status(500).json({ error: "Something went wrong while contacting the AI." });
  }
}
