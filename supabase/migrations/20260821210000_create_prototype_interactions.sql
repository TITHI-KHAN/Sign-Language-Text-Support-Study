create table if not exists public.prototype_interactions (
  event_id uuid primary key,
  participant_id text not null
    check (participant_id ~ '^[a-z0-9_-]{1,64}$'),
  session_id uuid not null,
  sequence integer not null check (sequence between 1 and 100000),
  action text not null check (char_length(action) between 1 and 80),
  feature text not null default '' check (char_length(feature) <= 80),
  value text not null default '' check (char_length(value) <= 500),
  target_type text not null default '' check (char_length(target_type) <= 80),
  target_value text not null default '' check (char_length(target_value) <= 1000),
  segment_start text not null default '' check (char_length(segment_start) <= 40),
  segment_end text not null default '' check (char_length(segment_end) <= 40),
  video_time double precision,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  state jsonb not null default '{}'::jsonb
);

create index if not exists prototype_interactions_participant_sequence_idx
  on public.prototype_interactions (participant_id, session_id, sequence);

alter table public.prototype_interactions enable row level security;

revoke all on table public.prototype_interactions from anon, authenticated;
