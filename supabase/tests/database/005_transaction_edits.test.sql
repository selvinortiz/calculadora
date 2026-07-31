begin;
select plan(16);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'edit-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'edit-operator@example.test', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, display_name, must_change_password) values
  ('50000000-0000-4000-8000-000000000001', 'Edit Owner', false),
  ('50000000-0000-4000-8000-000000000002', 'Edit Operator', false);
insert into public.organizations (id, name)
values ('50000000-1000-4000-8000-000000000001', 'Créditos Editables');
insert into public.organization_members (organization_id, user_id, role, active) values
  ('50000000-1000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'owner', true),
  ('50000000-1000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'operator', true);
insert into public.document_counters (organization_id, kind, prefix) values
  ('50000000-1000-4000-8000-000000000001', 'financing', 'EFL'),
  ('50000000-1000-4000-8000-000000000001', 'receipt', 'ERC'),
  ('50000000-1000-4000-8000-000000000001', 'adjustment', 'EAJ');
insert into public.customers (id, organization_id, name, created_by)
values ('50000000-3000-4000-8000-000000000001', '50000000-1000-4000-8000-000000000001', 'Cliente editable', '50000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', true);

select public.post_loan($json$
{
  "idempotencyKey":"50000000-4000-4000-8000-000000000001",
  "organizationId":"50000000-1000-4000-8000-000000000001",
  "customerId":"50000000-3000-4000-8000-000000000001",
  "accountReference":"EDIT-FLOW",
  "priceCents":300000,"downPaymentCents":0,"principalCents":300000,
  "annualRate":"12.000000","termMonths":3,
  "firstDueDate":"2026-08-31","issueDate":"2026-07-31",
  "schedule":[
    {"paymentNumber":1,"dueDate":"2026-08-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":200000},
    {"paymentNumber":2,"dueDate":"2026-09-30","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":100000},
    {"paymentNumber":3,"dueDate":"2026-10-31","principalCents":100000,"interestCents":3000,"paymentCents":103000,"remainingPrincipalCents":0}
  ],
  "snapshot":{"version":1,"calculationVersion":"simple-interest-v2-cents","documentKind":"payment_schedule","issuedAt":"2026-07-31T00:00:00.000Z","organizationName":"Créditos Editables","customerName":"Cliente editable","accountReference":"EDIT-FLOW","payload":{"firstDueDate":"2026-08-31"}}
}
$json$::jsonb);

select public.post_capital_payment(jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000002',
  'organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),
  'expectedLoanVersion',1,'transactionMode','standalone','paymentNumber',1,
  'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-09-30',
  'balanceSource','calculated','capitalPaymentCents',50000,'regularPaymentCents',103000,
  'currentCapitalCents',200000,'newCapitalCents',150000,'originalFutureInterestCents',6000,
  'newFutureInterestCents',3000,'newScheduledBalanceCents',153000,
  'newMonthlyPaymentCents',76500,'newFinalPaymentCents',76500,'remainingMonths',2,
  'paymentMethod','Transferencia','paymentReference','EDIT','receivedBy','Owner','notes','',
  'schedule',jsonb_build_array(
    jsonb_build_object('paymentNumber',2,'dueDate','2026-09-30','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',75000),
    jsonb_build_object('paymentNumber',3,'dueDate','2026-10-31','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',0)
  ),
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record','issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload',jsonb_build_object('details',jsonb_build_object('nextPaymentDate','2026-09-30')))
));

select public.post_payment_adjustment(jsonb_build_object(
  'idempotencyKey','50000000-4000-4000-8000-000000000003',
  'organizationId','50000000-1000-4000-8000-000000000001',
  'loanId',(select id from public.loans where account_reference='EDIT-FLOW'),
  'expectedLoanVersion',2,'paymentNumber',2,'paymentDate','2026-09-30','nextPaymentDate','2026-10-31',
  'scheduledPaymentCents',76500,'receivedPaymentCents',77000,'creditBalanceCents',500,'adjustedNextPaymentCents',76000,
  'paymentReference','EDIT-ADJ','adjustedBy','Owner','notes','',
  'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record','issuedAt','2026-09-30T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload',jsonb_build_object('nextPaymentDate','2026-10-31'))
));

