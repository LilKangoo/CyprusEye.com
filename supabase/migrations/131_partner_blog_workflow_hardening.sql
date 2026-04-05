drop policy if exists blog_posts_partner_insert on public.blog_posts;
create policy blog_posts_partner_insert
  on public.blog_posts
  for insert
  to authenticated
  with check (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and submission_status in ('draft', 'pending')
    and status in ('draft', 'archived')
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
  );

drop policy if exists blog_posts_partner_update on public.blog_posts;
create policy blog_posts_partner_update
  on public.blog_posts
  for update
  to authenticated
  using (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and submission_status in ('draft', 'pending', 'rejected')
    and status in ('draft', 'archived')
  )
  with check (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and submission_status in ('draft', 'pending')
    and status in ('draft', 'archived')
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
  );

drop policy if exists blog_posts_partner_delete on public.blog_posts;
create policy blog_posts_partner_delete
  on public.blog_posts
  for delete
  to authenticated
  using (
    owner_partner_id is not null
    and public.can_manage_partner_blog(owner_partner_id)
    and submission_status in ('draft', 'pending', 'rejected')
    and status in ('draft', 'archived')
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
        and p.submission_status in ('draft', 'pending')
        and p.status in ('draft', 'archived')
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
        and p.submission_status in ('draft', 'pending', 'rejected')
        and p.status in ('draft', 'archived')
    )
  )
  with check (
    exists (
      select 1
      from public.blog_posts p
      where p.id = blog_post_translations.blog_post_id
        and p.owner_partner_id is not null
        and public.can_manage_partner_blog(p.owner_partner_id)
        and p.submission_status in ('draft', 'pending')
        and p.status in ('draft', 'archived')
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
        and p.submission_status in ('draft', 'pending', 'rejected')
        and p.status in ('draft', 'archived')
    )
  );
