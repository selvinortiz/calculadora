create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant update (display_name, updated_at) on public.profiles to authenticated;

create or replace function public.update_my_profile(
  target_display_name text,
  target_organization_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_membership public.organization_members%rowtype;
  clean_display_name text := pg_catalog.btrim(target_display_name);
  clean_organization_name text;
  organization_changed boolean := false;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if clean_display_name is null or pg_catalog.char_length(clean_display_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;

  select membership.*
  into current_membership
  from public.organization_members membership
  where membership.user_id = current_user_id
    and membership.active
  limit 1;

  if current_membership.user_id is null then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;

  update public.profiles
  set display_name = clean_display_name,
      updated_at = pg_catalog.now()
  where id = current_user_id;

  perform public.record_audit_event(
    current_membership.organization_id,
    'profile.updated',
    'profile',
    current_user_id::text,
    '{}'::jsonb
  );

  if target_organization_name is not null then
    if current_membership.role <> 'owner' then
      raise exception using errcode = '42501', message = 'owner_required';
    end if;

    clean_organization_name := pg_catalog.btrim(target_organization_name);
    if pg_catalog.char_length(clean_organization_name) not between 1 and 100 then
      raise exception using errcode = '22023', message = 'invalid_organization_name';
    end if;

    update public.organizations
    set name = clean_organization_name,
        updated_at = pg_catalog.now()
    where id = current_membership.organization_id
      and name is distinct from clean_organization_name;

    organization_changed := found;
    if organization_changed then
      perform public.record_audit_event(
        current_membership.organization_id,
        'settings.updated',
        'organization',
        current_membership.organization_id::text,
        '{"field":"name"}'::jsonb
      );
    end if;
  else
    select organization.name
    into clean_organization_name
    from public.organizations organization
    where organization.id = current_membership.organization_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'displayName', clean_display_name,
    'organizationName', clean_organization_name,
    'organizationChanged', organization_changed
  );
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
