alter table public.blog_posts
  add column if not exists categories_pl text[] not null default '{}',
  add column if not exists categories_en text[] not null default '{}',
  add column if not exists tags_pl text[] not null default '{}',
  add column if not exists tags_en text[] not null default '{}';

update public.blog_posts
set
  categories_pl = case
    when coalesce(array_length(categories_pl, 1), 0) = 0 then coalesce(categories, '{}')
    else categories_pl
  end,
  categories_en = case
    when coalesce(array_length(categories_en, 1), 0) = 0 then coalesce(categories, '{}')
    else categories_en
  end,
  tags_pl = case
    when coalesce(array_length(tags_pl, 1), 0) = 0 then coalesce(tags, '{}')
    else tags_pl
  end,
  tags_en = case
    when coalesce(array_length(tags_en, 1), 0) = 0 then coalesce(tags, '{}')
    else tags_en
  end;

create index if not exists idx_blog_posts_categories_pl_gin on public.blog_posts using gin(categories_pl);
create index if not exists idx_blog_posts_categories_en_gin on public.blog_posts using gin(categories_en);
create index if not exists idx_blog_posts_tags_pl_gin on public.blog_posts using gin(tags_pl);
create index if not exists idx_blog_posts_tags_en_gin on public.blog_posts using gin(tags_en);
