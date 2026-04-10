"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Response = {
  user_id: string;
  date_id: string;
  available: "yes" | "maybe" | "no";
};

type PollDate = {
  id: string;
  proposed_date: string;
};

type Member = {
  user_id: string;
  name: string;
};

type AvailabilityPoll = {
  id: string;
  club_id: string;
  created_by: string;
  title: string;
  status: "open" | "closed";
  dates: PollDate[];
  responses: Response[];
  members: Member[];
};

type Props = {
  clubId: string;
  userId: string;
  poll: AvailabilityPoll | null;
};

const AVAIL_CYCLE: ("yes" | "maybe" | "no")[] = ["yes", "maybe", "no"];

function availNext(current: "yes" | "maybe" | "no" | undefined): "yes" | "maybe" | "no" {
  if (!current) return "yes";
  const idx = AVAIL_CYCLE.indexOf(current);
  return AVAIL_CYCLE[(idx + 1) % AVAIL_CYCLE.length];
}

function availLabel(a: "yes" | "maybe" | "no" | undefined) {
  if (a === "yes") return "✓ Yes";
  if (a === "maybe") return "~ Maybe";
  if (a === "no") return "✗ No";
  return "Respond";
}

function availColor(a: "yes" | "maybe" | "no" | undefined) {
  if (a === "yes") return "bg-green-100 text-green-700 border-green-200";
  if (a === "maybe") return "bg-amber-100 text-amber-700 border-amber-200";
  if (a === "no") return "bg-red-100 text-red-500 border-red-200";
  return "bg-surface text-ink-muted border-black/10";
}

function dotColor(a: "yes" | "maybe" | "no" | undefined) {
  if (a === "yes") return "bg-green-400";
  if (a === "maybe") return "bg-amber-400";
  if (a === "no") return "bg-red-300";
  return "bg-black/10";
}

function formatDate(dateStr: string) {
  // proposed_date is a plain date string (YYYY-MM-DD), parse as local
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function CreatePollForm({ clubId, onCreated }: { clubId: string; onCreated: () => void }) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

  const [title, setTitle] = useState("When works for dinner?");
  const [dates, setDates] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDate = () => setDates((d) => [...d, ""]);
  const removeDate = (i: number) => setDates((d) => d.filter((_, idx) => idx !== i));
  const updateDate = (i: number, val: string) =>
    setDates((d) => d.map((v, idx) => (idx === i ? val : v)));

  const handleSubmit = async () => {
    const validDates = dates.filter(Boolean);
    if (validDates.length === 0) { setError("Add at least one date."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setSubmitting(false); return; }

    const { data: poll, error: pollErr } = await supabase
      .from("availability_polls")
      .insert({ club_id: clubId, created_by: user.id, title: title.trim() })
      .select("id")
      .single();

    if (pollErr || !poll) { setError("Failed to create poll."); setSubmitting(false); return; }

    const { error: datesErr } = await supabase
      .from("availability_poll_dates")
      .insert(validDates.map((d) => ({ poll_id: poll.id, proposed_date: d })));

    if (datesErr) {
      await supabase.from("availability_polls").delete().eq("id", poll.id);
      setError("Failed to add dates.");
      setSubmitting(false);
      return;
    }

    toast.success("Date poll created!");
    onCreated();
  };

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-slate transition-colors text-sm"
        placeholder="Poll title"
      />
      <p className="text-xs text-ink-muted">Proposed dates</p>
      {dates.map((d, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="date"
            value={d}
            onChange={(e) => updateDate(i, e.target.value)}
            min={today}
            className="flex-1 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-slate transition-colors text-sm"
          />
          {dates.length > 1 && (
            <button
              onClick={() => removeDate(i)}
              className="text-ink-muted hover:text-red-500 transition-colors text-lg leading-none w-8 shrink-0"
            >×</button>
          )}
        </div>
      ))}
      <button
        onClick={addDate}
        className="text-xs text-citrus-dark font-semibold hover:text-citrus transition-colors self-start"
      >
        + Add another date
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
      >
        {submitting ? "Creating…" : "Create poll →"}
      </button>
    </div>
  );
}

