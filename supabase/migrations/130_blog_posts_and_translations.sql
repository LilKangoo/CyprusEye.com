create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.partners') is not null then
    alter table public.partners
      add column if not exists can_manage_blog boolean not null default false,
      add column if not exists can_auto_publish_blog boolean not null default false;
  end if;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  submission_status text not null default 'draft'
    check (submission_status in ('draft', 'pending', 'approved', 'rejected')),
  published_at timestamptz null,
  cover_image_url text null,
  cover_image_alt jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  allow_comments boolean not null default false,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  cta_services jsonb not null default '[]'::jsonb,
  author_profile_id uuid null references public.profiles(id) on delete set null,
  owner_partner_id uuid null references public.partners(id) on delete set null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  rejection_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_cover_image_alt_is_object
    check (jsonb_typeof(cover_image_alt) = 'object'),
  constraint blog_posts_cta_services_is_array
    check (jsonb_typeof(cta_services) = 'array'),
  constraint blog_posts_cta_services_max_3
    check (
      case
        when jsonb_typeof(cta_services) = 'array' then jsonb_array_length(cta_services) <= 3
        else false
      end
    )
);

create table if not exists public.blog_post_translations (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  lang text not null check (lang in ('pl', 'en')),
  slug text not null
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  meta_title text null,
  meta_description text not null,
  summary text not null,
  lead text null,
  author_name text null,
  author_url text null,
  content_json jsonb not null default jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array()
  ),
  content_html text not null default '',
  og_image_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_post_translations_content_json_is_object
    check (jsonb_typeof(content_json) = 'object'),
  unique (blog_post_id, lang),
  unique (lang, slug)
);

comment on table public.blog_posts is 'Base blog records shared across all languages.';
comment on table public.blog_post_translations is 'Per-language blog post content, SEO fields, and slugs.';

comment on column public.blog_posts.cover_image_alt is 'Localized image alt copy, eg. {"pl":"...", "en":"..."}';
comment on column public.blog_posts.cta_services is 'JSON array up to 3 items: [{"type":"hotels","resource_id":"uuid"}].';
comment on column public.blog_posts.author_profile_id is 'Optional fallback author profile used when translation-level author_name is empty.';
comment on column public.blog_posts.owner_partner_id is 'Partner owner for partner-submitted blog content.';
comment on column public.blog_posts.submission_status is 'Moderation state for admin approval workflow, separate from publish status.';
comment on column public.blog_post_translations.content_json is 'TipTap JSON document stored as the editor source of truth.';
comment on column public.blog_post_translations.content_html is 'Sanitized rendered HTML version for public delivery and SEO.';
comment on column public.blog_post_translations.author_name is 'Optional public author label override per language.';
comment on column public.blog_post_translations.author_url is 'Optional public author link override per language.';
comment on column public.partners.can_manage_blog is 'Allows partner users to create and manage their own blog posts.';
comment on column public.partners.can_auto_publish_blog is 'Allows partner users to auto-approve and publish their own blog posts.';

create index if not exists idx_blog_posts_status
  on public.blog_posts(status);

create index if not exists idx_blog_posts_submission_status
  on public.blog_posts(submission_status);

create index if not exists idx_blog_posts_published_at
  on public.blog_posts(published_at desc);

create index if not exists idx_blog_posts_featured
  on public.blog_posts(featured);

create index if not exists idx_blog_posts_author_profile_id
  on public.blog_posts(author_profile_id);

create index if not exists idx_blog_posts_owner_partner_id
  on public.blog_posts(owner_partner_id);

create index if not exists idx_blog_posts_categories_gin
  on public.blog_posts using gin(categories);

create index if not exists idx_blog_posts_tags_gin
  on public.blog_posts using gin(tags);

create index if not exists idx_blog_posts_cta_services_gin
  on public.blog_posts using gin(cta_services jsonb_path_ops);

create index if not exists idx_blog_post_translations_blog_post_id
  on public.blog_post_translations(blog_post_id);

create index if not exists idx_blog_post_translations_lang_slug
  on public.blog_post_translations(lang, slug);

create or replace function public.blog_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.can_manage_partner_blog(p_partner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.partners p
    where p.id = p_partner_id
      and p.can_manage_blog = true
      and public.is_partner_user(p.id)
  );
end;
$$;

create or replace function public.can_auto_publish_partner_blog(p_partner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.partners p
    where p.id = p_partner_id
      and p.can_manage_blog = true
      and p.can_auto_publish_blog = true
      and public.is_partner_user(p.id)
  );
