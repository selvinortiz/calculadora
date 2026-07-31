create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  default_recipient text not null default '' check (char_length(default_recipient) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner', 'operator')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create unique index one_active_organization_per_user
  on public.organization_members(user_id)
  where active;

create table public.document_counters (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  kind text not null check (kind in ('financing', 'receipt', 'adjustment')),
  prefix text not null check (prefix ~ '^[A-Z0-9]{1,12}$'),
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind),
  unique (organization_id, prefix)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_organization_name_idx
  on public.customers(organization_id, name);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  account_reference text not null check (char_length(trim(account_reference)) between 1 and 80),
  price_cents bigint not null check (price_cents between 1 and 100000000000),
  down_payment_cents bigint not null check (down_payment_cents between 0 and price_cents),
  original_principal_cents bigint not null check (original_principal_cents = price_cents - down_payment_cents),
  annual_rate numeric(9,6) not null check (annual_rate between 0 and 100),
  term_months integer not null check (term_months between 2 and 360),
  first_due_date date not null,
  status text not null default 'active' check (status in ('active', 'voided')),
  version integer not null default 1 check (version > 0),
  current_schedule_version_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz
);

create unique index active_loan_account_reference_unique
  on public.loans(organization_id, lower(account_reference))
  where status = 'active';

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  loan_id uuid not null references public.loans(id) on delete restrict,
  type text not null check (type in ('loan_origination', 'capital_payment', 'payment_adjustment')),
  status text not null default 'posted' check (status in ('posted', 'voided')),
  effective_date date not null,
  document_number text not null check (char_length(document_number) between 3 and 32),
  idempotency_key uuid not null,
  depends_on_transaction_id uuid references public.transactions(id) on delete restrict,
  replaces_transaction_id uuid references public.transactions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  unique (organization_id, idempotency_key),
  unique (organization_id, document_number)
);

create index transactions_loan_created_idx
  on public.transactions(loan_id, created_at);
create index transactions_dependency_idx
  on public.transactions(depends_on_transaction_id)
  where status = 'posted';
create unique index transactions_single_replacement_unique
  on public.transactions(replaces_transaction_id)
  where replaces_transaction_id is not null;

create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  loan_id uuid not null references public.loans(id) on delete restrict,
  source_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  previous_version_id uuid references public.schedule_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  reason text not null check (reason in ('origination', 'capital_payment')),
  status text not null default 'active' check (status in ('active', 'voided')),
  calculation_version text not null,
  effective_after_payment integer not null check (effective_after_payment >= 0),
  first_payment_number integer not null check (first_payment_number > 0),
  first_due_date date not null,
  principal_cents bigint not null check (principal_cents between 0 and 100000000000),
  future_interest_cents bigint not null check (future_interest_cents between 0 and 100000000000),
  remaining_months integer not null check (remaining_months between 1 and 360),
  regular_payment_cents bigint not null check (regular_payment_cents between 0 and 100000000000),
  final_payment_cents bigint not null check (final_payment_cents between 0 and 100000000000),
  created_at timestamptz not null default now(),
  unique (loan_id, version_number)
);

alter table public.loans
  add constraint loans_current_schedule_fk
  foreign key (current_schedule_version_id)
  references public.schedule_versions(id)
  on delete restrict;

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  schedule_version_id uuid not null references public.schedule_versions(id) on delete restrict,
  payment_number integer not null check (payment_number > 0),
  due_date date not null,
  principal_cents bigint not null check (principal_cents between 0 and 100000000000),
  interest_cents bigint not null check (interest_cents between 0 and 100000000000),
  payment_cents bigint not null check (payment_cents between 0 and 100000000000),
  remaining_principal_cents bigint not null check (remaining_principal_cents between 0 and 100000000000),
  unique (schedule_version_id, payment_number)
);

create table public.capital_payment_details (
  transaction_id uuid primary key references public.transactions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transaction_mode text not null check (transaction_mode in ('standalone', 'combined')),
  payment_number integer not null check (payment_number > 0),
  last_payment_date date,
  next_payment_date date not null,
  balance_source text not null check (balance_source in ('calculated', 'statement')),
  capital_payment_cents bigint not null check (capital_payment_cents > 0),
  regular_payment_cents bigint not null check (regular_payment_cents >= 0),
  current_capital_cents bigint not null check (current_capital_cents >= 0),
  new_capital_cents bigint not null check (new_capital_cents >= 0),
  original_future_interest_cents bigint not null check (original_future_interest_cents >= 0),
  new_future_interest_cents bigint not null check (new_future_interest_cents >= 0),
  new_scheduled_balance_cents bigint not null check (new_scheduled_balance_cents >= 0),
  payment_method text not null default '' check (char_length(payment_method) <= 80),
  payment_reference text not null default '' check (char_length(payment_reference) <= 120),
  received_by text not null default '' check (char_length(received_by) <= 80),
  notes text not null default '' check (char_length(notes) <= 1000),
  check (capital_payment_cents <= current_capital_cents),
  check (new_capital_cents = current_capital_cents - capital_payment_cents),
  check (new_scheduled_balance_cents = new_capital_cents + new_future_interest_cents)
);

