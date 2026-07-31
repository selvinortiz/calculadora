begin;

select plan(33);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_members', 'organization_members exists');
select has_table('public', 'document_counters', 'document_counters exists');
select has_table('public', 'customers', 'customers exists');
select has_table('public', 'loans', 'loans exists');
select has_table('public', 'schedule_versions', 'schedule_versions exists');
select has_table('public', 'installments', 'installments exists');
select has_table('public', 'transactions', 'transactions exists');
select has_table('public', 'capital_payment_details', 'capital details exists');
select has_table('public', 'payment_adjustment_details', 'adjustment details exists');
select has_table('public', 'documents', 'documents exists');
select has_table('public', 'audit_events', 'audit events exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-one@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'operator-one@example.test', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-two@example.test', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, display_name, must_change_password) values
  ('10000000-0000-4000-8000-000000000001', 'Owner One', false),
  ('10000000-0000-4000-8000-000000000002', 'Operator One', false),
  ('20000000-0000-4000-8000-000000000001', 'Owner Two', false);
insert into public.organizations (id, name) values
  ('10000000-1000-4000-8000-000000000001', 'Organization One'),
  ('20000000-2000-4000-8000-000000000001', 'Organization Two');
insert into public.organization_members (organization_id, user_id, role, active) values
  ('10000000-1000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', true),
  ('10000000-1000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'operator', true),
  ('20000000-2000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', true);
insert into public.document_counters (organization_id, kind, prefix) values
  ('10000000-1000-4000-8000-000000000001', 'financing', 'FIN'),
  ('10000000-1000-4000-8000-000000000001', 'receipt', 'REC'),
  ('10000000-1000-4000-8000-000000000001', 'adjustment', 'AJU'),
  ('20000000-2000-4000-8000-000000000001', 'financing', 'DOS'),
  ('20000000-2000-4000-8000-000000000001', 'receipt', 'REC2'),
  ('20000000-2000-4000-8000-000000000001', 'adjustment', 'AJU2');
insert into public.customers (id, organization_id, name, created_by) values
  ('10000000-3000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', 'Customer One', '10000000-0000-4000-8000-000000000001'),
  ('20000000-3000-4000-8000-000000000001', '20000000-2000-4000-8000-000000000001', 'Customer Two', '20000000-0000-4000-8000-000000000001');

select ok(private.is_active_member('10000000-1000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'), 'operator is active member');
select ok(not private.is_owner('10000000-1000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'), 'operator is not owner');
select ok(private.is_owner('10000000-1000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'), 'owner is owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$ select name from public.customers order by name $$,
  $$ values ('Customer One'::text) $$,
  'RLS hides cross-organization customers'
);
select results_eq(
  $$ select name from public.organizations order by name $$,
  $$ values ('Organization One'::text) $$,
  'RLS hides cross-organization settings'
);

select lives_ok(
  $$ select public.post_loan($json$
  {
    "idempotencyKey":"10000000-4000-4000-8000-000000000001",
    "organizationId":"10000000-1000-4000-8000-000000000001",
    "customerId":"10000000-3000-4000-8000-000000000001",
    "accountReference":"LOT-ONE",
    "priceCents":120000,
    "downPaymentCents":20000,
    "principalCents":100000,
    "annualRate":"12.000000",
    "termMonths":2,
    "firstDueDate":"2026-08-31",
    "issueDate":"2026-07-31",
    "schedule":[
      {"paymentNumber":1,"dueDate":"2026-08-31","principalCents":50000,"interestCents":1000,"paymentCents":51000,"remainingPrincipalCents":50000},
      {"paymentNumber":2,"dueDate":"2026-09-30","principalCents":50000,"interestCents":1000,"paymentCents":51000,"remainingPrincipalCents":0}
    ],
    "snapshot":{"version":1,"calculationVersion":"simple-interest-v2-cents","documentKind":"payment_schedule","issuedAt":"2026-07-31T00:00:00.000Z","organizationName":"Organization One","customerName":"Customer One","accountReference":"LOT-ONE","payload":{}}
  }
  $json$::jsonb) $$,
  'operator can post a loan atomically'
);
select is((select count(*) from public.loans where account_reference = 'LOT-ONE'), 1::bigint, 'loan was created');
select is((select count(*) from public.installments), 2::bigint, 'schedule rows were created');
select is((select document_number from public.transactions where type = 'loan_origination'), 'FIN-000001', 'first number allocated');
select is((select snapshot->>'documentNumber' from public.documents limit 1), 'FIN-000001', 'issued number is frozen in snapshot');

select lives_ok(
  $$ select public.post_loan($json$
  {"idempotencyKey":"10000000-4000-4000-8000-000000000001","organizationId":"10000000-1000-4000-8000-000000000001"}
  $json$::jsonb) $$,
  'idempotent retry returns the original posting before validating duplicate command fields'
);
select is((select count(*) from public.transactions), 1::bigint, 'idempotent retry created no duplicate transaction');
select throws_ok(
  $$ select public.post_loan(jsonb_build_object(
       'idempotencyKey', '10000000-4000-4000-8000-000000000099',
       'organizationId', '10000000-1000-4000-8000-000000000001',
       'customerId', '10000000-3000-4000-8000-000000000001',
       'accountReference', 'lot-one',
       'priceCents', 120000, 'downPaymentCents', 20000, 'principalCents', 100000,
       'annualRate', '12.000000', 'termMonths', 2,
       'firstDueDate', '2026-08-31', 'issueDate', '2026-07-31',
       'schedule', '[]'::jsonb, 'snapshot', '{}'::jsonb
     )) $$,
  '23505', null,
  'a failed posting rolls back the whole RPC'
);
select throws_ok(
  $$ select public.post_loan($json$
  {
    "idempotencyKey":"10000000-4000-4000-8000-000000000098",
    "organizationId":"10000000-1000-4000-8000-000000000001",
    "customerId":"10000000-3000-4000-8000-000000000001",
    "accountReference":"INVALID-SCHEDULE",
    "priceCents":120000,"downPaymentCents":20000,"principalCents":100000,
    "annualRate":"12.000000","termMonths":2,
    "firstDueDate":"2026-08-31","issueDate":"2026-07-31",
    "schedule":[
      {"paymentNumber":1,"dueDate":"2026-08-31","principalCents":50000,"interestCents":1000,"paymentCents":51000,"remainingPrincipalCents":99999},
      {"paymentNumber":2,"dueDate":"2026-09-30","principalCents":50000,"interestCents":1000,"paymentCents":51000,"remainingPrincipalCents":0}
    ],
    "snapshot":{"version":1,"calculationVersion":"simple-interest-v2-cents","payload":{}}
  }
  $json$::jsonb) $$,
  '23514','schedule_does_not_reconcile',
  'posting rejects a schedule that does not reconcile cent by cent'
);
select is((select next_value from public.document_counters where organization_id = '10000000-1000-4000-8000-000000000001' and kind = 'financing'), 2::bigint, 'retries and rolled-back postings consume no number');

select results_eq(
  $$ with changed as (
       update public.organizations set name = 'Operator Must Not Change This'
       where id = '10000000-1000-4000-8000-000000000001' returning 1
     ) select count(*)::bigint from changed $$,
  $$ values (0::bigint) $$,
  'operator cannot change organization settings'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$ with changed as (
       update public.organizations set name = 'Owner Updated Organization'
       where id = '10000000-1000-4000-8000-000000000001' returning 1
     ) select count(*)::bigint from changed $$,
  $$ values (1::bigint) $$,
  'owner can change organization settings'
);

reset role;
update public.organization_members set active = false
where organization_id = '10000000-1000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.customers), 0::bigint, 'inactive users see no business data');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select count(*) from public.customers $$,
  '42501',
  'permission denied for table customers',
  'anonymous cannot read customer data'
);
select throws_ok(
  $$ select public.post_loan('{}'::jsonb) $$,
  '42501',
  'permission denied for function post_loan',
  'anonymous cannot execute posting RPC'
);

select * from finish();
rollback;
