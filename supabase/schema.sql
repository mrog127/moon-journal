-- Moon Journal: run this once in Supabase → SQL Editor → New query → Run.

-- 1. Journal entries, one row per person per day
create table if not exists public.entries (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  text       text not null default '',
  photos     jsonb not null default '[]'::jsonb,   -- [{ id, path, addedAt }]
  moon       jsonb,                                -- moon data saved with the entry
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.entries enable row level security;

drop policy if exists "Read own entries"   on public.entries;
drop policy if exists "Add own entries"    on public.entries;
drop policy if exists "Update own entries" on public.entries;
drop policy if exists "Delete own entries" on public.entries;

create policy "Read own entries"   on public.entries for select to authenticated using (auth.uid() = user_id);
create policy "Add own entries"    on public.entries for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own entries" on public.entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own entries" on public.entries for delete to authenticated using (auth.uid() = user_id);

-- 2. Private photo storage. Files live at photos/<user id>/<date>/<photo id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Read own photos"   on storage.objects;
drop policy if exists "Upload own photos" on storage.objects;
drop policy if exists "Delete own photos" on storage.objects;

create policy "Read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
