# Dinner Creation & Planning Flow — Implementation Docs

## 1. Dinner Creation

### `app/clubs/[id]/dinners/new/page.tsx`
Server component that gates on club membership, then renders `CreateDinnerForm`. Returns 404 if user isn't a member.

### `app/clubs/[id]/dinners/new/CreateDinnerForm.tsx`
Client component. Two distinct paths based on dinner type:

- **Club dinner** (`club_id` set): supports up to 3 proposed dates, creates an `availability_polls` record + `availability_poll_dates`, sets `planning_stage: "date_voting"`, `voting_open: false`. Navigates to `/clubs/{id}/dinners/{dinnerId}`.
- **One-off dinner**: single date only, skips date voting, sets `planning_stage: "restaurant_voting"`, `voting_open: true`, generates an invite link token (30-day expiry). Navigates to `/dinners/{dinnerId}`.

Optional fields (vibe, neighborhood) are hidden behind a toggle. Validation is client-side only — no server-side date or field validation.

---

## 2. Dinner Detail Page — Status Branching

### `app/clubs/[id]/dinners/[dinnerId]/page.tsx`

The page branches in this priority order:

| Condition | Rendered View |
|---|---|
| `planning_stage` in `{date_voting, restaurant_voting, winner}` | `DinnerPlanningView` |
| `status === "confirmed"` | `CountdownView` |
| `status === "completed"` | `RatingsForm` |
| `status === "seeking_reservation"` | `ReservationAttempts` + `ConfirmReservationForm` |
| `status === "waitlisted"` | Waitlist banner + `ReservationAttempts` |
| `status === "cancelled"` | Cancellation message |
| fallback | Full poll view (options, voting, `SuggestRestaurant`) |

One side-effect on load: if `voting_open=true` and `poll_closes_at` is in the past, the page immediately writes `voting_open=false` to the database before rendering.

---

## 3. Planning Flow Components

### `DinnerPlanningView.tsx`
Orchestrates the 3-stage UI. Contains a `StageTracker` (dots: done/active/pending) and delegates to stage-specific panels.

- **Stage 1 (date_voting):** `DateVotingPanel` — members vote yes/maybe/no per date; creator locks one to advance.
- **Stage 2 (restaurant_voting):** `RestaurantVotingPanel` — members suggest/vote; creator picks winner.
- **Stage 3 (winner/seeking_reservation):** `RsvpPanel` — reservation tracking and RSVPs.

### `PollOptionCard.tsx`
Individual restaurant card. Handles vote toggle (delete old + insert new), soft removal (sets `removed_at`), Beli URL editing (validates `beliapp.co` domain), winner badge, tie label, and "Pick winner" button for owners.

### `OwnerControls.tsx`
Shows "Open voting" (when `ready_to_open`), "Close voting" (when `voting_open`), and always "Cancel dinner".

### `SuggestRestaurant.tsx`
Search input with 400ms debounce → `/api/places/search?q=&city=`. Upserts to `restaurant_cache`, then inserts `poll_options`. Shows wishlist quick-add buttons. Detects duplicates.

### `CountdownView.tsx`
Confirmed dinner view. Countdown with urgency levels (far/soon/imminent/past). RSVP buttons. Share (native API / WhatsApp fallback) and calendar (Google Calendar / .ics download) buttons.

### `RatingsForm.tsx`
Post-dinner ratings, 7-day window enforced client and server-side via `ratings_open_until`. Overall score required; food/vibe/value optional. Group verdict summary shown after submission.

### `ConfirmReservationForm.tsx`
Reservation details entry: datetime-local (browser timezone → ISO), party size, platform (Resy/OpenTable/Tock/Other), optional confirmation number.

### `ReservationAttempts.tsx`
Tracks who's trying to book. States: attempting → waitlisted → succeeded. "No luck" on waitlist calls `giveUpWaitlist()`, which reverts the dinner to `restaurant_voting` if no one is left waitlisted.

---

## 4. Server Actions