select lives_ok(
  $$ select public.edit_transaction(jsonb_build_object(
    'transactionId',(select id from public.transactions where document_number='ERC-000001'),
    'transactionType','capital_payment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',2,
    'transactionMode','standalone','paymentNumber',1,'transactionDate','2026-08-31','lastPaymentDate','2026-08-31','nextPaymentDate','2026-10-05',
    'balanceSource','calculated','capitalPaymentCents',50000,'regularPaymentCents',103000,'currentCapitalCents',200000,'newCapitalCents',150000,
    'originalFutureInterestCents',6000,'newFutureInterestCents',3000,'newScheduledBalanceCents',153000,
    'newMonthlyPaymentCents',76500,'newFinalPaymentCents',76500,'remainingMonths',2,
    'paymentMethod','Depósito bancario','paymentReference','EDIT','receivedBy','Owner','notes','Fecha corregida',
    'schedule',jsonb_build_array(
      jsonb_build_object('paymentNumber',2,'dueDate','2026-10-05','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',75000),
      jsonb_build_object('paymentNumber',3,'dueDate','2026-11-05','principalCents',75000,'interestCents',1500,'paymentCents',76500,'remainingPrincipalCents',0)
    ),
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','capital_payment_record','issuedAt','2026-08-31T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload',jsonb_build_object('details',jsonb_build_object('nextPaymentDate','2026-10-05')))
  )) $$,
  'owner edits the capital payment in place'
);
select is((select next_payment_date::text from public.capital_payment_details details join public.transactions transaction on transaction.id=details.transaction_id where transaction.document_number='ERC-000001'),'2026-10-05','capital-payment details use the corrected date');
select is((select first_due_date::text from public.schedule_versions schedule join public.transactions transaction on transaction.id=schedule.source_transaction_id where transaction.document_number='ERC-000001'),'2026-10-05','revised schedule starts on the corrected date');
select is((select min(due_date)::text from public.installments installment join public.schedule_versions schedule on schedule.id=installment.schedule_version_id join public.transactions transaction on transaction.id=schedule.source_transaction_id where transaction.document_number='ERC-000001'),'2026-10-05','installment dates are regenerated');
select is((select snapshot#>>'{payload,details,nextPaymentDate}' from public.documents document join public.transactions transaction on transaction.id=document.transaction_id where transaction.document_number='ERC-000001'),'2026-10-05','reprinted document uses the correction');
select is((select document_number from public.transactions where document_number='ERC-000001'),'ERC-000001','editing preserves the document number');
select is((select version from public.loans where account_reference='EDIT-FLOW'),3,'editing increments the optimistic loan version');

select throws_ok(
  $$ select public.edit_transaction(jsonb_build_object(
    'transactionId',(select id from public.transactions where document_number='ERC-000001'),
    'transactionType','capital_payment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',2
  )) $$,
  'P0001','loan_version_conflict','stale edits are rejected before any write'
);

select lives_ok(
  $$ select public.edit_transaction(jsonb_build_object(
    'transactionId',(select id from public.transactions where document_number='EAJ-000001'),
    'transactionType','payment_adjustment','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',3,
    'paymentNumber',2,'paymentDate','2026-10-05','nextPaymentDate','2026-11-05',
    'scheduledPaymentCents',76500,'receivedPaymentCents',77000,'creditBalanceCents',500,'adjustedNextPaymentCents',76000,
    'paymentReference','EDIT-ADJ','adjustedBy','Owner','notes','Corregido',
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_adjustment_record','issuedAt','2026-10-05T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW','payload',jsonb_build_object('nextPaymentDate','2026-11-05'))
  )) $$,
  'owner edits the adjustment in place'
);
select is((select next_payment_date::text from public.payment_adjustment_details details join public.transactions transaction on transaction.id=details.transaction_id where transaction.document_number='EAJ-000001'),'2026-11-05','adjustment details use the correction');
select is((select effective_date::text from public.transactions where document_number='EAJ-000001'),'2026-10-05','the adjustment timeline date is corrected');

select lives_ok(
  $$ select public.edit_transaction(jsonb_build_object(
    'transactionId',(select id from public.transactions where document_number='EFL-000001'),
    'transactionType','loan_origination','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',4,
    'accountReference','EDIT-FLOW-CORRECTED','priceCents',310000,'downPaymentCents',10000,'principalCents',300000,
    'annualRate','12.000000','termMonths',3,'firstDueDate','2026-09-05','issueDate','2026-08-01',
    'schedule',jsonb_build_array(
      jsonb_build_object('paymentNumber',1,'dueDate','2026-09-05','principalCents',100000,'interestCents',3000,'paymentCents',103000,'remainingPrincipalCents',200000),
      jsonb_build_object('paymentNumber',2,'dueDate','2026-10-05','principalCents',100000,'interestCents',3000,'paymentCents',103000,'remainingPrincipalCents',100000),
      jsonb_build_object('paymentNumber',3,'dueDate','2026-11-05','principalCents',100000,'interestCents',3000,'paymentCents',103000,'remainingPrincipalCents',0)
    ),
    'snapshot',jsonb_build_object('version',1,'calculationVersion','simple-interest-v2-cents','documentKind','payment_schedule','issuedAt','2026-08-01T00:00:00.000Z','organizationName','Créditos Editables','customerName','Cliente editable','accountReference','EDIT-FLOW-CORRECTED','payload',jsonb_build_object('firstDueDate','2026-09-05'))
  )) $$,
  'owner edits original loan terms even when later history exists'
);
select is((select account_reference from public.loans where id=(select loan_id from public.transactions where document_number='EFL-000001')),'EDIT-FLOW-CORRECTED','loan terms are corrected in place');
select is((select snapshot->>'accountReference' from public.documents document join public.transactions transaction on transaction.id=document.transaction_id where transaction.document_number='EFL-000001'),'EDIT-FLOW-CORRECTED','the financing document is regenerated');
reset role;
select is((select count(*) from public.audit_events where action='transaction.edited' and organization_id='50000000-1000-4000-8000-000000000001'),3::bigint,'every edit is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select public.edit_transaction(jsonb_build_object(
    'transactionId',(select id from public.transactions where document_number='EFL-000001'),
    'transactionType','loan_origination','organizationId','50000000-1000-4000-8000-000000000001','expectedLoanVersion',5
  )) $$,
  '42501','owner_required','operators cannot edit posted history'
);

select * from finish();
rollback;
