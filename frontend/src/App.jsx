import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:8787/api"
  : "/api";
const AUTH_BASE = import.meta.env.DEV ? "http://localhost:8787" : "";
const PAGE_SIZE = 20;

function getStoredToken() {
  try {
    return localStorage.getItem("session_token") || "";
  } catch {
    return "";
  }
}

function setStoredToken(token) {
  try {
    localStorage.setItem("session_token", token);
  } catch {
    return;
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem("session_token");
  } catch {
    return;
  }
}

export default function App() {
  const [ideas, setIdeas] = useState([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [user, setUser] = useState(null);
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  function authHeaders() {
    const token = getStoredToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function loadMe() {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const res = await fetch(`${API_BASE}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearStoredToken();
      setUser(null);
      return;
    }
    const data = await res.json();
    setUser(data.user || null);
  }

  function getTurnstileToken() {
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      return window.turnstile.getResponse(turnstileWidgetIdRef.current) || "";
    }
    const input = document.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  const fetchIdeasPage = useCallback(async (offset, replace = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const res = await fetch(
      `${API_BASE}/ideas?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      setStatus("failed to load ideas");
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    const data = await res.json();
    const nextIdeas = data.ideas || [];
    setIdeas((list) => (replace ? nextIdeas : [...list, ...nextIdeas]));
    setHasMore(nextIdeas.length === PAGE_SIZE);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  async function vote(idea, delta) {
    if (!user) {
      setStatus("sign in with X to vote");
      return;
    }
    const currentVote = idea.my_vote || 0;
    if (currentVote === delta) return;
    const res = await fetch(`${API_BASE}/ideas/${idea.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || "vote failed");
      return;
    }
    const updated = await res.json();
    setIdeas((list) => {
      const next = list.map((item) => (item.id === updated.id ? updated : item));
      next.sort((a, b) => (b.upvotes - a.upvotes) || (b.id - a.id));
      return next;
    });
  }

  async function postIdea() {
    const trimmedContent = content.trim();
    const token = getTurnstileToken();

    if (!user) {
      setStatus("sign in with X to post");
      return;
    }

    if (!trimmedContent) {
      setStatus("please add an idea");
      return;
    }

    if (!showCaptcha) {
      setShowCaptcha(true);
      setStatus("please complete the captcha");
      return;
    }

    if (!token) {
      setStatus("please complete the captcha");
      return;
    }

    setStatus("posting...");
    const res = await fetch(`${API_BASE}/ideas`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        content: trimmedContent,
        token,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || "failed to post");
      return;
    }

    setContent("");
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setStatus("posted");
    setIdeas([]);
    setHasMore(true);
    fetchIdeasPage(0, true);
  }

  function startAuth() {
    const returnTo = window.location.pathname;
    window.location.href = `${AUTH_BASE}/auth/x/start?returnTo=${encodeURIComponent(
      returnTo
    )}`;
  }

  function signOut() {
    clearStoredToken();
    setUser(null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setStoredToken(token);
      params.delete("token");
      const next = params.toString();
      const newUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
    loadMe();
    fetchIdeasPage(0, true);
  }, [fetchIdeasPage]);

  useEffect(() => {
    let cancelled = false;

    function tryRender() {
      if (cancelled) return;
      if (!showCaptcha) return;
      if (!window.turnstile || !turnstileContainerRef.current) {
        setTimeout(tryRender, 100);
        return;
      }
      if (turnstileWidgetIdRef.current !== null) return;
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        { sitekey: "1x00000000000000000000AA" }
      );
    }

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [showCaptcha]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (!hasMore || loading) return;
        fetchIdeasPage(ideas.length, false);
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [ideas.length, hasMore, loading, fetchIdeasPage]);

  return (
    <main>
      <div className="layout">
        <section className="feed">
          <h1>need an idea?</h1>
          <section id="ideas">
            {ideas.map((idea) => (
              <div className="idea" key={idea.id}>
                <div className="idea-content">
                  <p className="idea-text">{idea.content}</p>
                  <div className="idea-meta">by {idea.author}</div>
                </div>
                <div className="votes">
                  <button
                    className={`vote-btn${idea.my_vote === 1 ? " is-active" : ""}`}
                    onClick={() => vote(idea, 1)}
                  >
                    ▲
                  </button>
                  <div className="vote-count">{idea.upvotes}</div>
                  <button
                    className={`vote-btn${idea.my_vote === -1 ? " is-active" : ""}`}
                    onClick={() => vote(idea, -1)}
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </section>
          <div className="sentinel" ref={sentinelRef}>
            {loading ? "loading..." : hasMore ? "" : "no more ideas"}
          </div>
        </section>

        <aside className="composer">
          {user ? (
            <div className="auth-row">
              <span>signed in as {user.handle}</span>
              <button className="auth-btn" onClick={signOut}>
                sign out
              </button>
            </div>
          ) : (
            <button className="auth-btn" onClick={startAuth}>
              sign in with 𝕏
            </button>
          )}
          <div>
            <label htmlFor="idea-input">idea</label>
            <textarea
              id="idea-input"
              maxLength={100}
              placeholder="a tiny startup idea"
              value={content}
              rows={3}
              onInput={(e) => setContent(e.target.value)}
            />
          </div>
          {showCaptcha ? (
            <div className="captcha-wrap">
              <div ref={turnstileContainerRef}></div>
            </div>
          ) : null}
          <button id="post-btn" onClick={postIdea}>
            post
          </button>
          <div id="status">{status}</div>
        </aside>
      </div>
    </main>
  );
}
