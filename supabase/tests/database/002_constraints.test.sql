begin;
select plan(4);
select set_config('app.business_write', 'on', true);

insert into public.organizations (id, name) values ('30000000-1000-4000-8000-000000000001', 'Other Organization');
insert into public.customers (id, organization_id, name, created_by) values (
  '30000000-3000-4000-8000-000000000001',
  '30000000-1000-4000-8000-000000000001',
  'Other Customer',
  '00000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$ insert into public.loans (organization_id, customer_id, account_reference, price_cents, down_payment_cents, original_principal_cents, annual_rate, term_months, first_due_date, created_by)
     values ('00000000-1000-4000-8000-000000000001', '30000000-3000-4000-8000-000000000001', 'CROSS-ORG', 10000, 0, 10000, 7, 12, '2026-08-31', '00000000-0000-4000-8000-000000000001') $$,
  '23503', null, 'cross-organization customer relationship is rejected'
);

select throws_ok(
  $$ insert into public.loans (organization_id, customer_id, account_reference, price_cents, down_payment_cents, original_principal_cents, annual_rate, term_months, first_due_date, created_by)
     values ('00000000-1000-4000-8000-000000000001', '00000000-3000-4000-8000-000000000001', 'NEGATIVE', -1, 0, -1, 7, 12, '2026-08-31', '00000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'invalid monetary ranges are rejected'
);

insert into public.loans (id, organization_id, customer_id, account_reference, price_cents, down_payment_cents, original_principal_cents, annual_rate, term_months, first_due_date, created_by)
values ('30000000-5000-4000-8000-000000000001', '00000000-1000-4000-8000-000000000001', '00000000-3000-4000-8000-000000000001', 'UNIQUE-LOT', 10000, 0, 10000, 7, 12, '2026-08-31', '00000000-0000-4000-8000-000000000001');

select throws_ok(
  $$ insert into public.loans (organization_id, customer_id, account_reference, price_cents, down_payment_cents, original_principal_cents, annual_rate, term_months, first_due_date, created_by)
     values ('00000000-1000-4000-8000-000000000001', '00000000-3000-4000-8000-000000000001', 'unique-lot', 10000, 0, 10000, 7, 12, '2026-08-31', '00000000-0000-4000-8000-000000000001') $$,
  '23505', null, 'active account references are unique without case sensitivity'
);

insert into public.transactions (organization_id, loan_id, type, effective_date, document_number, idempotency_key, created_by)
values ('00000000-1000-4000-8000-000000000001', '30000000-5000-4000-8000-000000000001', 'payment_adjustment', '2026-07-31', 'AJU-999999', '30000000-6000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');

select throws_ok(
  $$ insert into public.transactions (organization_id, loan_id, type, effective_date, document_number, idempotency_key, created_by)
     values ('00000000-1000-4000-8000-000000000001', '30000000-5000-4000-8000-000000000001', 'payment_adjustment', '2026-07-31', 'AJU-999999', '30000000-6000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001') $$,
  '23505', null, 'issued document numbers are unique within the organization'
);

select * from finish();
rollback;
