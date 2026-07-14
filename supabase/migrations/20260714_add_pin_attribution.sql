-- A1: attribution columns for pins created from social imports.
-- Required by the B0.1 legal guardrail (attribution on any pin created from
-- social content) and rendered in PinPopup ("via TikTok · @author").
-- Nullable — organic pins simply leave them empty. No RLS changes needed:
-- the columns ride the existing pins policies.

alter table public.pins
  add column if not exists source_url      text null,
  add column if not exists source_author   text null,
  add column if not exists source_platform text null check (
    source_platform is null or source_platform in ('tiktok', 'pinterest', 'instagram')
  );
