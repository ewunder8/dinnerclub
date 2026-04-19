"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { voteDate, noneOfTheAbove, lockDate } from "./actions";

type PollDate = {
  id: string;
  proposed_date: string;
};

type Response = {
  user_id: string;
  date_id: string | null;
  available: "yes" | "maybe" | "no";
  none_of_the_above: boolean;
};

type Member = {
  user_id: string;
  users: { name: string | null; email: string | null; avatar_url: string | null } | null;
};

type Props = {
  dinnerId: string;
  clubId: string;
  pollId: string;
  pollDates: PollDate[];
  responses: Response[];
  members: Member[];
  userId: string;
  isCreator: boolean;
  memberCount: number;
};

const AVAIL_CYCLE: ("yes" | "maybe" | "no")[] = ["yes", "maybe", "no"];

function availNext(current: "yes" | "maybe" | "no" | undefined): "yes" | "maybe" | "no" {
  if (!current) return "yes";
  return AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(current) + 1) % AVAIL_CYCLE.length];
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

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function memberName(m: Member) {
  return m.users?.name || m.users?.email?.split("@")[0] || "Member";
}

export default function DateVotingPanel({
  dinnerId,
  clubId,
  pollId,
  pollDates,
  responses,
  members,
  userId,
  isCreator,
  memberCount,
}: Props) {
  const router = useRouter();
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [loadingNone, setLoadingNone] = useState(false);
  const [loadingLock, setLoadingLock] = useState<string | null>(null);

  const respondedCount = new Set(responses.map((r) => r.user_id)).size;

  // Build lookup: dateId -> my response
  const myDateResponses: Record<string, "yes" | "maybe" | "no"> = {};
  for (const r of responses) {
    if (r.user_id === userId && r.date_id && !r.none_of_the_above) {
      myDateResponses[r.date_id] = r.available;
    }
  }
  const iSaidNone = responses.some((r) => r.user_id === userId && r.none_of_the_above);

  // Members who said none_of_the_above
  const noneMembers = members.filter((m) =>
    responses.some((r) => r.user_id === m.user_id && r.none_of_the_above)
  );
  const noneMemberIds = new Set(noneMembers.map((m) => m.user_id));

  const handleVote = async (dateId: string) => {
    setLoadingDate(dateId);
    const current = myDateResponses[dateId];
    const next = availNext(current);
    const result = await voteDate({ dinnerId, pollId, dateId, available: next });
    if (result.error) toast.error(result.error);
    router.refresh();
    setLoadingDate(null);
  };

  const handleNone = async () => {
    setLoadingNone(true);
    const result = await noneOfTheAbove({ dinnerId, pollId });
    if (result.error) toast.error(result.error);
    router.refresh();
    setLoadingNone(false);
  };

  const handleLockDate = async (date: string) => {
    setLoadingLock(date);
    const result = await lockDate({ dinnerId, clubId, date });
    if (result.error) toast.error(result.error);
    else toast.success("Date locked! Restaurant voting is now open.");
    router.refresh();
    setLoadingLock(null);
  };

  const sorted = [...pollDates].sort((a, b) => a.proposed_date.localeCompare(b.proposed_date));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">{respondedCount}</span> of {memberCount} responded
      </p>

      {sorted.map((pd) => {
        const dateResponses = responses.filter((r) => r.date_id === pd.id && !r.none_of_the_above);
        const yesCount = dateResponses.filter((r) => r.available === "yes").length;
        const maybeCount = dateResponses.filter((r) => r.available === "maybe").length;
        const myAvail = myDateResponses[pd.id];

        // Member dots — exclude those who said none_of_the_above
        const memberDots = members
          .filter((m) => !noneMemberIds.has(m.user_id))
          .map((m) => {
            const resp = responses.find((r) => r.user_id === m.user_id && r.date_id === pd.id && !r.none_of_the_above);
            return { ...m, available: resp?.available as "yes" | "maybe" | "no" | undefined };
          });

        return (
          <div key={pd.id} className="bg-white border border-black/8 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink">{formatDate(pd.proposed_date)}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {memberDots.map((m) => (
                    <span
                      key={m.user_id}
                      title={`${memberName(m)}: ${m.available ?? "no response"}`}
                      className={`w-2.5 h-2.5 rounded-full ${dotColor(m.available)}`}
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

              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => handleVote(pd.id)}
                  disabled={loadingDate === pd.id || iSaidNone}
                  className={`text-xs font-semibold border rounded-xl px-3 py-1.5 transition-colors disabled:opacity-40 ${availColor(myAvail)}`}
                >
                  {loadingDate === pd.id ? "…" : availLabel(myAvail)}
                </button>

                {isCreator && (
                  <button
                    onClick={() => handleLockDate(pd.proposed_date)}
                    disabled={loadingLock === pd.proposed_date}
                    className="text-xs font-semibold text-green-600 border border-green-300 px-3 py-1.5 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-40"
                  >
                    {loadingLock === pd.proposed_date ? "…" : "Lock this date →"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Can't make any of these */}
      <button
        onClick={handleNone}
        disabled={loadingNone || iSaidNone}
        className={`w-full text-sm font-semibold py-3.5 rounded-xl transition-colors ${
          iSaidNone
            ? "bg-red-100 text-red-600 cursor-default"
            : "bg-red-500 hover:bg-red-600 text-white"
        } disabled:opacity-60`}
      >
        {loadingNone ? "…" : iSaidNone ? "✗ You can't make any of these" : "Can't make any of these"}
      </button>

      {noneMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-muted">Can't make it:</span>
          {noneMembers.map((m) => (
            <span key={m.user_id} className="text-xs font-semibold text-ink-muted bg-black/5 px-2 py-0.5 rounded-full">
              {memberName(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
