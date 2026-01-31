import { useEffect, useRef, useState } from "preact/hooks";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:8787/api"
  : "/api";

export default function App() {
  const [ideas, setIdeas] = useState([]);
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("");
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);

  function getTurnstileToken() {
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      return window.turnstile.getResponse(turnstileWidgetIdRef.current) || "";
    }
    const input = document.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  async function loadIdeas() {
    const res = await fetch(`${API_BASE}/ideas`);
    if (!res.ok) {
      setStatus("failed to load ideas");
      return;
    }
    const data = await res.json();
    setIdeas(data.ideas || []);
  }

  async function vote(idea, delta) {
    const currentVote = idea.my_vote || 0;
    if (currentVote === delta) return;
    const res = await fetch(`${API_BASE}/ideas/${idea.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

  async function postIdea() {
    const trimmedContent = content.trim();
    const trimmedAuthor = author.trim();
    const token = getTurnstileToken();

    if (!trimmedContent || !trimmedAuthor) {
      setStatus("please add an idea and author");
      return;
    }

    if (!token) {
      setStatus("please complete the captcha");
      return;
    }

    setStatus("posting...");
    const res = await fetch(`${API_BASE}/ideas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: trimmedContent,
        author: trimmedAuthor,
        token,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || "failed to post");
      return;
    }

    setContent("");
    setAuthor("");
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setStatus("posted");
    await loadIdeas();
  }

  useEffect(() => {
    loadIdeas();
  }, []);

  useEffect(() => {
    let cancelled = false;

    function tryRender() {
      if (cancelled) return;
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
  }, []);

  return (
    <main>
      <h1>need an idea?</h1>
      <section id="ideas">
        {ideas.map((idea) => (
          <div className="idea" key={idea.id}>
            <div className="idea-content">
              <p className="idea-text">{idea.content}</p>
              <div className="idea-meta">{idea.author}</div>
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

      <section className="composer">
        <div>
          <label htmlFor="idea-input">idea</label>
          <input
            id="idea-input"
            maxLength={100}
            placeholder="a tiny startup idea"
            value={content}
            onInput={(e) => setContent(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="author-input">author</label>
          <input
            id="author-input"
            maxLength={20}
            placeholder="name or alias"
            value={author}
            onInput={(e) => setAuthor(e.target.value)}
          />
        </div>
        <div ref={turnstileContainerRef}></div>
        <button id="post-btn" onClick={postIdea}>
          post
        </button>
        <div id="status">{status}</div>
      </section>
    </main>
  );
}