end;
$$;

drop trigger if exists trg_blog_posts_set_updated_at on public.blog_posts;
create trigger trg_blog_posts_set_updated_at
before update on public.blog_posts
for each row
execute function public.blog_set_updated_at();

drop trigger if exists trg_blog_post_translations_set_updated_at on public.blog_post_translations;
create trigger trg_blog_post_translations_set_updated_at
before update on public.blog_post_translations
for each row
execute function public.blog_set_updated_at();

alter table public.blog_posts enable row level security;
alter table public.blog_post_translations enable row level security;

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read
  on public.blog_posts
  for select
  to anon, authenticated
  using (
    status = 'published'
    and submission_status = 'approved'
    and published_at is not null
    and published_at <= now()
  );

drop policy if exists blog_posts_staff_manage on public.blog_posts;
create policy blog_posts_staff_manage
  on public.blog_posts
  for all
  to authenticated
  using (public.is_current_user_staff())
  with check (public.is_current_user_staff());

drop policy if exists blog_posts_partner_read on public.blog_posts;
create policy blog_posts_partner_read
  on public.blog_posts
  for select
  to authenticated
  using (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
  );

drop policy if exists blog_posts_partner_insert on public.blog_posts;
create policy blog_posts_partner_insert
  on public.blog_posts
  for insert
  to authenticated
  with check (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and case
      when public.can_auto_publish_partner_blog(owner_partner_id) then true
      else submission_status in ('draft', 'pending', 'rejected')
        and status <> 'published'
    end
  );

drop policy if exists blog_posts_partner_update on public.blog_posts;
create policy blog_posts_partner_update
  on public.blog_posts
  for update
  to authenticated
  using (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and (
      public.can_auto_publish_partner_blog(owner_partner_id)
      or (submission_status <> 'approved' and status <> 'published')
    )
  )
  with check (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and case
      when public.can_auto_publish_partner_blog(owner_partner_id) then true
      else submission_status in ('draft', 'pending', 'rejected')
        and status <> 'published'
    end
  );

drop policy if exists blog_posts_partner_delete on public.blog_posts;
create policy blog_posts_partner_delete
  on public.blog_posts
  for delete
  to authenticated
  using (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and (
      public.can_auto_publish_partner_blog(owner_partner_id)
      or (submission_status <> 'approved' and status <> 'published')
    )
  );

drop policy if exists blog_post_translations_public_read on public.blog_post_translations;
create policy blog_post_translations_public_read
  on public.blog_post_translations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.status = 'published'
        and p.submission_status = 'approved'
        and p.published_at is not null
        and p.published_at <= now()
    )
  );

drop policy if exists blog_post_translations_staff_manage on public.blog_post_translations;
create policy blog_post_translations_staff_manage
  on public.blog_post_translations
  for all
  to authenticated
  using (public.is_current_user_staff())
  with check (public.is_current_user_staff());

drop policy if exists blog_post_translations_partner_read on public.blog_post_translations;
create policy blog_post_translations_partner_read
  on public.blog_post_translations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
    )
  );

drop policy if exists blog_post_translations_partner_insert on public.blog_post_translations;
create policy blog_post_translations_partner_insert
  on public.blog_post_translations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
        and (
          public.can_auto_publish_partner_blog(p.owner_partner_id)
          or (p.submission_status <> 'approved' and p.status <> 'published')
        )
    )
  );

drop policy if exists blog_post_translations_partner_update on public.blog_post_translations;
create policy blog_post_translations_partner_update
  on public.blog_post_translations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
        and (
          public.can_auto_publish_partner_blog(p.owner_partner_id)
          or (p.submission_status <> 'approved' and p.status <> 'published')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
        and (
          public.can_auto_publish_partner_blog(p.owner_partner_id)
          or (p.submission_status <> 'approved' and p.status <> 'published')
        )
    )
  );

drop policy if exists blog_post_translations_partner_delete on public.blog_post_translations;
create policy blog_post_translations_partner_delete
  on public.blog_post_translations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
        and (
          public.can_auto_publish_partner_blog(p.owner_partner_id)
          or (p.submission_status <> 'approved' and p.status <> 'published')
        )
    )
  );

grant select on public.blog_posts to anon, authenticated;
grant select on public.blog_post_translations to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;
grant insert, update, delete on public.blog_post_translations to authenticated;