function ActivePoll({
  poll,
  userId,
  onClose,
}: {
  poll: AvailabilityPoll;
  userId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const isCreator = poll.created_by === userId;

  // Build a lookup: dateId -> my response
  const myResponses: Record<string, "yes" | "maybe" | "no"> = {};
  for (const r of poll.responses) {
    if (r.user_id === userId) myResponses[r.date_id] = r.available;
  }

  const handleToggle = async (date: PollDate) => {
    setLoading(date.id);
    const supabase = createClient();
    const current = myResponses[date.id];
    const next = availNext(current);

    if (!current) {
      // insert
      await supabase.from("availability_responses").insert({
        poll_id: poll.id,
        user_id: userId,
        date_id: date.id,
        available: next,
        none_of_the_above: false,
      });
    } else {
      // update
      await supabase
        .from("availability_responses")
        .update({ available: next })
        .eq("poll_id", poll.id)
        .eq("user_id", userId)
        .eq("date_id", date.id);
    }

    router.refresh();
    setLoading(null);
  };

  const handleClosePoll = async () => {
    const supabase = createClient();
    await supabase.from("availability_polls").update({ status: "closed" }).eq("id", poll.id);
    toast.success("Poll closed.");
    onClose();
    router.refresh();
  };

  const handleDeletePoll = async () => {
    const supabase = createClient();
    await supabase.from("availability_polls").delete().eq("id", poll.id);
    toast.success("Poll deleted.");
    onClose();
    router.refresh();
  };

  // Sort dates ascending
  const sortedDates = [...poll.dates].sort((a, b) => a.proposed_date.localeCompare(b.proposed_date));

  return (
    <div>
      <p className="text-sm font-semibold text-ink px-5 py-3">{poll.title}</p>
      <div className="divide-y divide-black/5">
        {sortedDates.map((date) => {
          const dateResponses = poll.responses.filter((r) => r.date_id === date.id);
          const yesCount = dateResponses.filter((r) => r.available === "yes").length;
          const maybeCount = dateResponses.filter((r) => r.available === "maybe").length;
          const myAvail = myResponses[date.id];

          // Build dots: one per member, colored by their response
          const memberDots = poll.members.map((m) => {
            const resp = poll.responses.find((r) => r.user_id === m.user_id && r.date_id === date.id);
            return { ...m, available: resp?.available };
          });

          return (
            <div key={date.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{formatDate(date.proposed_date)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {memberDots.map((m) => (
                    <span
                      key={m.user_id}
                      title={`${m.name}: ${m.available ?? "no response"}`}
                      className={`w-2 h-2 rounded-full ${dotColor(m.available)}`}
                    />
                  ))}
                  {(yesCount > 0 || maybeCount > 0) && (
                    <span className="text-xs text-ink-muted ml-1">
                      {yesCount > 0 && `${yesCount} yes`}
                      {yesCount > 0 && maybeCount > 0 && " · "}
                      {maybeCount > 0 && `${maybeCount} maybe`}
                    </span>
                  )}
                </div>
              </div>
              {poll.status === "open" && (
                <button
                  onClick={() => handleToggle(date)}
                  disabled={loading === date.id}
                  className={`text-xs font-semibold border rounded-lg px-3 py-1.5 transition-colors shrink-0 disabled:opacity-40 ${availColor(myAvail)}`}
                >
                  {loading === date.id ? "…" : availLabel(myAvail)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isCreator && poll.status === "open" && (
        <div className="px-5 py-3 border-t border-black/5 flex items-center gap-4">
          <button
            onClick={handleClosePoll}
            className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Close poll
          </button>
          <button
            onClick={handleDeletePoll}
            className="text-xs text-ink-muted hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {poll.status === "closed" && (
        <div className="px-5 py-3 border-t border-black/5">
          <span className="text-xs text-ink-faint">Poll closed</span>
        </div>
      )}
    </div>
  );
}

export default function AvailabilityPollSection({ clubId, userId, poll }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
          Find a Date
        </h3>
        {!poll && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors"
          >
            {showCreate ? "Cancel" : "+ Poll dates"}
          </button>
        )}
      </div>

      {poll ? (
        <ActivePoll poll={poll} userId={userId} onClose={() => router.refresh()} />
      ) : !showCreate ? (
        <div className="px-5 py-10 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="font-semibold text-ink text-sm mb-1">No date poll yet</p>
          <p className="text-xs text-ink-muted">Propose some dates so the group can say when they&apos;re free.</p>
        </div>
      ) : null}

      {showCreate && (
        <div className="px-5 pb-5">
          <CreatePollForm
            clubId={clubId}
            onCreated={() => { setShowCreate(false); router.refresh(); }}
          />
        </div>
      )}
    </section>
  );
}
