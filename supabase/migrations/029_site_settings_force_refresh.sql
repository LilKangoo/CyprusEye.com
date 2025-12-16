create table if not exists public.site_settings (
  id int primary key,
  force_refresh_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

insert into public.site_settings (id, force_refresh_version)
values (1, 0)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Site settings read" on public.site_settings;
create policy "Site settings read"
  on public.site_settings for select
  using (true);

drop policy if exists "Site settings admin write" on public.site_settings;
create policy "Site settings admin write"
  on public.site_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

drop policy if exists "Site settings admin insert" on public.site_settings;
create policy "Site settings admin insert"
  on public.site_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;
