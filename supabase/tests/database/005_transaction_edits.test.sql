begin;
select plan(20);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'edit-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'edit-operator@example.test', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, display_name, must_change_password) values
  ('50000000-0000-4000-8000-000000000001', 'Edit Owner', false),
  ('50000000-0000-4000-8000-000000000002', 'Edit Operator', false);
insert into public.organizations (id, name) values ('50000000-1000-4000-8000-000000000001', 'Créditos Editables');
insert into public.organization_members (organization_id, user_id, role, active) values
  ('50000000-1000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'owner', true),
  ('50000000-1000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'operator', true);
insert into public.document_counters (organization_id, kind, prefix) values
  ('50000000-1000-4000-8000-000000000001', 'financing', 'EFL'),
  ('50000000-1000-4000-8000-000000000001', 'receipt', 'ERC'),
  ('50000000-1000-4000-8000-000000000001', 'adjustment', 'EAJ');
insert into public.customers (id, organization_id, name, created_by)
values ('50000000-3000-4000-8000-000000000001', '50000000-1000-4000-8000-000000000001', 'Cliente editable', '50000000-0000-4000-8000-000000000001');

set local role service_role;

select lives_ok($$ select public.server_post_loan('50000000-0000-4000-8000-000000000001', $json$
{
  "idempotencyKey":"50000000-4000-4000-8000-000000000001",
  "organizationId":"50000000-1000-4000-8000-000000000001",
  "customerId":"50000000-3000-4000-8000-000000000001",
  "accountReference":"EDIT-FLOW","priceCents":300000,"downPaymentCents":0,"principalCents":300000,
  "annualRate":"12.000000","termMonths":3,"firstDueDate":"2026-08-31","issueDate":"2026-07-31",
  "schedule":[
    {"paymentNumber":1,"dueDate":"2026-08-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":200000},
    {"paymentNumber":2,"dueDate":"2026-09-30","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":100000},
    {"paymentNumber":3,"dueDate":"2026-10-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":0}
  ],
  "snapshot":{"version":1,"calculationVersion":"simple-interest-v2-cents","documentKind":"payment_schedule","issuedAt":"2026-07-31T00:00:00.000Z","organizationName":"Créditos Editables","customerName":"Cliente editable","accountReference":"EDIT-FLOW","payload":{}}
} $json$::jsonb) $$, 'server posts the origination');

select lives_ok($$ select public.server_post_capital_payment('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000002','organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),'expectedLoanVersion',1,
  'transactionMode','standalone','paymentNumber',1,'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-09-30',
  'balanceSource','calculated','capitalPaymentCents',50000,'regularPaymentCents',103000,'currentCapitalCents',200000,
  'newCapitalCents',150000,'originalFutureInterestCents',6000,'newFutureInterestCents',3000,'newScheduledBalanceCents',153000,
  'newMonthlyPaymentCents',76500,'newFinalPaymentCents',76500,'remainingMonths',2,'paymentMethod','Transferencia',
  'paymentReference','EDIT','receivedBy','Owner','notes','',
  'schedule',jsonb_build_array(
    jsonb_build_object('paymentNumber',2,'dueDate','2026-09-30','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',75000),
    jsonb_build_object('paymentNumber',3,'dueDate','2026-10-31','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',0)),
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record','issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, 'server posts the capital payment');

select lives_ok($$ select public.server_post_payment_adjustment('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000003','organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),'expectedLoanVersion',2,'paymentNumber',2,
  'paymentDate','2026-09-30','nextPaymentDate','2026-10-31','scheduledPaymentCents',76500,'receivedPaymentCents',77000,
  'creditBalanceCents',500,'adjustedNextPaymentCents',76000,'paymentReference','EDIT-ADJ','adjustedBy','Owner','notes','',
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record','issuedAt','2026-09-30T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, 'server posts the adjustment');

select throws_ok($$ select public.server_post_payment_adjustment('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000099','organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),'expectedLoanVersion',2,'paymentNumber',2,
  'paymentDate','2026-09-30','nextPaymentDate','2026-10-31','scheduledPaymentCents',76500,'receivedPaymentCents',77000,
  'creditBalanceCents',500,'adjustedNextPaymentCents',76000,'paymentReference','DUPLICATE','adjustedBy','Owner','notes','',
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record','issuedAt','2026-09-30T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, '23505', 'duplicate_adjustment_for_installment', 'the same installment cannot receive two active adjustments');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', true);
select throws_ok($$ select public.edit_transaction('{}'::jsonb) $$, '42501', 'permission denied for function edit_transaction', 'clients cannot invoke edit RPCs directly');
set local role service_role;

select throws_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='ERC-000001'),
  'transactionType','capital_payment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',2
)) $$, 'P0001', 'dependent_transactions_must_be_voided_first', 'historical edits are rejected while later operations are posted');

select lives_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='EAJ-000001'),
  'transactionType','payment_adjustment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',2,
  'paymentNumber',2,'paymentDate','2026-10-05','nextPaymentDate','2026-11-05','scheduledPaymentCents',76500,
  'receivedPaymentCents',77000,'creditBalanceCents',500,'adjustedNextPaymentCents',76000,'paymentReference','EDIT-ADJ',
  'adjustedBy','Owner','notes','Corregido','snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents',
  'documentKind','payment_adjustment_record','issuedAt','2026-10-05T00:00:00.000Z','organizationName','Créditos Editables',
  'customerName','Cliente editable','accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, 'latest adjustment can be corrected');
