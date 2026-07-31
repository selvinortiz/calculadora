create or replace function private.guard_business_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.editing', true), '') <> 'on' then
    raise exception using errcode = '42501', message = 'business_records_are_immutable';
  end if;
  if coalesce(current_setting('app.business_write', true), '') <> 'on'
     and coalesce(current_setting('app.voiding', true), '') <> 'on'
     and coalesce(current_setting('app.editing', true), '') <> 'on' then
    raise exception using errcode = '42501', message = 'business_write_function_required';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.edit_transaction(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id_value uuid := (command->>'organizationId')::uuid;
  transaction_id_value uuid := (command->>'transactionId')::uuid;
  expected_loan_version integer := (command->>'expectedLoanVersion')::integer;
  target public.transactions%rowtype;
  locked_loan public.loans%rowtype;
  target_schedule public.schedule_versions%rowtype;
  schedule_row jsonb;
  interest_total bigint;
  regular_payment bigint;
  final_payment bigint;
  before_state jsonb;
  after_state jsonb := command - 'schedule' - 'snapshot';
  next_loan_version integer;
begin
  select * into target
  from public.transactions
  where id = transaction_id_value and organization_id = organization_id_value
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'transaction_not_found';
  end if;
  if not private.is_owner(organization_id_value) then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;
  if target.status <> 'posted' then
    raise exception using errcode = 'P0001', message = 'posted_transaction_required';
  end if;
  if coalesce(command->>'transactionType', '') <> target.type then
    raise exception using errcode = 'P0001', message = 'transaction_type_mismatch';
  end if;

  select * into locked_loan
  from public.loans
  where id = target.loan_id and organization_id = organization_id_value and status = 'active'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'loan_not_found';
  end if;
  if locked_loan.version <> expected_loan_version then
    raise exception using errcode = 'P0001', message = 'loan_version_conflict';
  end if;

  perform pg_catalog.set_config('app.editing', 'on', true);

  if target.type = 'loan_origination' then
    select * into target_schedule
    from public.schedule_versions
    where source_transaction_id = target.id;

    before_state := jsonb_build_object(
      'effectiveDate', target.effective_date,
      'accountReference', locked_loan.account_reference,
      'priceCents', locked_loan.price_cents,
      'downPaymentCents', locked_loan.down_payment_cents,
      'principalCents', locked_loan.original_principal_cents,
      'annualRate', locked_loan.annual_rate,
      'termMonths', locked_loan.term_months,
      'firstDueDate', locked_loan.first_due_date
    );

    update public.loans
    set account_reference = trim(command->>'accountReference'),
      price_cents = (command->>'priceCents')::bigint,
      down_payment_cents = (command->>'downPaymentCents')::bigint,
      original_principal_cents = (command->>'principalCents')::bigint,
      annual_rate = (command->>'annualRate')::numeric,
      term_months = (command->>'termMonths')::integer,
      first_due_date = (command->>'firstDueDate')::date
    where id = locked_loan.id;

    update public.transactions
    set effective_date = (command->>'issueDate')::date
    where id = target.id;

    select coalesce(sum((item.value->>'interestCents')::bigint), 0),
      coalesce((command->'schedule'->0->>'paymentCents')::bigint, 0),
      coalesce((command->'schedule'->-1->>'paymentCents')::bigint, 0)
    into interest_total, regular_payment, final_payment
    from jsonb_array_elements(command->'schedule') as item(value);

    update public.schedule_versions
    set calculation_version = command->'snapshot'->>'calculationVersion',
      effective_after_payment = 0,
      first_payment_number = 1,
      first_due_date = (command->>'firstDueDate')::date,
      principal_cents = (command->>'principalCents')::bigint,
      future_interest_cents = interest_total,
      remaining_months = (command->>'termMonths')::integer,
      regular_payment_cents = regular_payment,
      final_payment_cents = final_payment
    where id = target_schedule.id;

  elsif target.type = 'capital_payment' then
    select * into target_schedule
    from public.schedule_versions
    where source_transaction_id = target.id;

    select jsonb_build_object(
      'effectiveDate', target.effective_date,
      'details', to_jsonb(details) - 'organization_id'
    ) into before_state
    from public.capital_payment_details details
    where details.transaction_id = target.id;

    update public.transactions
    set effective_date = (command->>'transactionDate')::date
    where id = target.id;

    update public.capital_payment_details
    set transaction_mode = command->>'transactionMode',
      payment_number = (command->>'paymentNumber')::integer,
      last_payment_date = nullif(command->>'lastPaymentDate', '')::date,
      next_payment_date = (command->>'nextPaymentDate')::date,
      balance_source = command->>'balanceSource',
      capital_payment_cents = (command->>'capitalPaymentCents')::bigint,
      regular_payment_cents = (command->>'regularPaymentCents')::bigint,
      current_capital_cents = (command->>'currentCapitalCents')::bigint,
      new_capital_cents = (command->>'newCapitalCents')::bigint,
      original_future_interest_cents = (command->>'originalFutureInterestCents')::bigint,
      new_future_interest_cents = (command->>'newFutureInterestCents')::bigint,
      new_scheduled_balance_cents = (command->>'newScheduledBalanceCents')::bigint,
      payment_method = coalesce(command->>'paymentMethod', ''),
      payment_reference = coalesce(command->>'paymentReference', ''),
      received_by = coalesce(command->>'receivedBy', ''),
      notes = coalesce(command->>'notes', '')
    where transaction_id = target.id;

    update public.schedule_versions
    set calculation_version = command->'snapshot'->>'calculationVersion',
      effective_after_payment = (command->>'paymentNumber')::integer,
      first_payment_number = (command->>'paymentNumber')::integer + 1,
      first_due_date = (command->>'nextPaymentDate')::date,
      principal_cents = (command->>'newCapitalCents')::bigint,
      future_interest_cents = (command->>'newFutureInterestCents')::bigint,
      remaining_months = (command->>'remainingMonths')::integer,
      regular_payment_cents = (command->>'newMonthlyPaymentCents')::bigint,
      final_payment_cents = (command->>'newFinalPaymentCents')::bigint
    where id = target_schedule.id;

  else
    select jsonb_build_object(
      'effectiveDate', target.effective_date,
      'details', to_jsonb(details) - 'organization_id'
    ) into before_state
    from public.payment_adjustment_details details
    where details.transaction_id = target.id;

    update public.transactions
    set effective_date = (command->>'paymentDate')::date
    where id = target.id;

    update public.payment_adjustment_details
    set payment_number = (command->>'paymentNumber')::integer,
      payment_date = (command->>'paymentDate')::date,
      next_payment_date = (command->>'nextPaymentDate')::date,
      scheduled_payment_cents = (command->>'scheduledPaymentCents')::bigint,
      received_payment_cents = (command->>'receivedPaymentCents')::bigint,
      credit_balance_cents = (command->>'creditBalanceCents')::bigint,
      adjusted_next_payment_cents = (command->>'adjustedNextPaymentCents')::bigint,
      payment_reference = coalesce(command->>'paymentReference', ''),
      adjusted_by = coalesce(command->>'adjustedBy', ''),
      notes = coalesce(command->>'notes', '')
    where transaction_id = target.id;
  end if;

  if target.type in ('loan_origination', 'capital_payment') then
    delete from public.installments where schedule_version_id = target_schedule.id;

    for schedule_row in select value from jsonb_array_elements(command->'schedule')
    loop
      insert into public.installments (
        organization_id, schedule_version_id, payment_number, due_date, principal_cents,
        interest_cents, payment_cents, remaining_principal_cents
      ) values (
        organization_id_value, target_schedule.id,
        (schedule_row->>'paymentNumber')::integer, (schedule_row->>'dueDate')::date,
        (schedule_row->>'principalCents')::bigint, (schedule_row->>'interestCents')::bigint,
        (schedule_row->>'paymentCents')::bigint,
        (schedule_row->>'remainingPrincipalCents')::bigint
      );
    end loop;

    perform private.assert_schedule_reconciles(target_schedule.id);
  end if;

  update public.documents
  set snapshot_version = (command->'snapshot'->>'version')::integer,
    calculation_version = command->'snapshot'->>'calculationVersion',
    snapshot = jsonb_set(command->'snapshot', '{documentNumber}', to_jsonb(target.document_number), true)
  where transaction_id = target.id;

  update public.documents
  set issued_on = case
      when target.type = 'loan_origination' then (command->>'issueDate')::date
      when target.type = 'capital_payment' then (command->>'transactionDate')::date
      else (command->>'paymentDate')::date
    end
  where transaction_id = target.id;

  update public.loans
  set version = version + 1, updated_at = now()
  where id = locked_loan.id
  returning version into next_loan_version;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, details
  ) values (
    organization_id_value, auth.uid(), 'transaction.edited', 'transaction', target.id::text,
    jsonb_build_object(
      'documentNumber', target.document_number,
      'transactionType', target.type,
      'before', coalesce(before_state, '{}'::jsonb),
      'after', after_state
    )
  );

  return jsonb_build_object(
    'transactionId', target.id,
    'loanId', target.loan_id,
    'documentNumber', target.document_number,
    'loanVersion', next_loan_version,
    'scheduleVersionId', case when target.type in ('loan_origination', 'capital_payment') then target_schedule.id else null end,
    'edited', true
  );
end;
$$;

revoke all on function public.edit_transaction(jsonb) from public, anon, authenticated;
grant execute on function public.edit_transaction(jsonb) to authenticated;
