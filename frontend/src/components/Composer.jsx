import "./Composer.css";

export default function Composer({
  user,
  authReady,
  onSignIn,
  onSignOut,
  content,
  onContentChange,
  anonymous,
  onToggleAnonymous,
  onPost,
  showCaptcha,
  turnstileRef,
  status,
  isMobile,
  mobileView,
  onMobileCta,
  fadeClass,
}) {
  return (
    <aside className={`composer${fadeClass ? ` ${fadeClass}` : ""}`}>
      <div className="composer-header">
        <h2 className="sidebar-header">have an idea?</h2>
        {isMobile && mobileView === "composer" ? (
          <button className="mobile-cta" onClick={onMobileCta}>
            need an idea? -&gt;
          </button>
        ) : null}
      </div>
      {user ? (
        <div className="auth-row">
          <span>signed in as {user.handle}</span>
          <button className="auth-btn" onClick={onSignOut}>
            sign out
          </button>
        </div>
      ) : authReady ? (
        <button className="auth-btn" onClick={onSignIn}>
          sign in with 𝕏
        </button>
      ) : null}
      <div>
        <textarea
          id="idea-input"
          maxLength={200}
          placeholder="something that should exist (max 200 char.)"
          value={content}
          rows={3}
          onInput={(e) => onContentChange(e.target.value)}
        />
      </div>
      <div className="composer-actions">
        {user ? (
          <button
            type="button"
            className={`anon-toggle${anonymous ? " is-anon" : ""}`}
            onClick={onToggleAnonymous}
          >
            <span className="anon-track">
              <span className="anon-option anon-user">{user.handle}</span>
              <span className="anon-option anon-anon">anonymous</span>
            </span>
          </button>
        ) : (
          <div className="anon-label">anonymous</div>
        )}
        <button id="post-btn" onClick={onPost}>
          post
        </button>
      </div>
      {showCaptcha ? (
        <div className="captcha-wrap">
          <div ref={turnstileRef}></div>
        </div>
      ) : null}
      {status ? (
        <div id="status">{status}</div>
      ) : null}
      <section className="what-is">
        <h2 className="sidebar-header">what is this?</h2>
        <p>
          sometimes you come up with a great idea that you don't have the time for—something you want, something ultra-profitable, or just something that would make the world a little better. this is the place for those ideas to find a home.
        </p>
      </section>
    </aside>
  );
}
