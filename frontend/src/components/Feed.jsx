import "./Feed.css";
import IdeaCard from "./IdeaCard.jsx";

export default function Feed({
  ideas,
  loading,
  hasMore,
  sentinelRef,
  isMobile,
  mobileView,
  onMobileCta,
  fadeClass,
  onVote,
  commentOpen,
  toggleComments,
  commentLoading,
  commentsByIdea,
  commentDrafts,
  onDraftChange,
  onPostComment,
  onVoteComment,
}) {
  return (
    <section className={`feed${fadeClass ? ` ${fadeClass}` : ""}`}>
      <div className="feed-header">
        <h1>need an idea?</h1>
        {isMobile && mobileView === "feed" ? (
          <button className="mobile-cta" onClick={onMobileCta}>
            have an idea? -&gt;
          </button>
        ) : null}
      </div>
      <section id="ideas">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            onVote={onVote}
            isOpen={Boolean(commentOpen[idea.id])}
            onToggleComments={() => toggleComments(idea.id)}
            comments={commentsByIdea[idea.id] || []}
            loadingComments={Boolean(commentLoading[idea.id])}
            commentDraft={commentDrafts[idea.id] || ""}
            onDraftChange={(value) => onDraftChange(idea.id, value)}
            onPostComment={() => onPostComment(idea.id)}
            onVoteComment={(commentId, delta) =>
              onVoteComment(idea.id, commentId, delta)
            }
          />
        ))}
      </section>
      <div className="sentinel" ref={sentinelRef}>
        {loading ? "loading..." : hasMore ? "" : "no more ideas :("}
      </div>
    </section>
  );
}
