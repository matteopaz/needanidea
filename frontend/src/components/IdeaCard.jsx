import "./IdeaCard.css";
import CommentThread from "./CommentThread.jsx";

export default function IdeaCard({
  idea,
  onVote,
  isOpen,
  onToggleComments,
  comments,
  loadingComments,
  commentDraft,
  onDraftChange,
  onPostComment,
  onVoteComment,
}) {
  const commentCount = idea.comment_count || 0;
  const commentLabel = isOpen
    ? "hide comments"
    : commentCount === 0
    ? "leave a comment..."
    : `show ${commentCount} comment${commentCount === 1 ? "" : "s"}`;
  const showThread = Boolean(idea.top_comment) || isOpen;

  return (
    <div className="idea">
      <div className="idea-row">
        <div className="idea-content">
          <p className="idea-text">{idea.content}</p>
        </div>
        <div className="votes">
          <button
            className={`vote-btn${idea.my_vote === 1 ? " is-active" : ""}`}
            onClick={() => onVote(idea, 1)}
          >
            ▲
          </button>
          <div className="vote-count">{idea.upvotes > 0 ? "+" + idea.upvotes : 0}</div>
          <button
            className={`vote-btn${idea.my_vote === -1 ? " is-active" : ""}`}
            onClick={() => onVote(idea, -1)}
          >
            ▼
          </button>
        </div>
      </div>
      <div className="idea-meta-row">
        <div className="idea-meta">{idea.author}</div>
        <button className="comment-toggle" onClick={onToggleComments}>
          {commentLabel}
        </button>
      </div>
      {showThread ? (
        <CommentThread
          topComment={idea.top_comment}
          topCommentAuthor={idea.top_comment_author}
          isOpen={isOpen}
          loading={loadingComments}
          comments={comments}
          draft={commentDraft}
          onDraftChange={onDraftChange}
          onSubmit={onPostComment}
          onToggle={onToggleComments}
          onVote={onVoteComment}
        />
      ) : null}
    </div>
  );
}
