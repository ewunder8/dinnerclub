-- Add types array to restaurant_cache for Google Places cuisine/category data
alter table public.restaurant_cache
  add column if not exists types text[];
