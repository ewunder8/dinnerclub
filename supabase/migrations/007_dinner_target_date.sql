-- ============================================================
-- Migration 007 — Add target_date to dinners
-- Rough intended date/time for the dinner, set at poll creation.
-- ============================================================

alter table public.dinners
  add column target_date timestamptz;
