function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function getVoterId(req) {
  const ip =
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";
  return ip || "local";
}

async function verifyTurnstile(token, req, env) {
  if (!env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY.startsWith("YOUR_")) {
    return { ok: false, reason: "Captcha not configured" };
  }

  if (!token) {
    return { ok: false, reason: "Missing captcha token" };
  }

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  const ip = req.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    return { ok: false, reason: "Captcha verification failed" };
  }

  const data = await resp.json();
  return data.success ? { ok: true } : { ok: false, reason: "Captcha rejected" };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/ideas" && req.method === "GET") {
      const voter = getVoterId(req);
      const { results } = await env.DB.prepare(
        `SELECT ideas.id, ideas.content, ideas.author, ideas.upvotes,
          COALESCE(v.delta, 0) AS my_vote
         FROM ideas
         LEFT JOIN idea_votes v
           ON v.idea_id = ideas.id AND v.voter = ?1
         ORDER BY ideas.upvotes DESC, ideas.id DESC`
      )
        .bind(voter)
        .all();
      return jsonResponse({ ideas: results });
    }

    if (url.pathname === "/api/ideas" && req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const content = (body.content || "").trim();
      const author = (body.author || "").trim();
      const token = body.token;

      if (!content || content.length > 100) {
        return jsonResponse({ error: "Content must be 1-100 characters" }, 400);
      }

      if (!author || author.length > 20) {
        return jsonResponse({ error: "Author must be 1-20 characters" }, 400);
      }

      const captcha = await verifyTurnstile(token, req, env);
      if (!captcha.ok) {
        return jsonResponse({ error: captcha.reason }, 403);
      }

      const result = await env.DB.prepare(
        "INSERT INTO ideas (content, author, upvotes) VALUES (?1, ?2, 0)"
      )
        .bind(content, author)
        .run();

      const id = result.meta.last_row_id;
      return jsonResponse({ id, content, author, upvotes: 0 }, 201);
    }

    if (url.pathname.startsWith("/api/ideas/") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const id = Number(parts[3]);
      const action = parts[4];

      if (!id || action !== "vote") {
        return jsonResponse({ error: "Not found" }, 404);
      }

      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const delta = Number(body.delta);
      if (![1, -1].includes(delta)) {
        return jsonResponse({ error: "delta must be 1 or -1" }, 400);
      }

      const ideaExists = await env.DB.prepare("SELECT id FROM ideas WHERE id = ?1")
        .bind(id)
        .first();

      if (!ideaExists) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      const voter = getVoterId(req);
      const existingVote = await env.DB.prepare(
        "SELECT delta FROM idea_votes WHERE idea_id = ?1 AND voter = ?2"
      )
        .bind(id, voter)
        .first();

      if (!existingVote) {
        await env.DB.prepare(
          "INSERT INTO idea_votes (idea_id, voter, delta) VALUES (?1, ?2, ?3)"
        )
          .bind(id, voter, delta)
          .run();

        await env.DB.prepare("UPDATE ideas SET upvotes = upvotes + ?1 WHERE id = ?2")
          .bind(delta, id)
          .run();
      } else if (existingVote.delta !== delta) {
        const diff = delta - existingVote.delta;
        await env.DB.prepare(
          "UPDATE idea_votes SET delta = ?1 WHERE idea_id = ?2 AND voter = ?3"
        )
          .bind(delta, id, voter)
          .run();

        await env.DB.prepare("UPDATE ideas SET upvotes = upvotes + ?1 WHERE id = ?2")
          .bind(diff, id)
          .run();
      }

      const idea = await env.DB.prepare(
        `SELECT ideas.id, ideas.content, ideas.author, ideas.upvotes,
          COALESCE(v.delta, 0) AS my_vote
         FROM ideas
         LEFT JOIN idea_votes v
           ON v.idea_id = ideas.id AND v.voter = ?2
         WHERE ideas.id = ?1`
      )
        .bind(id, voter)
        .first();

      return jsonResponse(idea);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
