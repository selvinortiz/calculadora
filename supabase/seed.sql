-- Local-development identity. Hosted production migrations do not apply this
-- seed unless explicitly requested.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@local.test',
  extensions.crypt('Local-demo-12345', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Propietario Local"}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"owner@local.test","email_verified":true}',
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, display_name, must_change_password)
values ('00000000-0000-4000-8000-000000000001', 'Propietario Local', false)
on conflict (id) do nothing;

insert into public.organizations (id, name, default_recipient)
values ('00000000-1000-4000-8000-000000000001', 'Créditos Local', 'Propietario Local')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, active)
values ('00000000-1000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner', true)
on conflict (organization_id, user_id) do nothing;

insert into public.document_counters (organization_id, kind, prefix, next_value)
values
  ('00000000-1000-4000-8000-000000000001', 'financing', 'FIN', 1),
  ('00000000-1000-4000-8000-000000000001', 'receipt', 'REC', 1),
  ('00000000-1000-4000-8000-000000000001', 'adjustment', 'AJU', 1)
on conflict (organization_id, kind) do nothing;

insert into public.customers (id, organization_id, name, phone, email, created_by)
values (
  '00000000-3000-4000-8000-000000000001',
  '00000000-1000-4000-8000-000000000001',
  'Cliente de ejemplo', '5555-0101', 'cliente@local.test',
  '00000000-0000-4000-8000-000000000001'
) on conflict (id) do nothing;
