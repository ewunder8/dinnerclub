-- ============================================================
-- Migration 006 — Unique constraint on reservation_attempts
-- One row per (dinner_id, user_id); app uses upsert to toggle.
-- ============================================================

-- Remove any duplicate rows, keeping the most recently updated one
delete from public.reservation_attempts a
using public.reservation_attempts b
where a.dinner_id = b.dinner_id
  and a.user_id   = b.user_id
  and a.updated_at < b.updated_at;

-- Add unique constraint
alter table public.reservation_attempts
  add constraint reservation_attempts_dinner_user_unique
  unique (dinner_id, user_id);
