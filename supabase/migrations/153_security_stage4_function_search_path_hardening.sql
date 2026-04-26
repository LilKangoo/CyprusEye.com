begin;

-- Stage 4 (safe subset): harden app-owned SQL functions with explicit search_path.
-- This uses ALTER FUNCTION only, so it does not overwrite live function bodies,
-- SECURITY DEFINER flags, grants, or trigger behaviour.
-- Extension-owned functions and permissive RLS policies are intentionally left
-- for separate review.

do $$
declare
  target_signature text;
  target_function regprocedure;
begin
  foreach target_signature in array array[
    'public.is_admin()',
    'public.set_updated_at()',
    'public.sync_recommendation_geography()',
    'public.increment_recommendation_views(uuid)',
    'public.increment_recommendation_clicks(uuid)',
    'public.get_recommendations_nearby(numeric,numeric,numeric,integer)',
    'public.trg_poi_categories_set_updated_at()',
    'public.sync_recommendation_category_poi_link()',
    'public.blog_set_updated_at()',
    'public.get_car_image_storage_url(text)',
    'public.cleanup_old_car_image()',
    'public.is_current_user_admin()',
    'public.is_current_user_staff()',
    'public.is_user_banned(uuid)',
    'public.admin_adjust_user_xp(uuid,integer)',
    'public.admin_set_user_xp_level(uuid,integer,integer)',
    'public.admin_update_user_profile(uuid,text,text,integer,integer,boolean)',
    'public.admin_update_user_profile(uuid,text,text,integer,integer,boolean,boolean)',
    'public.admin_set_user_enforcement(uuid,boolean,boolean)',
    'public.admin_get_user_details(uuid)',
    'public.admin_get_reported_content(text,integer,integer)',
    'public.admin_approve_report(uuid)',
    'public.admin_delete_reported_comment(uuid,text)',
    'public.admin_create_poi(text,text,double precision,double precision,text,json)',
    'public.admin_create_poi(text,text,double precision,double precision,text,integer,json)',
    'public.admin_update_poi(uuid,jsonb)',
    'public.admin_update_poi(uuid,text,text,text,json)',
    'public.admin_update_poi(text,text,text,double precision,double precision,text,json)',
    'public.admin_update_poi(text,text,text,double precision,double precision,text,integer,json)',
    'public.admin_delete_poi(uuid,text)',
    'public.admin_delete_poi(text,text)'
  ]
  loop
    target_function := to_regprocedure(target_signature);

    if target_function is not null then
      execute format('alter function %s set search_path = public', target_function);
    end if;
  end loop;
end
$$;

commit;
