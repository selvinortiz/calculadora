begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-operator@example.test', '', now(), '{}', '{}', now(), now()),
  ('40000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'profile-inactive@example.test', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, display_name, must_change_password) values
  ('40000000-0000-4000-8000-000000000001', 'Profile Owner', false),
  ('40000000-0000-4000-8000-000000000002', 'Profile Operator', false),
  ('40000000-0000-4000-8000-000000000003', 'Profile Inactive', false);

insert into public.organizations (id, name)
values ('40000000-1000-4000-8000-000000000001', 'Profile Organization');

insert into public.organization_members (organization_id, user_id, role, active) values
  ('40000000-1000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'owner', true),
  ('40000000-1000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'operator', true),
  ('40000000-1000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'operator', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);

select lives_ok(
  $$ select public.update_my_profile('Operator Updated', null) $$,
  'operator can update their own name'
);
select is(
  (select display_name from public.profiles where id = '40000000-0000-4000-8000-000000000002'),
  'Operator Updated',
  'the operator profile is updated'
);
select throws_ok(
  $$ select public.update_my_profile('Operator Updated', 'Forbidden Company') $$,
  '42501',
  'owner_required',
  'operator cannot update the organization name'
);
select is(
  (select name from public.organizations where id = '40000000-1000-4000-8000-000000000001'),
  'Profile Organization',
  'failed organization update leaves its name unchanged'
);
select throws_ok(
  $$ select public.update_my_profile('', null) $$,
  '22023',
  'invalid_display_name',
  'blank display names are rejected'
);

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.update_my_profile('Owner Updated', 'Company Updated') $$,
  'owner can update their profile and organization'
);
select is(
  (select display_name from public.profiles where id = '40000000-0000-4000-8000-000000000001'),
  'Owner Updated',
  'the owner profile is updated'
);
select is(
  (select name from public.organizations where id = '40000000-1000-4000-8000-000000000001'),
  'Company Updated',
  'the organization name is updated'
);
reset role;
select is(
  (select count(*) from public.audit_events where action = 'profile.updated'),
  2::bigint,
  'profile changes are audited'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$ select public.update_my_profile('Inactive Updated', null) $$,
  '42501',
  'active_membership_required',
  'inactive users cannot update profiles'
);

select * from finish();
rollback;
