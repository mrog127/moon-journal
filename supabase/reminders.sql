-- Moon Journal reminders: run once in Supabase → SQL Editor after schema.sql.
-- (The every-5-minutes schedule is in .reminder-secrets.txt on your Mac, because it contains a secret.)

-- Phones that have turned on reminders
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lat        double precision,
  lng        double precision,
  tz         text,
  prefs      jsonb not null default '{"day": true, "night": true, "journal": true}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "Manage own subscriptions" on public.push_subscriptions;
create policy "Manage own subscriptions" on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- What has been sent, so each reminder goes out once per day. Only the server uses this table.
create table if not exists public.push_log (
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  kind            text not null,
  date            date not null,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, kind, date)
);
alter table public.push_log enable row level security;

-- Scheduling tools
create extension if not exists pg_cron;
create extension if not exists pg_net;
