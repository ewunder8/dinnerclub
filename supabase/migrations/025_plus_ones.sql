-- Migration 025: plus ones support
-- Adds per-dinner plus-ones setting and per-RSVP plus-ones count

ALTER TABLE dinners
  ADD COLUMN plus_ones_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN plus_ones_max int DEFAULT NULL;

ALTER TABLE rsvps
  ADD COLUMN plus_ones int NOT NULL DEFAULT 0;
