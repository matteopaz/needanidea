import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import Composer from "./components/Composer.jsx";
import Feed from "./components/Feed.jsx";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:8787/api"
  : "/api";
const AUTH_BASE = import.meta.env.DEV ? "http://localhost:8787" : "";
const PAGE_SIZE = 15;
const PINNED_STORAGE_KEY = "pinned_ideas";

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

function loadPinnedIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PINNED_STORAGE_KEY) || "[]";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

function savePinnedIds(ids) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    return;
  }
}

function applyPinnedOrder(list, pinnedIds) {
  if (!pinnedIds.length) return list;
  const byId = new Map();
  list.forEach((item) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });
  const pinned = [];
  pinnedIds.forEach((id) => {
    const item = byId.get(id);
    if (item) {
      pinned.push(item);
      byId.delete(id);
    }
  });
  return [...pinned, ...byId.values()];
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
  const [pinnedIds, setPinnedIds] = useState(() => loadPinnedIds());
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const transitionRef = useRef([]);
  const pinnedIdsRef = useRef(pinnedIds);

  useEffect(() => {
    pinnedIdsRef.current = pinnedIds;
  }, [pinnedIds]);

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
    setIdeas((list) => {
      const combined = replace ? nextIdeas : [...list, ...nextIdeas];
      return applyPinnedOrder(combined, pinnedIdsRef.current);
    });
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

  function updateCommentDraft(ideaId, value) {
    setCommentDrafts((prev) => ({ ...prev, [ideaId]: value }));
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

  async function voteComment(ideaId, commentId, delta) {
    const res = await fetch(`${API_BASE}/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || "comment vote failed");
      return;
    }
    const updated = await res.json();
    setCommentsByIdea((prev) => ({
      ...prev,
      [ideaId]: (prev[ideaId] || []).map((item) =>
        item.id === updated.id ? updated : item
      ),
    }));
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

    const newIdea = await res.json();
    setPinnedIds((prev) => {
      const next = [newIdea.id, ...prev.filter((id) => id !== newIdea.id)];
      savePinnedIds(next);
      pinnedIdsRef.current = next;
      return next;
    });
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
          <Feed
            ideas={ideas}
            loading={loading}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
            isMobile={isMobile}
            mobileView={mobileView}
            onMobileCta={() => switchMobileView("composer")}
            fadeClass={fadeClass}
            onVote={vote}
            commentOpen={commentOpen}
            toggleComments={toggleComments}
            commentLoading={commentLoading}
            commentsByIdea={commentsByIdea}
            commentDrafts={commentDrafts}
            onDraftChange={updateCommentDraft}
            onPostComment={postComment}
            onVoteComment={voteComment}
          />
        ) : null}
        {showComposer ? (
          <Composer
            user={user}
            authReady={authReady}
            onSignIn={startAuth}
            onSignOut={signOut}
            content={content}
            onContentChange={setContent}
            anonymous={anonymous}
            onToggleAnonymous={() => setAnonymous((value) => !value)}
            onPost={postIdea}
            showCaptcha={showCaptcha}
            turnstileRef={turnstileContainerRef}
            status={status}
            isMobile={isMobile}
            mobileView={mobileView}
            onMobileCta={() => switchMobileView("feed")}
            fadeClass={fadeClass}
          />
        ) : null}
      </div>
    </main>
  );
}
