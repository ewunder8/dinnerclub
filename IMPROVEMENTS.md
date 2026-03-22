# Dinner Club — Review & Improvement Recommendations

> Saved for reference. Based on codebase review.

---

## What's Working Well

- **Domain model** — Clear lifecycle: poll → reserve → RSVP → rate. Pure logic in `lib/poll.ts`, `lib/countdown.ts`, etc.
- **Design system** — Slate & Citrus palette, Syne + Plus Jakarta Sans, dark mode-ready CSS variables.
- **Data layer** — TypeScript types, Supabase, RLS policies.
- **Email flow** — Voting open, reservation confirmed, rating prompt, dinner reminder, invite emails.
- **Manual testing** — `TESTING.md` gives a structured QA checklist.

---

## Bug Fixes & Critical Improvements

### 1. Middleware Cookie Handling

In `middleware.ts`, the `setAll` callback uses `request.cookies.set()`. In Next.js middleware, `request.cookies` is read-only. Supabase expects to set cookies on the **response**. The code does set them on `supabaseResponse`, but the `request.cookies.set` call is incorrect and may cause issues. Verify against the latest Supabase SSR docs; you may only need the response cookie setting.

### 2. Places API Auth

`/api/places/search` is unauthenticated — anyone with the URL can hit it and burn through your Google Places API quota. Add auth checks:

```typescript
// In route.ts — add before search
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ places: [], error: "Unauthorized" }, { status: 401 });
```

### 3. Schema / Type Drift

`database.types.ts` is manually synced and out of date. Missing: `clubs.members_can_invite`, `invite_links.invited_email`, `users.beli_username`, `dietary_restrictions`, `dietary_public`. Run `supabase gen types typescript` after migrations and replace the manual types to eliminate `as any` casts.

---

## Code Quality Improvements

### 4. Remove `as any` Casts

Several places use `as any` (dashboard `invite_links`, club `members_can_invite`, dinner `membership.clubs`). Regenerating types and defining small interfaces for nested selects will remove these.

### 5. Use `Link` Instead of `<a>` for Internal Navigation

You use `<a href="...">` extensively (dashboard, club pages). Switch to `next/link` for internal routes — enables client-side navigation, prefetching, and smoother UX.

### 6. Add Route-Level Loading States

No `loading.tsx` files exist. Add skeletons for key routes:
- `app/dashboard/loading.tsx`
- `app/clubs/[id]/loading.tsx`
- `app/clubs/[id]/dinners/[dinnerId]/loading.tsx`
- `app/discover/loading.tsx`

### 7. Add Segment Error Boundaries

`app/error.tsx` exists for the whole app. Add segment-level `error.tsx` in `dashboard/` and `clubs/[id]/` so a failing section doesn't take down the whole layout.

---

## UX Improvements

### 8. PWA / Installability

Add a web app manifest and service worker so users can "install" Dinner Club on their phones — great for countdown views and reminders.

### 9. Toast Notifications for Actions

Server actions (RSVP, vote, create dinner, etc.) have no feedback. Add a toast library (`sonner`, `react-hot-toast`) for success/error messages.

### 10. Empty States & Microcopy

When there are no upcoming dinners or open polls, add friendly empty states that guide users to create a dinner or invite members.

### 11. Accessibility

- Ensure focus management in modals and after server actions
- Add `aria-label` on icon-only buttons (share, settings)
- Verify heading hierarchy and screen reader flow

---

## New Feature Ideas

### 12. Recurring Dinners

You have `clubs.frequency` — use it to suggest or auto-create recurring dinners (e.g., "first Thursday of the month").

### 13. Dietary Filters in Discover

`users.dietary_restrictions` + `dietary_public` exist. In Discover, filter or highlight restaurants that match members' restrictions (from rating tags, notes).

### 14. "Pick for Me" in Polls

When there are many options, add a "random pick" or "surprise me" for tie-breakers or less decisive groups.

### 15. Dinner Templates

Save theme + neighborhood + price + vibe as reusable templates per club, so starting a new dinner is one click.

### 16. Notification Preferences

Let users toggle which emails they get (voting open, reservation confirmed, rating prompt, reminder) — reduces fatigue for active clubs.

### 17. Push Notifications

Web Push for "dinner tonight" reminders and RSVP updates — especially useful on mobile.

### 18. Shared Photo Album per Dinner

After marking completed, let members upload photos. Store in Supabase Storage, link to `dinner_id`, surface on dinner page and Discover.

### 19. Restaurant Wishlist per Club

A "we should try this place" list separate from a dinner poll — members add suggestions, and you can pull from it when creating polls.

### 20. Calendar Feed / iCal

You have `lib/calendar.ts` for one-off .ics. Consider a per-club or per-user iCal feed URL so upcoming dinners sync to Google/Apple Calendar automatically.

---

## DevOps & Testing

### 21. Add Automated Tests

You have a manual checklist but no unit/integration tests. Start with:
- `lib/poll.ts` (poll state machine)
- `lib/countdown.ts` (urgency labels)
- `lib/utils.ts` (isInviteExpired, etc.)

Add Vitest or Jest. Consider Playwright for a few critical E2E flows (auth, create dinner, RSVP).

### 22. Type Generation Script

Add to `package.json`:

```json
"scripts": {
  "db:types": "supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts"
}
```

Run after schema changes to keep types in sync.

### 23. Environment Validation

Validate env vars at startup with `zod` or similar — fail fast with clear errors instead of cryptic Supabase failures in production.

---

## Priority Summary

| Priority | Item |
|----------|------|
| **P0** | Places API auth, regenerate DB types |
| **P1** | Fix middleware cookie handling, add loading states, use `Link` |
| **P2** | Toast notifications, segment error boundaries |
| **P3** | Dietary filters in Discover, notification preferences |
| **Nice-to-have** | Recurring dinners, shared photos, wishlist, PWA, push notifications |
