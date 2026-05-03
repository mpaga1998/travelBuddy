import { useCallback, useEffect, useState } from 'react';
import {
  addComment,
  COMMENT_MAX_LENGTH,
  deleteComment,
  fetchComments,
  type PinComment,
} from './commentsApi';
import { checkContentAllowed, MODERATION_REJECTION_MESSAGE } from '../../lib/moderation';
import { imgAvatar } from '../../lib/imageTransforms';

/**
 * 5.5: Comments thread for a pin, rendered inside PinPopup.
 *
 * PinPopup is mounted via createRoot in PinLayer — outside the main app
 * React tree — so this component can't use ConfirmDialog/Toaster from the
 * top-level providers. Errors surface inline; delete-on-click has no
 * confirm step (cheap to recreate, and adding a confirm here would need
 * a self-contained modal like ReportDialog does).
 *
 * Author handle clicks navigate to /u/:handle via the same pushState +
 * popstate dispatch trick PinPopup itself uses for the "Pinned by" pill.
 *
 * Moderation: comment bodies are pre-flighted through OpenAI moderation
 * the same way pin creation is — uses the existing checkContentAllowed
 * helper (fails open on transient errors).
 */

export interface PinCommentsProps {
  pinId: string;
  currentUserId: string | null;
}

export function PinComments({ pinId, currentUserId }: PinCommentsProps) {
  const [comments, setComments] = useState<PinComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComments(pinId);
      setComments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [pinId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!currentUserId) {
      setError('Sign in to comment.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      // Pre-flight via OpenAI moderation — same gate as pin creation in 4.4.
      const allowed = await checkContentAllowed(trimmed);
      if (!allowed) {
        setError(MODERATION_REJECTION_MESSAGE);
        return;
      }

      const created = await addComment(pinId, trimmed);
      setComments((prev) => [...prev, created]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }, [draft, pinId, currentUserId, submitting]);

  const handleDelete = useCallback(async (commentId: string) => {
    // Optimistic — drop locally first, restore on failure.
    const prev = comments;
    setComments(comments.filter((c) => c.id !== commentId));
    try {
      await deleteComment(commentId);
    } catch (e) {
      setComments(prev);
      setError(e instanceof Error ? e.message : 'Failed to delete comment');
    }
  }, [comments]);

  return (
    <div className="border-t border-black/[0.08] mt-2 pt-3">
      <div className="text-[12px] font-bold uppercase tracking-wide text-gray-500 mb-2 px-3">
        Comments {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
      </div>

      {/* Composer (only when signed in). */}
      {currentUserId && (
        <div className="px-3 mb-3 flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add a comment…"
            rows={2}
            // bg-white + text-[#111] + [color-scheme:light] forces the
            // composer to stay readable on Android/iOS Chrome's dark mode,
            // which otherwise auto-darkens unstyled <textarea>s. Same trick
            // we already use on the date inputs in ItineraryForm.
            className="w-full px-2.5 py-2 rounded-lg border border-black/[0.18] text-[13px] resize-y min-h-[48px] bg-white text-[#111] placeholder:text-gray-400 [color-scheme:light] focus:outline-none focus:border-blue-600"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {draft.length}/{COMMENT_MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
              disabled={submitting || !draft.trim()}
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-3 mb-2 px-2.5 py-1.5 rounded bg-red-50 text-red-800 text-[12px] border border-red-100">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="px-3 pb-3 text-[12px] text-gray-400 italic">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="px-3 pb-3 text-[12px] text-gray-400 italic">
          {currentUserId ? 'Be the first to comment.' : 'No comments yet.'}
        </div>
      ) : (
        <ul className="px-3 pb-3 flex flex-col gap-2.5">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              isMine={c.authorId === currentUserId}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  isMine,
  onDelete,
}: {
  comment: PinComment;
  isMine: boolean;
  onDelete: (id: string) => void;
}) {
  const displayName =
    comment.authorRole === 'hostel'
      ? comment.authorHostelName ?? comment.authorUsername
      : comment.authorUsername;

  const goToAuthor = () => {
    if (!comment.authorHandle) return;
    window.history.pushState({}, '', `/u/${comment.authorHandle}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <li className="flex gap-2">
      {comment.authorAvatarUrl ? (
        <img
          src={imgAvatar(comment.authorAvatarUrl) ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-7 h-7 rounded-full object-cover bg-gray-100 flex-shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
          🙂
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToAuthor(); }}
            disabled={!comment.authorHandle}
            className={`text-[12px] font-semibold ${
              comment.authorHandle ? 'cursor-pointer hover:underline' : 'cursor-default'
            } bg-transparent border-none p-0 outline-none text-[#111]`}
          >
            {displayName}
          </button>
          <span className="text-[11px] text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
          {isMine && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
              className="ml-auto text-[11px] text-gray-400 hover:text-red-600 bg-transparent border-none p-0 outline-none cursor-pointer"
              aria-label="Delete comment"
            >
              Delete
            </button>
          )}
        </div>
        <div className="text-[13px] text-[#111] whitespace-pre-wrap break-words">
          {comment.body}
        </div>
      </div>
    </li>
  );
}

/** Same shape as the helper in feed/notifications — kept local for the popup tree. */
function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
