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


    // Device-based DOGE AI profiles and shared group conversations.
    const db = env.DB;
    if (url.pathname.startsWith("/api/users") || url.pathname.startsWith("/api/groups")) {
      if (!db) return json({ error: "Group chat database is not configured." }, 503);
      const deviceId = request.headers.get("X-Doge-Device") || "";
      const validId = /^[a-f0-9-]{36}$/i.test(deviceId);
      const user = validId ? await db.prepare("SELECT device_id, username FROM users WHERE device_id = ?").bind(deviceId).first() : null;
      const parts = url.pathname.split("/").filter(Boolean);
      try {
        if (url.pathname === "/api/users/me" && request.method === "GET") return json({ user: user || null });
        if (url.pathname === "/api/users/register" && request.method === "POST") {
          const body = await request.json();
          const username = String(body.username || "").trim();
          if (!validId) return json({ error: "This device could not be identified. Refresh and try again." }, 400);
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return json({ error: "Username must be 3–20 characters using letters, numbers, or underscores." }, 400);
          if (user) return json({ user });
          try {
            await db.prepare("INSERT INTO users (device_id, username) VALUES (?, ?)").bind(deviceId, username).run();
          } catch { return json({ error: "That username is already taken. Choose another one." }, 409); }
          return json({ user: { device_id: deviceId, username } }, 201);
        }
        if (!user) return json({ error: "Create your DOGE AI user first." }, 401);

        if (url.pathname === "/api/groups" && request.method === "GET") {
          const result = await db.prepare("SELECT g.id, g.name, g.owner_id, g.created_at, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS member_count FROM groups g JOIN group_members mine ON mine.group_id=g.id WHERE mine.device_id=? ORDER BY g.created_at DESC").bind(deviceId).all();
          return json({ groups: result.results || [] });
        }
        if (url.pathname === "/api/groups" && request.method === "POST") {
          const body = await request.json();
          const name = String(body.name || "").trim().slice(0, 48);
          if (!name) return json({ error: "Enter a group name." }, 400);
          const id = crypto.randomUUID();
          await db.batch([
            db.prepare("INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)").bind(id, name, deviceId),
            db.prepare("INSERT INTO group_members (group_id, device_id, role) VALUES (?, ?, 'owner')").bind(id, deviceId)
          ]);
          return json({ group: { id, name, owner_id: deviceId, member_count: 1 } }, 201);
        }
        const groupId = parts[2] || "";
        if (!/^[a-f0-9-]{36}$/i.test(groupId)) return json({ error: "Invalid group." }, 400);
        const membership = await db.prepare("SELECT role FROM group_members WHERE group_id=? AND device_id=?").bind(groupId, deviceId).first();
        if (!membership) return json({ error: "You are not a member of this group." }, 403);

        if (parts[3] === "members" && request.method === "GET") {
          const result = await db.prepare("SELECT u.device_id, u.username, gm.role FROM group_members gm JOIN users u ON u.device_id=gm.device_id WHERE gm.group_id=? ORDER BY CASE gm.role WHEN 'owner' THEN 0 ELSE 1 END, u.username").bind(groupId).all();
          return json({ members: result.results || [] });
        }
        if (parts[3] === "members" && request.method === "POST") {
          if (membership.role !== "owner") return json({ error: "Only the group owner can invite people." }, 403);
          const body = await request.json();
          const username = String(body.username || "").trim();
          const invited = await db.prepare("SELECT device_id FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
          if (!invited) return json({ error: "No DOGE AI user found with that username." }, 404);
          await db.prepare("INSERT OR IGNORE INTO group_members (group_id, device_id, role) VALUES (?, ?, 'member')").bind(groupId, invited.device_id).run();
          return json({ success: true });
        }
        if (parts[3] === "messages" && request.method === "GET") {
          const result = await db.prepare("SELECT m.id, m.sender_id, u.username, m.content, m.created_at FROM group_messages m JOIN users u ON u.device_id=m.sender_id WHERE m.group_id=? ORDER BY m.created_at DESC LIMIT 100").bind(groupId).all();
          return json({ messages: (result.results || []).reverse() });
        }
        if (parts[3] === "messages" && request.method === "POST") {
          const body = await request.json();
          const text = String(body.content || "").trim();
          if (!text || text.length > 5000) return json({ error: "Message must be 1–5,000 characters." }, 400);
          const id = crypto.randomUUID();
          await db.prepare("INSERT INTO group_messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)").bind(id, groupId, deviceId, text).run();
          return json({ message: { id, sender_id: deviceId, username: user.username, content: text } }, 201);
        }
        return json({ error: "Not found." }, 404);
      } catch (error) {
        return json({ error: "Group chat request failed. Please try again." }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
