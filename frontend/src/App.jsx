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
  const [anonymous, setAnonymous] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState("feed");
  const [fadeClass, setFadeClass] = useState("");
  const [commentOpen, setCommentOpen] = useState({});
  const [commentsByIdea, setCommentsByIdea] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const transitionRef = useRef([]);

  function authHeaders() {
    const token = getStoredToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function loadMe() {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    const res = await fetch(`${API_BASE}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearStoredToken();
      setUser(null);
      setAuthReady(true);
      return;
    }
    const data = await res.json();
    setUser(data.user || null);
    setAuthReady(true);
  }

  function getTurnstileToken() {
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      return window.turnstile.getResponse(turnstileWidgetIdRef.current) || "";
    }
    const input = document.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  function clearTransitions() {
    transitionRef.current.forEach((id) => clearTimeout(id));
    transitionRef.current = [];
  }

  function switchMobileView(nextView) {
    if (!isMobile || mobileView === nextView || fadeClass) return;
    clearTransitions();
    setFadeClass("is-fading-out");
    const outId = setTimeout(() => {
      setMobileView(nextView);
      setFadeClass("is-fading-in");
      const inId = setTimeout(() => {
        setFadeClass("");
      }, 250);
      transitionRef.current.push(inId);
    }, 250);
    transitionRef.current.push(outId);
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
    setIdeas((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function fetchComments(ideaId) {
    setCommentLoading((prev) => ({ ...prev, [ideaId]: true }));
    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus("failed to load comments");
      setCommentLoading((prev) => ({ ...prev, [ideaId]: false }));
      return;
    }
    const data = await res.json();
    setCommentsByIdea((prev) => ({ ...prev, [ideaId]: data.comments || [] }));
    setCommentLoading((prev) => ({ ...prev, [ideaId]: false }));
  }

  function toggleComments(ideaId) {
    const isOpen = Boolean(commentOpen[ideaId]);
    setCommentOpen((prev) => ({ ...prev, [ideaId]: !isOpen }));
    if (!isOpen && !commentsByIdea[ideaId]) {
      fetchComments(ideaId);
    }
  }

  async function postComment(ideaId) {
    const draft = (commentDrafts[ideaId] || "").trim();
    if (!draft) {
      setStatus("please add a comment");
      return;
    }
    if (draft.length > 200) {
      setStatus("comment must be 1-200 characters");
      return;
    }
    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ content: draft }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || "failed to post comment");
      return;
    }
    const comment = await res.json();
    setCommentsByIdea((prev) => ({
      ...prev,
      [ideaId]: [comment, ...(prev[ideaId] || [])],
    }));
    setCommentDrafts((prev) => ({ ...prev, [ideaId]: "" }));
    setIdeas((list) =>
      list.map((item) =>
        item.id === ideaId
          ? {
              ...item,
              comment_count: (item.comment_count || 0) + 1,
              top_comment: comment.content,
              top_comment_author: comment.author,
            }
          : item
      )
    );
  }

  async function postIdea() {
    const trimmedContent = content.trim();
    const token = getTurnstileToken();

    if (!user && !anonymous) {
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
        anonymous,
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
    setShowCaptcha(false);
    fetchIdeasPage(0, true);
    if (isMobile) {
      switchMobileView("feed");
    }
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
    setAnonymous(true);
    setAuthReady(true);
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
    if (user) {
      setAnonymous(false);
    } else {
      setAnonymous(true);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        clearTransitions();
        setFadeClass("");
        setMobileView("feed");
      }
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
    } else {
      media.addListener(update);
    }
    return () => {
      clearTransitions();
      if (media.removeEventListener) {
        media.removeEventListener("change", update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

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

  const showFeed = !isMobile || mobileView === "feed";
  const showComposer = !isMobile || mobileView === "composer";

  return (
    <main>
      <div className={`layout${isMobile ? " is-mobile" : ""}`}>
        {showFeed ? (
          <section className={`feed${fadeClass ? ` ${fadeClass}` : ""}`}>
            <div className="feed-header">
              <h1>need an idea?</h1>
              {isMobile && mobileView === "feed" ? (
                <button className="mobile-cta" onClick={() => switchMobileView("composer")}>
                  have an idea? -&gt;
                </button>
              ) : null}
            </div>
            <section id="ideas">
              {ideas.map((idea) => (
              <div className="idea" key={idea.id}>
                <div className="idea-row">
                  <div className="idea-content">
                    <p className="idea-text">{idea.content}</p>
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
                <div className="idea-meta-row">
                  <div className="idea-meta">{idea.author}</div>
                  <button
                    className="comment-toggle"
                    onClick={() => toggleComments(idea.id)}
                  >
                    {commentOpen[idea.id]
                      ? "hide comments"
                      : (idea.comment_count || 0) === 0
                      ? "leave a comment"
                      : `show ${idea.comment_count || 0} comment${
                          (idea.comment_count || 0) === 1 ? "" : "s"
                        }`}
                  </button>
                </div>
                {idea.top_comment || commentOpen[idea.id] ? (
                  <div className="comment-thread">
                    {idea.top_comment ? (
                      <div className="comment-preview">
                        “{idea.top_comment}”
                        <span className="comment-preview-author">
                          — {idea.top_comment_author}
                        </span>
                      </div>
                    ) : null}
                    {commentOpen[idea.id] ? (
                      <div className="comment-panel">
                        {commentLoading[idea.id] ? (
                          <div className="comment-muted">loading...</div>
                        ) : null}
                        {!commentLoading[idea.id] &&
                        (commentsByIdea[idea.id] || []).length === 0 ? (
                          <div className="comment-muted">no comments yet</div>
                        ) : null}
                        {(commentsByIdea[idea.id] || [])
                          .filter((comment, index) => {
                            if (!idea.top_comment) return true;
                            if (index !== 0) return true;
                            return (
                              comment.content !== idea.top_comment ||
                              comment.author !== idea.top_comment_author
                            );
                          })
                          .map((comment) => (
                            <div className="comment-item" key={comment.id}>
                              <span className="comment-content">{comment.content}</span>
                              <span className="comment-author">— {comment.author}</span>
                            </div>
                          ))}
                        <div className="comment-form">
                          <textarea
                            className="comment-input"
                            maxLength={200}
                            placeholder="leave a comment (max 200)"
                            value={commentDrafts[idea.id] || ""}
                            rows={2}
                            onInput={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [idea.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            className="comment-submit"
                            onClick={() => postComment(idea.id)}
                          >
                            comment
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            </section>
            <div className="sentinel" ref={sentinelRef}>
              {loading ? "loading..." : hasMore ? "" : "no more ideas :("}
            </div>
          </section>
        ) : null}

        {showComposer ? (
          <aside className={`composer${fadeClass ? ` ${fadeClass}` : ""}`}>
            <div className="composer-header">
              <h2 className="sidebar-header">have an idea?</h2>
              {isMobile && mobileView === "composer" ? (
                <button className="mobile-cta" onClick={() => switchMobileView("feed")}>
                  need an idea? -&gt;
                </button>
              ) : null}
            </div>
            <hr />
            {user ? (
              <div className="auth-row">
                <span>signed in as {user.handle}</span>
                <button className="auth-btn" onClick={signOut}>
                  sign out
                </button>
              </div>
            ) : authReady ? (
              <button className="auth-btn" onClick={startAuth}>
                sign in with 𝕏
              </button>
            ) : null}
            <div>
              <textarea
                id="idea-input"
                maxLength={100}
                placeholder="something that should exist (max 100 char.)"
                value={content}
                rows={3}
                onInput={(e) => setContent(e.target.value)}
              />
            </div>
            <div className="composer-actions">
              {user ? (
                <button
                  type="button"
                  className={`anon-toggle${anonymous ? " is-anon" : ""}`}
                  onClick={() => setAnonymous((value) => !value)}
                >
                  <span className="anon-track">
                    <span className="anon-option anon-user">{user.handle}</span>
                    <span className="anon-option anon-anon">anonymous</span>
                  </span>
                </button>
              ) : (
                <div className="anon-label">anonymous</div>
              )}
              <button id="post-btn" onClick={postIdea}>
                post
              </button>
            </div>
            {showCaptcha ? (
              <div className="captcha-wrap">
                <div ref={turnstileContainerRef}></div>
              </div>
            ) : null}
            <div id="status">{status}</div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
