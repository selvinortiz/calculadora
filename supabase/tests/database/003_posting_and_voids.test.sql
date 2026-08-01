begin;
select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'void-owner@example.test', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, display_name, must_change_password)
values ('30000000-0000-4000-8000-000000000001', 'Void Owner', false);
insert into public.organizations (id, name)
values ('30000000-1000-4000-8000-000000000001', 'Créditos Local');
insert into public.organization_members (organization_id, user_id, role, active)
values ('30000000-1000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'owner', true);
insert into public.document_counters (organization_id, kind, prefix) values
  ('30000000-1000-4000-8000-000000000001', 'financing', 'TFL'),
  ('30000000-1000-4000-8000-000000000001', 'receipt', 'TRC'),
  ('30000000-1000-4000-8000-000000000001', 'adjustment', 'TAJ');
insert into public.customers (id, organization_id, name, created_by)
values ('30000000-3000-4000-8000-000000000001', '30000000-1000-4000-8000-000000000001', 'Cliente de ejemplo', '30000000-0000-4000-8000-000000000001');

set local role service_role;

select lives_ok(
  $$ select public.server_post_loan('30000000-0000-4000-8000-000000000001', $json$
  {
    "idempotencyKey":"70000000-0000-4000-8000-000000000001",
    "organizationId":"30000000-1000-4000-8000-000000000001",
    "customerId":"30000000-3000-4000-8000-000000000001",
    "accountReference":"VOID-FLOW",
    "priceCents":300000,"downPaymentCents":0,"principalCents":300000,
    "annualRate":"12.000000","termMonths":3,
    "firstDueDate":"2026-08-31","issueDate":"2026-07-31",
    "schedule":[
      {"paymentNumber":1,"dueDate":"2026-08-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":200000},
      {"paymentNumber":2,"dueDate":"2026-09-30","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":100000},
      {"paymentNumber":3,"dueDate":"2026-10-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":0}
    ],
    "snapshot":{"version":1,"calculationVersion":"simple-interest-v2-cents","documentKind":"payment_schedule","issuedAt":"2026-07-31T00:00:00.000Z","organizationName":"Créditos Local","customerName":"Cliente de ejemplo","accountReference":"VOID-FLOW","payload":{}}
  }
  $json$::jsonb) $$,
  'posts an origination'
);

select throws_ok(
  $$ select public.server_update_customer(
    '30000000-0000-4000-8000-000000000001',
    '30000000-1000-4000-8000-000000000001',
    '30000000-3000-4000-8000-000000000001', true
  ) $$,
  'P0001', 'active_loans_prevent_customer_archive',
  'customers with active financing cannot be archived'
);

select lives_ok(
  $$ select public.server_post_capital_payment('30000000-0000-4000-8000-000000000001', jsonb_build_object(
    'idempotencyKey','70000000-0000-4000-8000-000000000002',
    'organizationId','30000000-1000-4000-8000-000000000001',
    'loanId',(select id from public.loans where account_reference='VOID-FLOW'),
    'expectedLoanVersion',1,'transactionMode','standalone','paymentNumber',1,
    'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-09-30',
    'balanceSource','calculated','capitalPaymentCents',50000,'regularPaymentCents',103000,
    'currentCapitalCents',200000,'newCapitalCents',150000,'originalFutureInterestCents',6000,
    'newFutureInterestCents',3000,'newScheduledBalanceCents',153000,
    'newMonthlyPaymentCents',76500,'newFinalPaymentCents',76500,'remainingMonths',2,
    'paymentMethod','Transferencia','paymentReference','FLOW','receivedBy','Owner','notes','',
    'schedule',jsonb_build_array(
      jsonb_build_object('paymentNumber',2,'dueDate','2026-09-30','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',75000),
      jsonb_build_object('paymentNumber',3,'dueDate','2026-10-31','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',0)
    ),
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record','issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Local','customerName','Cliente de ejemplo','accountReference','VOID-FLOW','payload','{}'::jsonb)
  )) $$,
  'posts a capital payment and revised schedule'
);

select lives_ok(
  $$ select public.server_post_payment_adjustment('30000000-0000-4000-8000-000000000001', jsonb_build_object(
    'idempotencyKey','70000000-0000-4000-8000-000000000003',
    'organizationId','30000000-1000-4000-8000-000000000001',
    'loanId',(select id from public.loans where account_reference='VOID-FLOW'),
    'expectedLoanVersion',2,'paymentNumber',2,'paymentDate','2026-09-30','nextPaymentDate','2026-10-31',
    'scheduledPaymentCents',76500,'receivedPaymentCents',77000,'creditBalanceCents',500,'adjustedNextPaymentCents',76000,
    'paymentReference','FLOW-ADJ','adjustedBy','Owner','notes','',
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record','issuedAt','2026-09-30T00:00:00.000Z','organizationName','Créditos Local','customerName','Cliente de ejemplo','accountReference','VOID-FLOW','payload','{}'::jsonb)
  )) $$,
  'posts a one-installment adjustment without changing the schedule'
);

select throws_ok(
  $$ select public.server_void_transaction('30000000-0000-4000-8000-000000000001', (select id from public.transactions where document_number='TRC-000001'), 'Out of order') $$,
  'P0001','dependent_transactions_must_be_voided_first',
  'cannot void a capital payment while an adjustment depends on it'
);
select lives_ok(
  $$ select public.server_void_transaction('30000000-0000-4000-8000-000000000001', (select id from public.transactions where document_number='TAJ-000001'), 'Reverse order') $$,
  'voids the dependent adjustment first'
);
select lives_ok(
  $$ select public.server_void_transaction('30000000-0000-4000-8000-000000000001', (select id from public.transactions where document_number='TRC-000001'), 'Restore prior schedule') $$,
  'then voids the capital payment'
);
select is(
  (select transaction.type from public.loans loan join public.schedule_versions schedule on schedule.id=loan.current_schedule_version_id join public.transactions transaction on transaction.id=schedule.source_transaction_id where loan.account_reference='VOID-FLOW'),
  'loan_origination','restores the prior schedule version'
);
select is((select version from public.loans where account_reference='VOID-FLOW'),3,'voiding a schedule change increments the optimistic version');
select is((select count(*) from public.transactions where document_number in ('TRC-000001','TAJ-000001') and status='voided'),2::bigint,'historical transactions remain and are marked voided');

select lives_ok(
  $$ select public.server_post_capital_payment('30000000-0000-4000-8000-000000000001', jsonb_build_object(
    'idempotencyKey','70000000-0000-4000-8000-000000000004',
    'organizationId','30000000-1000-4000-8000-000000000001',
    'loanId',(select id from public.loans where account_reference='VOID-FLOW'),
    'expectedLoanVersion',3,'transactionMode','standalone','paymentNumber',1,
    'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-09-30',
    'balanceSource','calculated','capitalPaymentCents',40000,'regularPaymentCents',103000,
    'currentCapitalCents',200000,'newCapitalCents',160000,'originalFutureInterestCents',6000,
    'newFutureInterestCents',3200,'newScheduledBalanceCents',163200,
    'newMonthlyPaymentCents',81600,'newFinalPaymentCents',81600,'remainingMonths',2,
    'paymentMethod','Transferencia','paymentReference','REPLACEMENT','receivedBy','Owner','notes','',
    'replacesTransactionId',(select id from public.transactions where document_number='TRC-000001'),
    'schedule',jsonb_build_array(
      jsonb_build_object('paymentNumber',2,'dueDate','2026-09-30','principalCents',80000,'interestCents',1600,'paymentCents',81600,'remainingPrincipalCents',80000),
      jsonb_build_object('paymentNumber',3,'dueDate','2026-10-31','principalCents',80000,'interestCents',1600,'paymentCents',81600,'remainingPrincipalCents',0)
    ),
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record','issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Local','customerName','Cliente de ejemplo','accountReference','VOID-FLOW','payload','{}'::jsonb)
  )) $$,
  'owner posts an explicit replacement'
);
select is((select document_number from public.transactions where idempotency_key='70000000-0000-4000-8000-000000000004'),'TRC-000002','voided numbers are never reused');
select is((select replaced.document_number from public.transactions replacement join public.transactions replaced on replaced.id=replacement.replaces_transaction_id where replacement.document_number='TRC-000002'),'TRC-000001','replacement relationship is retained');
select is((select snapshot->>'documentNumber' from public.documents document join public.transactions transaction on transaction.id=document.transaction_id where transaction.document_number='TRC-000001'),'TRC-000001','voiding does not alter the historical snapshot');
select lives_ok(
  $$ select public.server_update_organization_settings(
    '30000000-0000-4000-8000-000000000001',
    '30000000-1000-4000-8000-000000000001',
    'Renamed Later', '',
    '{"financing":"TFL","receipt":"TRC","adjustment":"TAJ"}'::jsonb
  ) $$,
  'owner changes future organization settings'
);
select is((select snapshot->>'organizationName' from public.documents document join public.transactions transaction on transaction.id=document.transaction_id where transaction.document_number='TFL-000001'),'Créditos Local','later settings do not alter issued snapshots');

select * from finish();
rollback;
