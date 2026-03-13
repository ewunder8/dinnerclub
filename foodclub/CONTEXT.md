# Food Club — AI Context

Paste this file at the start of any Cursor or Claude conversation for better suggestions.

## What is Food Club?

A web app for friend groups to organize dinner outings together. Core loop:
1. Club members vote on where to eat (poll)
2. Someone grabs a reservation (coordination)
3. Everyone RSVPs and adds to calendar
4. After dinner, everyone rates the restaurant (builds taste profile)

## Key Product Decisions

- **Invite-only clubs** — no public discovery of clubs, friends only
- **Invite links expire in 7 days** — regeneratable by any member
- **Anyone can try to get a reservation** — first to confirm wins, tracked via reservation_attempts table
- **Restaurant data from Google Places** — cached locally for 48 hours
- **No reservation API integration** — deep links to Resy/OpenTable app only
- **Post-dinner ratings** are the data flywheel for Discover recommendations

## Tech Stack

- Next.js 14 App Router + TypeScript
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS with custom Food Club design tokens
- Google Places API (server-side, cached)
- Google Maps JavaScript API (client-side)
- Hosted on Vercel

## Design Tokens (Tailwind)

- `clay` / `clay-light` / `clay-dark` — primary orange-red brand color
- `forest` / `forest-light` — secondary green
- `cream` — warm off-white
- `warm-white` — page background
- `charcoal` — dark backgrounds, nav
- `gold` — ratings, stars
- `mid` — secondary text

## Database Tables

users, clubs, club_members, invite_links, dinners, reservation_attempts,
poll_options, votes, rsvps, restaurant_cache, dinner_ratings

Full types in: lib/supabase/database.types.ts
Full schema in: supabase/migrations/001_initial_schema.sql

## File Conventions

- Server components fetch data directly via lib/supabase/server.ts
- Client components use lib/supabase/client.ts
- All Google Places calls go through lib/places.ts (handles caching)
- Always use the `cn()` utility from lib/utils.ts for className merging