create table public.payment_adjustment_details (
  transaction_id uuid primary key references public.transactions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_number integer not null check (payment_number > 0),
  payment_date date not null,
  next_payment_date date not null,
  scheduled_payment_cents bigint not null check (scheduled_payment_cents > 0),
  received_payment_cents bigint not null check (received_payment_cents > scheduled_payment_cents),
  credit_balance_cents bigint not null check (credit_balance_cents = received_payment_cents - scheduled_payment_cents),
  adjusted_next_payment_cents bigint not null check (adjusted_next_payment_cents = scheduled_payment_cents - credit_balance_cents and adjusted_next_payment_cents > 0),
  payment_reference text not null default '' check (char_length(payment_reference) <= 120),
  adjusted_by text not null default '' check (char_length(adjusted_by) <= 80),
  notes text not null default '' check (char_length(notes) <= 1000)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  kind text not null check (kind in ('payment_schedule', 'capital_payment_record', 'payment_adjustment_record')),
  snapshot_version integer not null check (snapshot_version > 0),
  calculation_version text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  issued_on date not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, kind)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text not null check (char_length(entity_id) between 1 and 120),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_events_organization_created_idx
  on public.audit_events(organization_id, created_at desc);

alter table public.customers add constraint customers_id_organization_unique unique (id, organization_id);
alter table public.loans add constraint loans_id_organization_unique unique (id, organization_id);
alter table public.transactions add constraint transactions_id_organization_unique unique (id, organization_id);
alter table public.transactions add constraint transactions_id_loan_organization_unique unique (id, loan_id, organization_id);
alter table public.schedule_versions add constraint schedules_id_organization_unique unique (id, organization_id);

alter table public.loans add constraint loans_customer_organization_fk
  foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict;
alter table public.transactions add constraint transactions_loan_organization_fk
  foreign key (loan_id, organization_id) references public.loans(id, organization_id) on delete restrict;
alter table public.transactions add constraint transactions_dependency_loan_organization_fk
  foreign key (depends_on_transaction_id, loan_id, organization_id)
  references public.transactions(id, loan_id, organization_id) on delete restrict;
alter table public.transactions add constraint transactions_replacement_organization_fk
  foreign key (replaces_transaction_id, organization_id)
  references public.transactions(id, organization_id) on delete restrict;
alter table public.schedule_versions add constraint schedules_loan_organization_fk
  foreign key (loan_id, organization_id) references public.loans(id, organization_id) on delete restrict;
alter table public.schedule_versions add constraint schedules_source_loan_organization_fk
  foreign key (source_transaction_id, loan_id, organization_id)
  references public.transactions(id, loan_id, organization_id) on delete restrict;
alter table public.installments add constraint installments_schedule_organization_fk
  foreign key (schedule_version_id, organization_id)
  references public.schedule_versions(id, organization_id) on delete restrict;
alter table public.capital_payment_details add constraint capital_details_transaction_organization_fk
  foreign key (transaction_id, organization_id)
  references public.transactions(id, organization_id) on delete restrict;
alter table public.payment_adjustment_details add constraint adjustment_details_transaction_organization_fk
  foreign key (transaction_id, organization_id)
  references public.transactions(id, organization_id) on delete restrict;
alter table public.documents add constraint documents_transaction_organization_fk
  foreign key (transaction_id, organization_id)
  references public.transactions(id, organization_id) on delete restrict;

create or replace function private.is_active_member(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.active
  );
$$;

create or replace function private.is_owner(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.active
      and membership.role = 'owner'
  );
$$;

create or replace function private.can_read_profile(target_profile_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id = target_user_id or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = target_user_id
      and mine.active
      and theirs.user_id = target_profile_id
  );
$$;

