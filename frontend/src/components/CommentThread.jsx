import "./CommentThread.css";

export default function CommentThread({
  topComment,
  topCommentAuthor,
  isOpen,
  loading,
  comments,
  draft,
  onDraftChange,
  onSubmit,
  onToggle,
  onVote,
}) {
  const topCommentMatch = topComment
    ? comments.find(
        (comment) =>
          comment.content === topComment && comment.author === topCommentAuthor
      )
    : null;
  const filteredComments = topCommentMatch
    ? comments.filter((comment) => comment.id !== topCommentMatch.id)
    : comments;
  const showEmpty = !loading && filteredComments.length === 0 && !topComment;

  return (
    <div className={`comment-thread${isOpen ? " is-open" : ""}`}>
      {topComment && !isOpen ? (
        <button className="comment-preview-button" onClick={onToggle}>
          “{topComment}”
          <span className="comment-preview-author">—&nbsp;{topCommentAuthor}</span>
        </button>
      ) : null}
      {isOpen ? (
        <div className="comment-panel">
          {loading ? <div className="comment-muted">loading...</div> : null}
          {showEmpty ? <div className="comment-muted">no comments yet</div> : null}
          {topCommentMatch ? (
            <div className="comment-item" key={topCommentMatch.id}>
              <div className="comment-body">
                <span className="comment-content">
                  “{topCommentMatch.content}”
                </span>
                <span className="comment-author">
                  —&nbsp;{topCommentMatch.author}
                </span>
              </div>
              <div className="comment-votes">
                <button
                  className={`comment-vote-btn${
                    topCommentMatch.my_vote === 1 ? " is-active" : ""
                  }`}
                  onClick={() => onVote(topCommentMatch.id, 1)}
                >
                  ▲
                </button>
                <div className="comment-vote-count">
                  {topCommentMatch.upvotes ?? 0}
                </div>
                <button
                  className={`comment-vote-btn${
                    topCommentMatch.my_vote === -1 ? " is-active" : ""
                  }`}
                  onClick={() => onVote(topCommentMatch.id, -1)}
                >
                  ▼
                </button>
              </div>
            </div>
          ) : null}
          {filteredComments.map((comment) => (
            <div className="comment-item" key={comment.id}>
              <div className="comment-body">
                <span className="comment-content">“{comment.content}”</span>
                <span className="comment-author">—&nbsp;{comment.author}</span>
              </div>
              <div className="comment-votes">
                <button
                  className={`comment-vote-btn${comment.my_vote === 1 ? " is-active" : ""}`}
                  onClick={() => onVote(comment.id, 1)}
                >
                  ▲
                </button>
                <div className="comment-vote-count">{comment.upvotes ?? 0}</div>
                <button
                  className={`comment-vote-btn${comment.my_vote === -1 ? " is-active" : ""}`}
                  onClick={() => onVote(comment.id, -1)}
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
          <div className="comment-form">
            <textarea
              className="comment-input"
              maxLength={200}
              rows={1}
              placeholder="leave a comment (max 200)"
              value={draft}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
                onDraftChange(el.value);
              }}
            />
            <button className="comment-submit" onClick={onSubmit}>
              comment
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