### `app/clubs/[id]/dinners/[dinnerId]/actions.ts`

| Action | What it does |
|---|---|
| `updateDinnerDetails` | Updates theme fields, `target_date`, `poll_closes_at` |
| `confirmReservation` | Sets `status: "confirmed"` + reservation details; fires confirmation emails |
| `openVoting` | Sets `voting_open: true`; fires voting-open emails |
| `markCompleted` | Sets `status: "completed"`, `ratings_open_until = now + 7 days`; fires rating-prompt emails |
| `voteDate` | Guards on `planning_stage === "date_voting"`; upserts `availability_responses` |
| `noneOfTheAbove` | Deletes all user responses for poll, inserts `none_of_the_above: true` |
| `lockDate` | Creator-only; sets `target_date`, advances `planning_stage` to `restaurant_voting`, closes availability poll; fires emails |
| `lockRestaurant` | Creator-only; sets `winning_restaurant_place_id`, advances to `winner`, sets `status: "seeking_reservation"`; fires emails |
| `setWaitlisted` | Sets dinner + attempt to `waitlisted` |
| `giveUpWaitlist` | Marks attempt `abandoned`; if no one left waitlisted, reverts dinner to `seeking_reservation`/`restaurant_voting`, reopens voting, clears winner |
| `rsvpDinner` | Upserts `rsvps` record |
| `cancelDinner` | Sets `status: "cancelled"`; fires cancellation emails |

All email helpers use fire-and-forget (`Promise.allSettled`), filter by per-user `email_notifications` JSON preferences, and include unsubscribe URLs.

---

## 5. Poll State Machine

### `lib/poll.ts`

`getPollState(dinner, activeOptionCount)` → `"needs_suggestions" | "ready_to_open" | "voting_open" | "voting_closed" | "winner_selected"`

Priority: winner → voting deadline passed (closed) → voting open → enough options (ready) → needs suggestions.

`rankOptions(options, totalVoters)` — sorts by vote count, adds `vote_pct`, `rank`, `is_tied`. Tie detection requires `topVotes > 0` and 2+ options sharing the top count.

`canSuggest()` checks `suggestion_mode` and `max_suggestions`. `canRemoveSuggestion()` is owner-only before voting opens.

---

## 6. Relevant Database Schema

### `dinners`
`status` (polling/seeking_reservation/waitlisted/confirmed/completed/cancelled), `planning_stage` (date_voting/restaurant_voting/winner), `voting_open`, `target_date`, `winning_restaurant_place_id`, `suggestion_mode` (owner_only/members/hybrid), `max_suggestions`, `poll_min_options`, `theme_*` fields, `reservation_datetime`, `party_size`, `reservation_platform`, `reserved_by`, `ratings_open_until`, `created_by`.

### `availability_polls`
`club_id`, `dinner_id` (FK), `status` (open/closed). Up to 3 dates via `availability_poll_dates`. Responses in `availability_responses` with `available` (yes/maybe/no) and `none_of_the_above` bool.

### `poll_options`
`dinner_id`, `place_id`, `suggested_by`, `note`, `removed_by`/`removed_at` (soft delete — never hard delete). Active options = `WHERE removed_at IS NULL`.

### `votes`
`option_id`, `user_id`, `dinner_id`. One vote per user per dinner; implemented as delete + insert (not upsert).

### `rsvps`
`dinner_id`, `user_id`, `status` (going/not_going/maybe). Used during confirmed/countdown phase.

### `reservation_attempts`
`dinner_id`, `user_id`, `status` (attempting/waitlisted/succeeded/abandoned).

---

## 7. Known Issues & TODOs

- `// TODO: send email` markers exist at several trigger points where notifications haven't been wired yet
- Date validation in `CreateDinnerForm` is client-side only; no server-side guard
- `ConfirmReservationForm` defaults party size to 4 rather than using RSVP count
- No real-time vote updates — page refresh required to see new votes
- `suggestion_mode: "hybrid"` is poorly explained in the creation UI