create or replace function private.next_document_number(target_organization_id uuid, target_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  counter_prefix text;
  counter_value bigint;
begin
  if not private.is_active_member(target_organization_id) then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;

  select prefix, next_value
  into counter_prefix, counter_value
  from public.document_counters
  where organization_id = target_organization_id and kind = target_kind
  for update;

  if counter_prefix is null then
    raise exception using errcode = 'P0001', message = 'document_counter_missing';
  end if;

  update public.document_counters
  set next_value = counter_value + 1, updated_at = now()
  where organization_id = target_organization_id and kind = target_kind;

  return counter_prefix || '-' || lpad(counter_value::text, 6, '0');
end;
$$;

create or replace function private.guard_business_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'business_records_are_immutable';
  end if;
  if coalesce(current_setting('app.business_write', true), '') <> 'on'
     and coalesce(current_setting('app.voiding', true), '') <> 'on' then
    raise exception using errcode = '42501', message = 'business_write_function_required';
  end if;
  return new;
end;
$$;

create or replace function private.assert_schedule_reconciles(target_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.schedule_versions%rowtype;
  row_count bigint;
  principal_total bigint;
  interest_total bigint;
  payment_total bigint;
  first_number integer;
  last_number integer;
  invalid_rows bigint;
  invalid_components bigint;
  invalid_regular_payments bigint;
  invalid_final_payments bigint;
begin
  select * into target from public.schedule_versions where id = target_schedule_id;
  if not found then
    raise exception using errcode = '23514', message = 'schedule_not_found';
  end if;

  select count(*), coalesce(sum(principal_cents), 0), coalesce(sum(interest_cents), 0),
    coalesce(sum(payment_cents), 0), min(payment_number), max(payment_number),
    count(*) filter (where payment_cents <> principal_cents + interest_cents),
    count(*) filter (where payment_number < target.first_payment_number + target.remaining_months - 1
      and payment_cents <> target.regular_payment_cents),
    count(*) filter (where payment_number = target.first_payment_number + target.remaining_months - 1
      and payment_cents <> target.final_payment_cents)
  into row_count, principal_total, interest_total, payment_total, first_number, last_number,
    invalid_components, invalid_regular_payments, invalid_final_payments
  from public.installments
  where schedule_version_id = target_schedule_id;

  select count(*) into invalid_rows
  from (
    select remaining_principal_cents,
      target.principal_cents - sum(principal_cents) over (order by payment_number) as expected_remaining
    from public.installments
    where schedule_version_id = target_schedule_id
  ) rows
  where remaining_principal_cents <> expected_remaining;

  if row_count <> target.remaining_months
     or first_number <> target.first_payment_number
     or last_number <> target.first_payment_number + target.remaining_months - 1
     or principal_total <> target.principal_cents
     or interest_total <> target.future_interest_cents
     or payment_total <> target.principal_cents + target.future_interest_cents
     or invalid_rows <> 0
     or invalid_components <> 0
     or invalid_regular_payments <> 0
     or invalid_final_payments <> 0
     or not exists (select 1 from public.installments where schedule_version_id = target_schedule_id and remaining_principal_cents = 0) then
    raise exception using errcode = '23514', message = 'schedule_does_not_reconcile';
  end if;
end;
$$;

create trigger guard_loans before insert or update or delete on public.loans
for each row execute function private.guard_business_record();
create trigger guard_transactions before insert or update or delete on public.transactions
for each row execute function private.guard_business_record();
create trigger guard_schedule_versions before insert or update or delete on public.schedule_versions
for each row execute function private.guard_business_record();
create trigger guard_installments before insert or update or delete on public.installments
for each row execute function private.guard_business_record();
create trigger guard_capital_payment_details before insert or update or delete on public.capital_payment_details
for each row execute function private.guard_business_record();
create trigger guard_payment_adjustment_details before insert or update or delete on public.payment_adjustment_details
for each row execute function private.guard_business_record();
create trigger guard_documents before insert or update or delete on public.documents
for each row execute function private.guard_business_record();
create trigger guard_audit_events before insert or update or delete on public.audit_events
for each row execute function private.guard_business_record();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.document_counters enable row level security;
alter table public.customers enable row level security;
alter table public.loans enable row level security;
alter table public.transactions enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.installments enable row level security;
alter table public.capital_payment_details enable row level security;
alter table public.payment_adjustment_details enable row level security;
alter table public.documents enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using ((select private.can_read_profile(id)));

create policy organizations_select on public.organizations for select to authenticated
using ((select private.is_active_member(id)));
create policy organizations_update_owner on public.organizations for update to authenticated
using ((select private.is_owner(id))) with check ((select private.is_owner(id)));

create policy members_select on public.organization_members for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy counters_select on public.document_counters for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy counters_update_owner on public.document_counters for update to authenticated
using ((select private.is_owner(organization_id))) with check ((select private.is_owner(organization_id)));

create policy customers_select on public.customers for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy customers_insert on public.customers for insert to authenticated
with check ((select private.is_active_member(organization_id)) and created_by = (select auth.uid()));
create policy customers_update on public.customers for update to authenticated
using ((select private.is_active_member(organization_id)))
with check ((select private.is_active_member(organization_id)));

create policy loans_select on public.loans for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy loans_insert on public.loans for insert to authenticated
with check ((select private.is_active_member(organization_id)) and created_by = (select auth.uid()));
create policy loans_update on public.loans for update to authenticated
using ((select private.is_active_member(organization_id)))
with check ((select private.is_active_member(organization_id)));

create policy transactions_select on public.transactions for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy transactions_insert on public.transactions for insert to authenticated
with check ((select private.is_active_member(organization_id)) and created_by = (select auth.uid()));

create policy schedules_select on public.schedule_versions for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy schedules_insert on public.schedule_versions for insert to authenticated
with check ((select private.is_active_member(organization_id)));

create policy installments_select on public.installments for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy installments_insert on public.installments for insert to authenticated
with check ((select private.is_active_member(organization_id)));

create policy capital_details_select on public.capital_payment_details for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy capital_details_insert on public.capital_payment_details for insert to authenticated
with check ((select private.is_active_member(organization_id)));

create policy adjustment_details_select on public.payment_adjustment_details for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy adjustment_details_insert on public.payment_adjustment_details for insert to authenticated
with check ((select private.is_active_member(organization_id)));

create policy documents_select on public.documents for select to authenticated
using ((select private.is_active_member(organization_id)));
create policy documents_insert on public.documents for insert to authenticated
with check ((select private.is_active_member(organization_id)));

create policy audit_select_owner on public.audit_events for select to authenticated
using ((select private.is_owner(organization_id)));
create policy audit_insert_member on public.audit_events for insert to authenticated
with check ((select private.is_active_member(organization_id)) and actor_id = (select auth.uid()));

create or replace function public.post_loan(command jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization_id_value uuid := (command->>'organizationId')::uuid;
  idempotency_value uuid := (command->>'idempotencyKey')::uuid;
  transaction_id_value uuid;
  loan_id_value uuid;
  schedule_id_value uuid;
  document_number_value text;
  existing_record record;
  schedule_row jsonb;
  interest_total bigint;
  regular_payment bigint;
  final_payment bigint;
begin
  if not private.is_active_member(organization_id_value) then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;
  if nullif(command->>'replacesTransactionId', '') is not null then
    if not private.is_owner(organization_id_value) then
      raise exception using errcode = '42501', message = 'owner_required_for_replacement';
    end if;
    if not exists (
      select 1 from public.transactions
      where id = (command->>'replacesTransactionId')::uuid
        and organization_id = organization_id_value
        and type = 'loan_origination' and status = 'voided'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_replacement';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(organization_id_value::text || ':' || idempotency_value::text, 0));
  select id, loan_id, document_number into existing_record
  from public.transactions
  where organization_id = organization_id_value and idempotency_key = idempotency_value;
  if found then
    return jsonb_build_object('transactionId', existing_record.id, 'loanId', existing_record.loan_id,
      'documentNumber', existing_record.document_number, 'loanVersion', 1,
      'scheduleVersionId', (select current_schedule_version_id from public.loans where id = existing_record.loan_id),
      'idempotentReplay', true);
  end if;

  perform pg_catalog.set_config('app.business_write', 'on', true);
  document_number_value := private.next_document_number(organization_id_value, 'financing');

  insert into public.loans (
    organization_id, customer_id, account_reference, price_cents, down_payment_cents,
    original_principal_cents, annual_rate, term_months, first_due_date, created_by
  ) values (
    organization_id_value, (command->>'customerId')::uuid, trim(command->>'accountReference'),
    (command->>'priceCents')::bigint, (command->>'downPaymentCents')::bigint,
    (command->>'principalCents')::bigint, (command->>'annualRate')::numeric,
    (command->>'termMonths')::integer, (command->>'firstDueDate')::date, auth.uid()
  ) returning id into loan_id_value;

  insert into public.transactions (
    organization_id, loan_id, type, effective_date, document_number, idempotency_key,
    replaces_transaction_id, created_by
  ) values (
    organization_id_value, loan_id_value, 'loan_origination', (command->>'issueDate')::date,
    document_number_value, idempotency_value, nullif(command->>'replacesTransactionId', '')::uuid, auth.uid()
  ) returning id into transaction_id_value;

  select coalesce(sum((schedule_item.value->>'interestCents')::bigint), 0),
    coalesce((command->'schedule'->0->>'paymentCents')::bigint, 0),
    coalesce((command->'schedule'->-1->>'paymentCents')::bigint, 0)
  into interest_total, regular_payment, final_payment
  from jsonb_array_elements(command->'schedule') as schedule_item(value);

  insert into public.schedule_versions (
    organization_id, loan_id, source_transaction_id, version_number, reason,
    calculation_version, effective_after_payment, first_payment_number, first_due_date,
    principal_cents, future_interest_cents, remaining_months, regular_payment_cents, final_payment_cents
  ) values (
    organization_id_value, loan_id_value, transaction_id_value, 1, 'origination',
    command->'snapshot'->>'calculationVersion', 0, 1, (command->>'firstDueDate')::date,
    (command->>'principalCents')::bigint, interest_total, (command->>'termMonths')::integer,
    regular_payment, final_payment
  ) returning id into schedule_id_value;

  for schedule_row in select value from jsonb_array_elements(command->'schedule')
  loop
    insert into public.installments (
      organization_id, schedule_version_id, payment_number, due_date, principal_cents,
      interest_cents, payment_cents, remaining_principal_cents
    ) values (
      organization_id_value, schedule_id_value, (schedule_row->>'paymentNumber')::integer,
      (schedule_row->>'dueDate')::date, (schedule_row->>'principalCents')::bigint,
      (schedule_row->>'interestCents')::bigint, (schedule_row->>'paymentCents')::bigint,
      (schedule_row->>'remainingPrincipalCents')::bigint
    );
  end loop;

  perform private.assert_schedule_reconciles(schedule_id_value);

  update public.loans set current_schedule_version_id = schedule_id_value, updated_at = now()
  where id = loan_id_value;

  insert into public.documents (
    organization_id, transaction_id, kind, snapshot_version, calculation_version, snapshot, issued_on
  ) values (
    organization_id_value, transaction_id_value, 'payment_schedule',
    (command->'snapshot'->>'version')::integer, command->'snapshot'->>'calculationVersion',
    jsonb_set(command->'snapshot', '{documentNumber}', to_jsonb(document_number_value), true),
    (command->>'issueDate')::date
  );

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (organization_id_value, auth.uid(), 'loan.posted', 'loan', loan_id_value::text,
    jsonb_build_object('transactionId', transaction_id_value, 'documentNumber', document_number_value));

  return jsonb_build_object('transactionId', transaction_id_value, 'loanId', loan_id_value,
    'documentNumber', document_number_value, 'loanVersion', 1,
    'scheduleVersionId', schedule_id_value, 'idempotentReplay', false);
end;
$$;

create or replace function public.post_capital_payment(command jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization_id_value uuid := (command->>'organizationId')::uuid;
  loan_id_value uuid := (command->>'loanId')::uuid;
  idempotency_value uuid := (command->>'idempotencyKey')::uuid;
  locked_loan record;
  current_schedule record;
  existing_record record;
  transaction_id_value uuid;
  schedule_id_value uuid;
  document_number_value text;
  schedule_row jsonb;
  next_schedule_version integer;
begin
  if not private.is_active_member(organization_id_value) then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;
  if nullif(command->>'replacesTransactionId', '') is not null then
    if not private.is_owner(organization_id_value) then
      raise exception using errcode = '42501', message = 'owner_required_for_replacement';
    end if;
    if not exists (
      select 1 from public.transactions
      where id = (command->>'replacesTransactionId')::uuid
        and organization_id = organization_id_value and loan_id = loan_id_value
        and type = 'capital_payment' and status = 'voided'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_replacement';
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(organization_id_value::text || ':' || idempotency_value::text, 0));
  select id, loan_id, document_number into existing_record from public.transactions
  where organization_id = organization_id_value and idempotency_key = idempotency_value;
  if found then
    return jsonb_build_object('transactionId', existing_record.id, 'loanId', existing_record.loan_id,
      'documentNumber', existing_record.document_number,
      'loanVersion', (select version from public.loans where id = existing_record.loan_id),
      'scheduleVersionId', (select id from public.schedule_versions where source_transaction_id = existing_record.id),
      'idempotentReplay', true);
  end if;

  select * into locked_loan from public.loans
  where id = loan_id_value and organization_id = organization_id_value and status = 'active'
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'loan_not_found'; end if;
  if locked_loan.version <> (command->>'expectedLoanVersion')::integer then
    raise exception using errcode = 'P0001', message = 'loan_version_conflict';
  end if;
  select * into current_schedule from public.schedule_versions where id = locked_loan.current_schedule_version_id;
  select coalesce(max(version_number), 0) + 1
  into next_schedule_version
  from public.schedule_versions
  where loan_id = loan_id_value;

  perform pg_catalog.set_config('app.business_write', 'on', true);
  document_number_value := private.next_document_number(organization_id_value, 'receipt');
  insert into public.transactions (
    organization_id, loan_id, type, effective_date, document_number, idempotency_key,
    depends_on_transaction_id, replaces_transaction_id, created_by
  ) values (
    organization_id_value, loan_id_value, 'capital_payment', (command->>'transactionDate')::date,
    document_number_value, idempotency_value, current_schedule.source_transaction_id,
    nullif(command->>'replacesTransactionId', '')::uuid, auth.uid()
  ) returning id into transaction_id_value;

  insert into public.capital_payment_details (
    transaction_id, organization_id, transaction_mode, payment_number, last_payment_date,
    next_payment_date, balance_source, capital_payment_cents, regular_payment_cents,
    current_capital_cents, new_capital_cents, original_future_interest_cents,
    new_future_interest_cents, new_scheduled_balance_cents, payment_method,
    payment_reference, received_by, notes
  ) values (
    transaction_id_value, organization_id_value, command->>'transactionMode',
    (command->>'paymentNumber')::integer, nullif(command->>'lastPaymentDate', '')::date,
    (command->>'nextPaymentDate')::date, command->>'balanceSource',
    (command->>'capitalPaymentCents')::bigint, (command->>'regularPaymentCents')::bigint,
    (command->>'currentCapitalCents')::bigint, (command->>'newCapitalCents')::bigint,
    (command->>'originalFutureInterestCents')::bigint, (command->>'newFutureInterestCents')::bigint,
    (command->>'newScheduledBalanceCents')::bigint, coalesce(command->>'paymentMethod', ''),
    coalesce(command->>'paymentReference', ''), coalesce(command->>'receivedBy', ''),
    coalesce(command->>'notes', '')
  );

  insert into public.schedule_versions (
    organization_id, loan_id, source_transaction_id, previous_version_id, version_number,
    reason, calculation_version, effective_after_payment, first_payment_number, first_due_date,
    principal_cents, future_interest_cents, remaining_months, regular_payment_cents, final_payment_cents
  ) values (
    organization_id_value, loan_id_value, transaction_id_value, current_schedule.id,
    next_schedule_version, 'capital_payment', command->'snapshot'->>'calculationVersion',
    (command->>'paymentNumber')::integer, (command->>'paymentNumber')::integer + 1,
    (command->>'nextPaymentDate')::date, (command->>'newCapitalCents')::bigint,
    (command->>'newFutureInterestCents')::bigint, (command->>'remainingMonths')::integer,
    (command->>'newMonthlyPaymentCents')::bigint, (command->>'newFinalPaymentCents')::bigint
  ) returning id into schedule_id_value;

  for schedule_row in select value from jsonb_array_elements(command->'schedule')
  loop
    insert into public.installments (
      organization_id, schedule_version_id, payment_number, due_date, principal_cents,
      interest_cents, payment_cents, remaining_principal_cents
    ) values (
      organization_id_value, schedule_id_value, (schedule_row->>'paymentNumber')::integer,
      (schedule_row->>'dueDate')::date, (schedule_row->>'principalCents')::bigint,
      (schedule_row->>'interestCents')::bigint, (schedule_row->>'paymentCents')::bigint,
      (schedule_row->>'remainingPrincipalCents')::bigint
    );
  end loop;

  perform private.assert_schedule_reconciles(schedule_id_value);

  update public.loans set current_schedule_version_id = schedule_id_value,
    version = version + 1, updated_at = now() where id = loan_id_value;

  insert into public.documents (
    organization_id, transaction_id, kind, snapshot_version, calculation_version, snapshot, issued_on
  ) values (
    organization_id_value, transaction_id_value, 'capital_payment_record',
    (command->'snapshot'->>'version')::integer, command->'snapshot'->>'calculationVersion',
    jsonb_set(command->'snapshot', '{documentNumber}', to_jsonb(document_number_value), true),
    (command->>'transactionDate')::date
  );
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (organization_id_value, auth.uid(), 'capital_payment.posted', 'transaction', transaction_id_value::text,
    jsonb_build_object('loanId', loan_id_value, 'documentNumber', document_number_value));

  return jsonb_build_object('transactionId', transaction_id_value, 'loanId', loan_id_value,
    'documentNumber', document_number_value, 'loanVersion', locked_loan.version + 1,
    'scheduleVersionId', schedule_id_value, 'idempotentReplay', false);
end;
$$;

create or replace function public.post_payment_adjustment(command jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization_id_value uuid := (command->>'organizationId')::uuid;
  loan_id_value uuid := (command->>'loanId')::uuid;
  idempotency_value uuid := (command->>'idempotencyKey')::uuid;
  locked_loan record;
  current_schedule record;
  existing_record record;
  transaction_id_value uuid;
  document_number_value text;
begin
  if not private.is_active_member(organization_id_value) then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;
  if nullif(command->>'replacesTransactionId', '') is not null then
    if not private.is_owner(organization_id_value) then
      raise exception using errcode = '42501', message = 'owner_required_for_replacement';
    end if;
    if not exists (
      select 1 from public.transactions
      where id = (command->>'replacesTransactionId')::uuid
        and organization_id = organization_id_value and loan_id = loan_id_value
        and type = 'payment_adjustment' and status = 'voided'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_replacement';
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(organization_id_value::text || ':' || idempotency_value::text, 0));
  select id, loan_id, document_number into existing_record from public.transactions
  where organization_id = organization_id_value and idempotency_key = idempotency_value;
  if found then
    return jsonb_build_object('transactionId', existing_record.id, 'loanId', existing_record.loan_id,
      'documentNumber', existing_record.document_number,
      'loanVersion', (select version from public.loans where id = existing_record.loan_id),
      'scheduleVersionId', null, 'idempotentReplay', true);
  end if;

  select * into locked_loan from public.loans
  where id = loan_id_value and organization_id = organization_id_value and status = 'active'
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'loan_not_found'; end if;
  if locked_loan.version <> (command->>'expectedLoanVersion')::integer then
    raise exception using errcode = 'P0001', message = 'loan_version_conflict';
  end if;
  select * into current_schedule from public.schedule_versions where id = locked_loan.current_schedule_version_id;

  perform pg_catalog.set_config('app.business_write', 'on', true);
  document_number_value := private.next_document_number(organization_id_value, 'adjustment');
  insert into public.transactions (
    organization_id, loan_id, type, effective_date, document_number, idempotency_key,
    depends_on_transaction_id, replaces_transaction_id, created_by
  ) values (
    organization_id_value, loan_id_value, 'payment_adjustment', (command->>'paymentDate')::date,
    document_number_value, idempotency_value, current_schedule.source_transaction_id,
    nullif(command->>'replacesTransactionId', '')::uuid, auth.uid()
  ) returning id into transaction_id_value;

  insert into public.payment_adjustment_details (
    transaction_id, organization_id, payment_number, payment_date, next_payment_date,
    scheduled_payment_cents, received_payment_cents, credit_balance_cents,
    adjusted_next_payment_cents, payment_reference, adjusted_by, notes
  ) values (
    transaction_id_value, organization_id_value, (command->>'paymentNumber')::integer,
    (command->>'paymentDate')::date, (command->>'nextPaymentDate')::date,
    (command->>'scheduledPaymentCents')::bigint, (command->>'receivedPaymentCents')::bigint,
    (command->>'creditBalanceCents')::bigint, (command->>'adjustedNextPaymentCents')::bigint,
    coalesce(command->>'paymentReference', ''), coalesce(command->>'adjustedBy', ''),
    coalesce(command->>'notes', '')
  );

  insert into public.documents (
    organization_id, transaction_id, kind, snapshot_version, calculation_version, snapshot, issued_on
  ) values (
    organization_id_value, transaction_id_value, 'payment_adjustment_record',
    (command->'snapshot'->>'version')::integer, command->'snapshot'->>'calculationVersion',
    jsonb_set(command->'snapshot', '{documentNumber}', to_jsonb(document_number_value), true),
    (command->>'paymentDate')::date
  );
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (organization_id_value, auth.uid(), 'payment_adjustment.posted', 'transaction', transaction_id_value::text,
    jsonb_build_object('loanId', loan_id_value, 'documentNumber', document_number_value));

  return jsonb_build_object('transactionId', transaction_id_value, 'loanId', loan_id_value,
    'documentNumber', document_number_value, 'loanVersion', locked_loan.version,
    'scheduleVersionId', null, 'idempotentReplay', false);
end;
$$;

create or replace function public.void_transaction(target_transaction_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  target_schedule record;
  loan_version_value integer;
begin
  select * into target from public.transactions where id = target_transaction_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;
  if not private.is_owner(target.organization_id) then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;
  if char_length(trim(reason)) = 0 then
    raise exception using errcode = 'P0001', message = 'void_reason_required';
  end if;
  if target.status = 'voided' then
    select version into loan_version_value from public.loans where id = target.loan_id;
    return jsonb_build_object('transactionId', target.id, 'loanId', target.loan_id,
      'loanVersion', loan_version_value, 'alreadyVoided', true);
  end if;
  if exists (select 1 from public.transactions where depends_on_transaction_id = target.id and status = 'posted') then
    raise exception using errcode = 'P0001', message = 'dependent_transactions_must_be_voided_first';
  end if;
  if target.type = 'loan_origination' and exists (
    select 1 from public.transactions where loan_id = target.loan_id and id <> target.id and status = 'posted'
  ) then
    raise exception using errcode = 'P0001', message = 'loan_transactions_must_be_voided_first';
  end if;

  perform pg_catalog.set_config('app.voiding', 'on', true);
  update public.transactions set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = trim(reason)
  where id = target.id;

  if target.type = 'capital_payment' then
    select * into target_schedule from public.schedule_versions where source_transaction_id = target.id;
    update public.schedule_versions set status = 'voided' where id = target_schedule.id;
    update public.loans set current_schedule_version_id = target_schedule.previous_version_id,
      version = version + 1, updated_at = now() where id = target.loan_id returning version into loan_version_value;
  elsif target.type = 'loan_origination' then
    update public.schedule_versions set status = 'voided' where source_transaction_id = target.id;
    update public.loans set status = 'voided', current_schedule_version_id = null,
      voided_at = now(), version = version + 1, updated_at = now()
    where id = target.loan_id returning version into loan_version_value;
  else
    select version into loan_version_value from public.loans where id = target.loan_id;
  end if;

  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (target.organization_id, auth.uid(), 'transaction.voided', 'transaction', target.id::text,
    jsonb_build_object('reason', trim(reason), 'type', target.type));
  return jsonb_build_object('transactionId', target.id, 'loanId', target.loan_id,
    'loanVersion', loan_version_value, 'alreadyVoided', false);
end;
$$;

create or replace function public.record_audit_event(
  target_organization_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id text,
  target_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_active_member(target_organization_id) then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;
  perform pg_catalog.set_config('app.business_write', 'on', true);
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (target_organization_id, auth.uid(), target_action, target_entity_type, target_entity_id, coalesce(target_details, '{}'::jsonb));
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_members,
  public.document_counters, public.customers, public.loans, public.transactions,
  public.schedule_versions, public.installments, public.capital_payment_details,
  public.payment_adjustment_details, public.documents to authenticated;
grant update (name, default_recipient, updated_at) on public.organizations to authenticated;
grant update (prefix, updated_at) on public.document_counters to authenticated;
grant insert, update (name, phone, email, archived_at, updated_at) on public.customers to authenticated;
grant insert, update (current_schedule_version_id, status, version, updated_at, voided_at) on public.loans to authenticated;
grant insert on public.transactions, public.schedule_versions, public.installments,
  public.capital_payment_details, public.payment_adjustment_details, public.documents,
  public.audit_events to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid, uuid), private.is_owner(uuid, uuid),
  private.can_read_profile(uuid, uuid), private.next_document_number(uuid, text),
  private.assert_schedule_reconciles(uuid) to authenticated;
revoke all on function private.next_document_number(uuid, text) from public, anon;
revoke all on function public.post_loan(jsonb), public.post_capital_payment(jsonb),
  public.post_payment_adjustment(jsonb), public.void_transaction(uuid, text),
  public.record_audit_event(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.post_loan(jsonb), public.post_capital_payment(jsonb),
  public.post_payment_adjustment(jsonb), public.void_transaction(uuid, text),
  public.record_audit_event(uuid, text, text, text, jsonb) to authenticated;

grant usage on schema public, private to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public, private to service_role;
