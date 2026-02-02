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
  "access-control-allow-headers": "content-type,authorization",
};

function redirectResponse(location) {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function safeReturnTo(value) {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

function getAuthToken(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function getVoterId(req) {
  const ip =
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";
  return ip || "local";
}

async function getSession(req, env) {
  const token = getAuthToken(req);
  if (!token) return null;
  return env.DB.prepare("SELECT handle FROM sessions WHERE token = ?1")
    .bind(token)
    .first();
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

    if (url.pathname === "/auth/x/start" && req.method === "GET") {
      if (!env.X_CLIENT_ID || env.X_CLIENT_ID.startsWith("YOUR_")) {
        return new Response("X OAuth not configured", { status: 500 });
      }
      if (!env.X_REDIRECT_URI || env.X_REDIRECT_URI.startsWith("YOUR_")) {
        return new Response("X OAuth not configured", { status: 500 });
      }

      const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
      const state = randomBase64Url(24);
      const codeVerifier = randomBase64Url(32);
      const codeChallenge = await sha256Base64Url(codeVerifier);

      await env.DB.prepare(
        "INSERT INTO oauth_states (state, code_verifier, return_to) VALUES (?1, ?2, ?3)"
      )
        .bind(state, codeVerifier, returnTo)
        .run();

      const params = new URLSearchParams({
        response_type: "code",
        client_id: env.X_CLIENT_ID,
        redirect_uri: env.X_REDIRECT_URI,
        scope: env.X_SCOPES || "users.read tweet.read",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      return redirectResponse(
        `https://x.com/i/oauth2/authorize?${params.toString()}`
      );
    }

    if (url.pathname === "/auth/x/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      const stored = await env.DB.prepare(
        "SELECT code_verifier, return_to FROM oauth_states WHERE state = ?1"
      )
        .bind(state)
        .first();

      if (!stored) {
        return new Response("Invalid state", { status: 400 });
      }

      await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?1")
        .bind(state)
        .run();

      const body = new URLSearchParams({
        client_id: env.X_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.X_REDIRECT_URI,
        code_verifier: stored.code_verifier,
      });

      const headers = {
        "content-type": "application/x-www-form-urlencoded",
      };

      if (env.X_CLIENT_SECRET && !env.X_CLIENT_SECRET.startsWith("YOUR_")) {
        headers.authorization = `Basic ${btoa(
          `${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`
        )}`;
      }

      const tokenResp = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers,
        body,
      });
      const tokenText = await tokenResp.clone().text();
      console.log("tokenResp", tokenResp.status, tokenText);
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        return new Response("Token exchange failed", { status: 400 });
      }

      const accessToken = tokenData.access_token;
      const userResp = await fetch("https://api.x.com/2/users/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const userText = await userResp.clone().text();
      console.log("userResp", userResp.status, userText);
      if (!userResp.ok) {
        const hint =
          userResp.status === 403
            ? "X returned 403. Check app permissions for User Lookup and reauthorize with users.read (and tweet.read if required)."
            : "Failed to fetch user from X.";
        return new Response(hint, { status: 400 });
      }
      const userData = await userResp.json();
      if (!userData.data?.username) {
        return new Response("Failed to parse user from X response.", {
          status: 400,
        });
      }

      const handle = `@${userData.data.username}`;
      const sessionToken = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO sessions (token, handle) VALUES (?1, ?2)")
        .bind(sessionToken, handle)
        .run();

      const redirectUrl = new URL(stored.return_to, url.origin);
      redirectUrl.searchParams.set("token", sessionToken);
      return redirectResponse(redirectUrl.toString());
    }

    if (url.pathname === "/api/me" && req.method === "GET") {
      const session = await getSession(req, env);
      return jsonResponse({ user: session ? { handle: session.handle } : null });
    }

    if (url.pathname === "/api/leaderboard" && req.method === "GET") {
      const session = await getSession(req, env);
      const rawLimit = Number.parseInt(url.searchParams.get("limit") || "10", 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;
      const { results } = await env.DB.prepare(
        `WITH handles AS (
           SELECT DISTINCT handle FROM sessions
           UNION
           SELECT DISTINCT author FROM ideas WHERE author <> 'anonymous'
           UNION
           SELECT DISTINCT author FROM comments WHERE author <> 'anonymous'
         ),
         scores AS (
           SELECT h.handle,
             COALESCE(i.upvotes_total, 0) AS upvote_total,
             COALESCE(c.reply_count, 0) AS reply_count,
             (COALESCE(i.upvotes_total, 0) + COALESCE(c.reply_count, 0) * 10) AS score
           FROM handles h
           LEFT JOIN (
             SELECT author, SUM(upvotes) AS upvotes_total
             FROM ideas
             WHERE author <> 'anonymous'
             GROUP BY author
           ) i ON i.author = h.handle
           LEFT JOIN (
             SELECT author, COUNT(1) AS reply_count
             FROM comments
             WHERE author <> 'anonymous'
             GROUP BY author
           ) c ON c.author = h.handle
         ),
         ranked AS (
           SELECT *,
             RANK() OVER (
               ORDER BY score DESC, upvote_total DESC, reply_count DESC, handle ASC
             ) AS rank
           FROM scores
         )
         SELECT handle, upvote_total, reply_count, score, rank
         FROM ranked
         ORDER BY rank ASC
         LIMIT ?1`
      )
        .bind(limit)
        .all();

      let me = null;
      if (session?.handle) {
        me = await env.DB.prepare(
          `WITH handles AS (
             SELECT DISTINCT handle FROM sessions
             UNION
             SELECT DISTINCT author FROM ideas WHERE author <> 'anonymous'
             UNION
             SELECT DISTINCT author FROM comments WHERE author <> 'anonymous'
           ),
           scores AS (
             SELECT h.handle,
               COALESCE(i.upvotes_total, 0) AS upvote_total,
               COALESCE(c.reply_count, 0) AS reply_count,
               (COALESCE(i.upvotes_total, 0) + COALESCE(c.reply_count, 0) * 10) AS score
             FROM handles h
             LEFT JOIN (
               SELECT author, SUM(upvotes) AS upvotes_total
               FROM ideas
               WHERE author <> 'anonymous'
               GROUP BY author
             ) i ON i.author = h.handle
             LEFT JOIN (
               SELECT author, COUNT(1) AS reply_count
               FROM comments
               WHERE author <> 'anonymous'
               GROUP BY author
             ) c ON c.author = h.handle
           ),
           ranked AS (
             SELECT *,
               RANK() OVER (
                 ORDER BY score DESC, upvote_total DESC, reply_count DESC, handle ASC
               ) AS rank
             FROM scores
           )
           SELECT handle, upvote_total, reply_count, score, rank
           FROM ranked
           WHERE handle = ?1`
        )
          .bind(session.handle)
          .first();
      }

      return jsonResponse({ leaderboard: results, me });
    }

    if (url.pathname === "/api/ideas" && req.method === "GET") {
      const session = await getSession(req, env);
      const voter = session?.handle || getVoterId(req);
      const rawLimit = Number.parseInt(url.searchParams.get("limit") || "15", 10);
      const rawOffset = Number.parseInt(url.searchParams.get("offset") || "0", 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 15;
      const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
      const { results } = await env.DB.prepare(
        `SELECT ideas.id, ideas.content, ideas.author, ideas.upvotes,
          COALESCE(v.delta, 0) AS my_vote,
          COALESCE((SELECT COUNT(1) FROM comments c WHERE c.idea_id = ideas.id), 0)
            AS comment_count,
          (SELECT c.content FROM comments c WHERE c.idea_id = ideas.id ORDER BY c.id DESC LIMIT 1)
            AS top_comment,
          (SELECT c.author FROM comments c WHERE c.idea_id = ideas.id ORDER BY c.id DESC LIMIT 1)
            AS top_comment_author
         FROM ideas
         LEFT JOIN idea_votes v
           ON v.idea_id = ideas.id AND v.voter = ?1
         ORDER BY ideas.upvotes DESC, ideas.id DESC
         LIMIT ?2 OFFSET ?3`
      )
        .bind(voter, limit, offset)
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

      const session = await getSession(req, env);
      const anonymous = Boolean(body.anonymous);
      if (!session && !anonymous) {
        return jsonResponse({ error: "Sign in required" }, 401);
      }

      const content = (body.content || "").trim();
      const author = anonymous ? "anonymous" : session.handle;
      const token = body.token;

      if (!content || content.length > 200) {
        return jsonResponse({ error: "Content must be 1-200 characters" }, 400);
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
      return jsonResponse(
        {
          id,
          content,
          author,
          upvotes: 0,
          my_vote: 0,
          comment_count: 0,
          top_comment: null,
          top_comment_author: null,
        },
        201
      );
    }

    if (url.pathname.startsWith("/api/ideas/") && url.pathname.endsWith("/comments")) {
      const parts = url.pathname.split("/");
      const id = Number(parts[3]);
      if (!id) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      const ideaExists = await env.DB.prepare("SELECT id FROM ideas WHERE id = ?1")
        .bind(id)
        .first();
      if (!ideaExists) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      if (req.method === "GET") {
        const session = await getSession(req, env);
        const voter = session?.handle || getVoterId(req);
        const { results } = await env.DB.prepare(
          `SELECT c.id, c.content, c.author, c.created_at, c.upvotes,
            COALESCE(v.delta, 0) AS my_vote
           FROM comments c
           LEFT JOIN comment_votes v
             ON v.comment_id = c.id AND v.voter = ?2
           WHERE c.idea_id = ?1
           ORDER BY c.upvotes DESC, c.id DESC`
        )
          .bind(id, voter)
          .all();
        return jsonResponse({ comments: results });
      }

      if (req.method === "POST") {
        let body;
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const content = (body.content || "").trim();
        if (!content || content.length > 200) {
          return jsonResponse({ error: "Comment must be 1-200 characters" }, 400);
        }

        const session = await getSession(req, env);
        const author = session?.handle || "anonymous";
        const result = await env.DB.prepare(
          "INSERT INTO comments (idea_id, content, author, upvotes) VALUES (?1, ?2, ?3, 0)"
        )
          .bind(id, content, author)
          .run();

        const comment = await env.DB.prepare(
          "SELECT id, content, author, created_at, upvotes, 0 AS my_vote FROM comments WHERE id = ?1"
        )
          .bind(result.meta.last_row_id)
          .first();

        return jsonResponse(comment, 201);
      }
    }

    if (url.pathname.startsWith("/api/comments/") && url.pathname.endsWith("/vote")) {
      const parts = url.pathname.split("/");
      const id = Number(parts[3]);
      if (!id || req.method !== "POST") {
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

      const commentExists = await env.DB.prepare("SELECT id FROM comments WHERE id = ?1")
        .bind(id)
        .first();
      if (!commentExists) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      const session = await getSession(req, env);
      const voter = session?.handle || getVoterId(req);
      const existingVote = await env.DB.prepare(
        "SELECT delta FROM comment_votes WHERE comment_id = ?1 AND voter = ?2"
      )
        .bind(id, voter)
        .first();

      if (!existingVote) {
        await env.DB.prepare(
          "INSERT INTO comment_votes (comment_id, voter, delta) VALUES (?1, ?2, ?3)"
        )
          .bind(id, voter, delta)
          .run();

        await env.DB.prepare("UPDATE comments SET upvotes = upvotes + ?1 WHERE id = ?2")
          .bind(delta, id)
          .run();
      } else if (existingVote.delta !== delta) {
        const diff = delta - existingVote.delta;
        await env.DB.prepare(
          "UPDATE comment_votes SET delta = ?1 WHERE comment_id = ?2 AND voter = ?3"
        )
          .bind(delta, id, voter)
          .run();

        await env.DB.prepare("UPDATE comments SET upvotes = upvotes + ?1 WHERE id = ?2")
          .bind(diff, id)
          .run();
      }

      const comment = await env.DB.prepare(
        `SELECT c.id, c.content, c.author, c.created_at, c.upvotes,
          COALESCE(v.delta, 0) AS my_vote
         FROM comments c
         LEFT JOIN comment_votes v
           ON v.comment_id = c.id AND v.voter = ?2
         WHERE c.id = ?1`
      )
        .bind(id, voter)
        .first();

      return jsonResponse(comment);
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

      const session = await getSession(req, env);
      const voter = session?.handle || getVoterId(req);
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
          COALESCE(v.delta, 0) AS my_vote,
          COALESCE((SELECT COUNT(1) FROM comments c WHERE c.idea_id = ideas.id), 0)
            AS comment_count,
          (SELECT c.content FROM comments c WHERE c.idea_id = ideas.id ORDER BY c.id DESC LIMIT 1)
            AS top_comment,
          (SELECT c.author FROM comments c WHERE c.idea_id = ideas.id ORDER BY c.id DESC LIMIT 1)
            AS top_comment_author
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