select is((select next_payment_date::text from public.payment_adjustment_details where transaction_id=(select id from public.transactions where document_number='EAJ-000001')), '2026-11-05', 'adjustment correction is persisted');
select is((select document_number from public.transactions where document_number='EAJ-000001'), 'EAJ-000001', 'editing preserves the document number');
select is((select version from public.loans where account_reference='EDIT-FLOW'), 3, 'editing increments the optimistic version');

select throws_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000002', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='EAJ-000001'),
  'transactionType','payment_adjustment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',3
)) $$, '42501', 'owner_required', 'operators cannot edit posted history through the server');

select lives_ok($$ select public.server_post_payment_adjustment('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000004','organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),'expectedLoanVersion',3,'paymentNumber',3,
  'paymentDate','2026-11-05','nextPaymentDate','2026-12-05','scheduledPaymentCents',76500,'receivedPaymentCents',77000,
  'creditBalanceCents',500,'adjustedNextPaymentCents',76000,'paymentReference','EDIT-ADJ-2','adjustedBy','Owner','notes','',
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record',
    'issuedAt','2026-11-05T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable',
    'accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, 'a later sibling adjustment is posted');
select throws_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='EAJ-000001'),
  'transactionType','payment_adjustment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',3
)) $$, 'P0001', 'dependent_transactions_must_be_voided_first', 'an older sibling operation is no longer editable');
select lives_ok($$ select public.server_void_transaction('50000000-0000-4000-8000-000000000001',
  (select id from public.transactions where document_number='EAJ-000002'), 'Permitir corrección del ajuste anterior') $$,
  'owner voids the later sibling adjustment first');

select lives_ok($$ select public.server_void_transaction('50000000-0000-4000-8000-000000000001',
  (select id from public.transactions where document_number='EAJ-000001'), 'Permitir corrección anterior') $$,
  'owner voids the dependent adjustment first');

select lives_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='ERC-000001'),
  'transactionType','capital_payment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',3,
  'transactionMode','standalone','paymentNumber',1,'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-10-05',
  'balanceSource','calculated','capitalPaymentCents',50000,'regularPaymentCents',103000,'currentCapitalCents',200000,
  'newCapitalCents',150000,'originalFutureInterestCents',6000,'newFutureInterestCents',3000,'newScheduledBalanceCents',153000,
  'newMonthlyPaymentCents',76500,'newFinalPaymentCents',76500,'remainingMonths',2,'paymentMethod','Transferencia',
  'paymentReference','EDIT','receivedBy','Owner','notes','Fecha corregida',
  'schedule',jsonb_build_array(
    jsonb_build_object('paymentNumber',2,'dueDate','2026-10-05','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',75000),
    jsonb_build_object('paymentNumber',3,'dueDate','2026-11-05','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',0)),
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record',
  'issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable',
  'accountReference','EDIT-FLOW','payload','{}'::jsonb)
)) $$, 'capital payment becomes editable after its dependent operation is voided');
select is((select next_payment_date::text from public.capital_payment_details where transaction_id=(select id from public.transactions where document_number='ERC-000001')), '2026-10-05', 'capital correction is persisted');
select is((select version from public.loans where account_reference='EDIT-FLOW'), 4, 'capital correction increments the version');
select throws_ok($$ select public.server_edit_transaction('50000000-0000-4000-8000-000000000001', jsonb_build_object(
  'transactionId',(select id from public.transactions where document_number='EFL-000001'),
  'transactionType','loan_origination','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',4
)) $$, 'P0001', 'dependent_transactions_must_be_voided_first', 'origination remains protected while a later capital payment is posted');
select is((select count(*) from public.audit_events where action='transaction.edited' and organization_id='50000000-1000-4000-8000-000000000001'), 2::bigint, 'every successful edit is audited');

select * from finish();
rollback;
