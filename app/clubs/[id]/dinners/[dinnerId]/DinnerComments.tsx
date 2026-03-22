"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_LENGTH = 100;

export type DinnerComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

type Props = {
  dinnerId: string;
  userId: string;
  comments: DinnerComment[];
};

export default function DinnerComments({ dinnerId, userId, comments }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("dinner_comments")
      .insert({ dinner_id: dinnerId, user_id: userId, body: trimmed });

    if (error) {
      setError("Failed to post comment. Try again.");
      setSubmitting(false);
      return;
    }

    setBody("");
    setSubmitting(false);
    router.refresh();
  };

  const handleDelete = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from("dinner_comments").delete().eq("id", commentId);
    router.refresh();
  };

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
          Notes · {comments.length}
        </h3>
      </div>
      <div className="flex flex-col">
        <div className="px-4 py-4 flex flex-col gap-3">
          {comments.length === 0 && (
            <p className="text-sm text-ink-muted text-center py-2">No notes yet — add one below.</p>
          )}
          {comments.map((c) => {
            const isMe = c.user_id === userId;
            return (
              <div key={c.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-xs text-ink-muted px-1">{isMe ? "You" : c.author_name}</span>
                <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] ${
                      isMe
                        ? "bg-slate text-white rounded-br-sm"
                        : "bg-black/6 text-ink rounded-bl-sm"
                    }`}
                  >
                    {c.body}
                  </div>
                  {isMe && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-ink-muted hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 px-4 pb-4 pt-1">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Cash only, BYOB, ask for the back room…"
            className="flex-1 text-sm border border-black/10 rounded-full px-4 py-2.5 bg-surface placeholder:text-ink-muted/60 focus:outline-none focus:border-black/25"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="text-sm font-semibold text-white bg-slate px-4 rounded-full hover:bg-slate-light transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </form>
        {body.length > MAX_LENGTH * 0.8 && (
          <p className="text-xs text-ink-muted text-right px-4 pb-3">{MAX_LENGTH - body.length} left</p>
        )}
        {error && <p className="text-xs text-red-500 px-4 pb-3">{error}</p>}
      </div>
    </section>
  );
}
