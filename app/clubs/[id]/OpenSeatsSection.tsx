"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { postOpenSeat, requestSeat, respondToSeatRequest } from "./open-seats-actions";

type Request = {
  id: string;
  user_id: string;
  status: "pending" | "confirmed" | "declined";
  user_name: string;
};

type OpenSeat = {
  id: string;
  club_id: string;
  created_by: string;
  restaurant_name: string;
  place_id: string | null;
  reservation_datetime: string;
  seats_available: number;
  note: string | null;
  status: "open" | "closed";
  created_at: string;
  poster_name: string;
  requests: Request[];
};

type Props = {
  clubId: string;
  userId: string;
  openSeats: OpenSeat[];
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function PostForm({ clubId, onPosted }: { clubId: string; onPosted: () => void }) {
  const [restaurantName, setRestaurantName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!restaurantName.trim() || !date || !time) {
      setError("Please fill in restaurant, date, and time.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const reservation_datetime = new Date(`${date}T${time}`).toISOString();
    const result = await postOpenSeat({
      clubId,
      restaurantName: restaurantName.trim(),
      reservationDatetime: reservation_datetime,
      seatsAvailable: seats,
      note: note.trim() || null,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    toast.success("Open seat posted!");
    setRestaurantName(""); setDate(""); setTime(""); setSeats(1); setNote("");
    onPosted();
  };

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
      <input
        type="text"
        placeholder="Restaurant name"
        value={restaurantName}
        onChange={(e) => setRestaurantName(e.target.value)}
        className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-slate transition-colors text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-slate transition-colors text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-muted shrink-0">Seats available</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSeats((s) => Math.max(1, s - 1))}
            className="w-8 h-8 rounded-full border border-black/10 text-ink-muted hover:bg-surface flex items-center justify-center text-lg leading-none"
          >−</button>
          <span className="text-ink font-semibold w-4 text-center">{seats}</span>
          <button
            onClick={() => setSeats((s) => s + 1)}
            className="w-8 h-8 rounded-full border border-black/10 text-ink-muted hover:bg-surface flex items-center justify-center text-lg leading-none"
          >+</button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Any details? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        className="w-full bg-surface border border-slate/20 rounded-xl px-4 py-3 text-ink placeholder-ink-faint focus:outline-none focus:border-slate transition-colors text-sm"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-slate text-white font-bold py-3 rounded-xl hover:bg-slate-light transition-colors disabled:opacity-40 text-sm"
      >
        {submitting ? "Posting…" : "Post open seat →"}
      </button>
    </div>
  );
}

function SeatCard({ seat, userId }: { seat: OpenSeat; userId: string }) {
  const router = useRouter();
  const isOwner = seat.created_by === userId;
  const myRequest = seat.requests.find((r) => r.user_id === userId);
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    const result = await requestSeat({ seatId: seat.id });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Request sent!");
      router.refresh();
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!myRequest) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("open_seat_requests").delete().eq("id", myRequest.id);
    toast.success("Request withdrawn.");
    router.refresh();
    setLoading(false);
  };

  const handleRespondRequest = async (requestId: string, newStatus: "confirmed" | "declined") => {
    const result = await respondToSeatRequest({ requestId, newStatus });
    if (result.error) { toast.error(result.error); return; }
    if (newStatus === "confirmed") toast.success("Request confirmed!");
    else toast.success("Request declined.");
    router.refresh();
  };

  const handleClose = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("open_seats").update({ status: "closed" }).eq("id", seat.id);
    toast.success("Seat closed.");
    router.refresh();
    setLoading(false);
  };

  const confirmedCount = seat.requests.filter((r) => r.status === "confirmed").length;
  const pendingRequests = seat.requests.filter((r) => r.status === "pending");

  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm truncate">{seat.restaurant_name}</p>
          <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(seat.reservation_datetime)}</p>
          <p className="text-xs text-ink-muted">
            {seat.seats_available} seat{seat.seats_available !== 1 ? "s" : ""} · Posted by {seat.poster_name}
            {confirmedCount > 0 && ` · ${confirmedCount} confirmed`}
          </p>
          {seat.note && (
            <p className="text-xs text-ink-muted italic mt-1">&ldquo;{seat.note}&rdquo;</p>
          )}
        </div>
        {seat.status === "open" && (
          isOwner ? (
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-xs text-ink-muted hover:text-red-500 transition-colors shrink-0 mt-0.5 disabled:opacity-40"
            >
              Close
            </button>
          ) : myRequest ? (
            <span className={`text-xs font-semibold shrink-0 mt-0.5 ${
              myRequest.status === "confirmed" ? "text-green-600" :
              myRequest.status === "declined" ? "text-red-500" : "text-ink-muted"
            }`}>
              {myRequest.status === "confirmed" ? "Confirmed!" :
               myRequest.status === "declined" ? "Declined" : "Requested"}
            </span>
          ) : (
            <button
              onClick={handleRequest}
              disabled={loading}
              className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors shrink-0 mt-0.5 disabled:opacity-40"
            >
              I&apos;m in →
            </button>
          )
        )}
        {seat.status === "closed" && (
          <span className="text-xs text-ink-faint shrink-0 mt-0.5">Closed</span>
        )}
      </div>

      {/* Poster sees pending requests */}
      {isOwner && pendingRequests.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1 pl-0">
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-ink">{req.user_name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespondRequest(req.id, "confirmed")}
                  className="text-xs font-semibold text-green-600 hover:text-green-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleRespondRequest(req.id, "declined")}
                  className="text-xs text-ink-muted hover:text-red-500 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requester can withdraw pending */}
      {myRequest?.status === "pending" && (
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="text-xs text-ink-muted hover:text-red-500 transition-colors self-start disabled:opacity-40"
        >
          Withdraw request
        </button>
      )}
    </div>
  );
}

export default function OpenSeatsSection({ clubId, userId, openSeats }: Props) {
  const router = useRouter();
  const [showPost, setShowPost] = useState(false);

  const activeSeats = openSeats.filter((s) => s.status === "open");
  const closedSeats = openSeats.filter((s) => s.status === "closed");
  const displaySeats = [...activeSeats, ...closedSeats].slice(0, 10);

  return (
    <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-ink-muted uppercase tracking-widest">
            Open Seats{activeSeats.length > 0 ? ` · ${activeSeats.length}` : ""}
          </h3>
          <p className="text-xs text-ink-faint mt-0.5">Spare reservations members can request</p>
        </div>
        <button
          onClick={() => setShowPost((v) => !v)}
          className="text-xs font-semibold text-citrus-dark hover:text-citrus transition-colors"
        >
          {showPost ? "Cancel" : "+ Post seat"}
        </button>
      </div>

      {displaySeats.length === 0 && !showPost ? (
        <div className="px-5 py-10 text-center">
          <p className="text-3xl mb-3">🪑</p>
          <p className="font-semibold text-ink text-sm mb-1">No open seats</p>
          <p className="text-xs text-ink-muted mb-4">Got a reservation with room? Post it here so club members can request a spot.</p>
          <p className="text-xs text-ink-faint max-w-xs mx-auto leading-relaxed">Open Seats lets members share spare reservations — post how many seats you have, and your club can request one. You confirm or decline.</p>
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {displaySeats.map((seat) => (
            <SeatCard key={seat.id} seat={seat} userId={userId} />
          ))}
        </div>
      )}

      {showPost && (
        <div className="px-5 pb-5">
          <PostForm
            clubId={clubId}
            onPosted={() => { setShowPost(false); router.refresh(); }}
          />
        </div>
      )}
    </section>
  );
}
