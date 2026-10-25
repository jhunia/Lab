-- ============================================================================
-- LabDex — Supabase database setup (no email logins: staff number + PIN)
--
-- Run once in: Supabase dashboard → SQL Editor → New query → paste all → Run.
-- Safe to re-run.
--
-- How security works:
--   • The apps use the project's public "anon" key. With it, anyone can READ the
--     directory, the staff list (names/numbers/roles only) and sample logs.
--     Sample logs hold lab numbers only — never patient names or results.
--   • Nobody can WRITE to any table directly. Every change goes through a function
--     below that first checks the person's staff number + PIN (stored bcrypt-hashed).
--   • 5 wrong PINs lock that staff number for 5 minutes.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.staff (
  id               uuid primary key default gen_random_uuid(),
  staff_number     text not null unique,
  name             text not null,
  phone            text not null default '',
  role             text not null default 'TECH' check (role in ('VIEWER', 'TECH', 'SENIOR')),
  active           boolean not null default true,
  pin_hash         text not null,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Each publish stores the whole test directory (same format as the LabDex update file).
-- Never edited or deleted: a full record of everything that was published.
create table if not exists public.directory_releases (
  revision        bigint primary key,
  published_at    timestamptz not null default now(),
  published_by    uuid references public.staff (id),
  publisher_name  text not null default '',
  test_count      integer not null default 0,
  package         jsonb not null
);

create table if not exists public.sample_logs (
  id               uuid primary key,
  lab_number       text not null,
  test_ids         text[] not null default '{}',
  test_codes       text[] not null default '{}',
  created_at       timestamptz not null,
  created_by       uuid references public.staff (id),
  created_by_name  text not null default '',
  uploaded_at      timestamptz not null default now()
);

create table if not exists public.sample_events (
  id            uuid primary key,
  seq           bigserial unique,           -- upload order; devices pull "everything after seq N"
  log_id        uuid not null references public.sample_logs (id),
  status        text not null check (status in ('RECEIVED', 'IN_PROGRESS', 'PENDING', 'SENT_OUT', 'COMPLETED', 'REJECTED')),
  note          text not null default '',
  at            timestamptz not null,       -- when it happened (device clock)
  staff_id      uuid references public.staff (id),
  staff_name    text not null default '',
  staff_number  text not null default '',
  uploaded_at   timestamptz not null default now()
);

create index if not exists sample_logs_lab_number on public.sample_logs (lab_number);
create index if not exists sample_events_log on public.sample_events (log_id);

-- ---------- Row Level Security: read-only from the apps ----------

alter table public.staff enable row level security;              -- no policies: staff rows (and PIN hashes) are never readable directly
alter table public.directory_releases enable row level security;
alter table public.sample_logs enable row level security;
alter table public.sample_events enable row level security;

drop policy if exists "read releases" on public.directory_releases;
create policy "read releases" on public.directory_releases for select to anon, authenticated using (true);
drop policy if exists "read logs" on public.sample_logs;
create policy "read logs" on public.sample_logs for select to anon, authenticated using (true);
drop policy if exists "read events" on public.sample_events;
create policy "read events" on public.sample_events for select to anon, authenticated using (true);

-- ---------- PIN check (internal) ----------
-- Returns the staff row on success, or a reason. Uses a return value instead of raising
-- an error so the failed-attempt counter is saved (an error would undo it).
create or replace function public._check_pin(p_number text, p_pin text, out ok boolean, out reason text, out who public.staff)
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  select * into who from public.staff where lower(staff_number) = lower(trim(p_number));
  if not found or not who.active then
    ok := false; reason := 'Unknown or inactive staff number'; who := null; return;
  end if;
  if who.locked_until is not null and who.locked_until > now() then
    ok := false; reason := 'Too many wrong PINs — try again in a few minutes'; who := null; return;
  end if;
  if extensions.crypt(p_pin, who.pin_hash) <> who.pin_hash then
    update public.staff
       set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
           locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end
     where id = who.id;
    ok := false; reason := 'Wrong PIN'; who := null; return;
  end if;
  update public.staff set failed_attempts = 0, locked_until = null where id = who.id;
  ok := true; reason := null;
end;
$$;

create or replace function public._staff_json(s public.staff)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', s.id, 'staff_number', s.staff_number, 'name', s.name, 'phone', s.phone,
                            'role', s.role, 'active', s.active, 'updated_at', s.updated_at)
$$;

-- ---------- Functions the apps call ----------
-- All return {"ok": true, ...} or {"ok": false, "error": "..."}.

-- Staff list without any PIN data.
create or replace function public.list_staff()
returns jsonb
language sql stable
security definer set search_path = public
as $$ select coalesce(jsonb_agg(public._staff_json(s) order by s.name), '[]'::jsonb) from public.staff s $$;

-- Confirms who someone is.
create or replace function public.verify_staff(p_number text, p_pin text)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare c record;
begin
  select * into c from public._check_pin(p_number, p_pin);
  if not c.ok then return jsonb_build_object('ok', false, 'error', c.reason); end if;
  return jsonb_build_object('ok', true, 'staff', public._staff_json(c.who));
end;
$$;

-- Adds or edits a staff member. Only a Senior may do this — except the very first
-- person, who becomes the first Senior when the staff list is empty.
create or replace function public.upsert_staff(p_actor_number text, p_actor_pin text, p_staff jsonb, p_new_pin text)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  c record;
  v_id uuid := nullif(p_staff ->> 'id', '')::uuid;
  v_role text := coalesce(p_staff ->> 'role', 'TECH');
  v_active boolean := coalesce((p_staff ->> 'active')::boolean, true);
  v_row public.staff;
  v_first boolean := not exists (select 1 from public.staff);
begin
  if v_first then
    v_role := 'SENIOR'; v_active := true;
  else
    select * into c from public._check_pin(p_actor_number, p_actor_pin);
    if not c.ok then return jsonb_build_object('ok', false, 'error', c.reason); end if;
    if (c.who).role <> 'SENIOR' then return jsonb_build_object('ok', false, 'error', 'Only a Senior can manage staff'); end if;
  end if;

  if coalesce(trim(p_staff ->> 'name'), '') = '' or coalesce(trim(p_staff ->> 'staff_number'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Name and staff number are required');
  end if;
  if p_new_pin is not null and p_new_pin !~ '^\d{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'PIN must be 4–6 digits');
  end if;
  if exists (select 1 from public.staff where lower(staff_number) = lower(trim(p_staff ->> 'staff_number')) and id is distinct from v_id) then
    return jsonb_build_object('ok', false, 'error', 'That staff number is already used');
  end if;

  if v_id is null then
    if p_new_pin is null then return jsonb_build_object('ok', false, 'error', 'Set a PIN for the new staff member'); end if;
    insert into public.staff (staff_number, name, phone, role, active, pin_hash)
    values (trim(p_staff ->> 'staff_number'), trim(p_staff ->> 'name'), coalesce(trim(p_staff ->> 'phone'), ''), v_role, v_active,
            extensions.crypt(p_new_pin, extensions.gen_salt('bf')))
    returning * into v_row;
  else
    if (v_role <> 'SENIOR' or not v_active)
       and exists (select 1 from public.staff where id = v_id and role = 'SENIOR' and active)
       and not exists (select 1 from public.staff where id <> v_id and role = 'SENIOR' and active) then
      return jsonb_build_object('ok', false, 'error', 'Keep at least one active Senior');
    end if;
    update public.staff set
      staff_number = trim(p_staff ->> 'staff_number'),
      name = trim(p_staff ->> 'name'),
      phone = coalesce(trim(p_staff ->> 'phone'), ''),
      role = v_role,
      active = v_active,
      pin_hash = case when p_new_pin is null then pin_hash else extensions.crypt(p_new_pin, extensions.gen_salt('bf')) end,
      failed_attempts = case when p_new_pin is null then failed_attempts else 0 end,
      locked_until = case when p_new_pin is null then locked_until else null end,
      updated_at = now()
    where id = v_id
    returning * into v_row;
    if not found then return jsonb_build_object('ok', false, 'error', 'Staff member not found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'staff', public._staff_json(v_row));
end;
$$;

-- Lets someone change their own PIN.
create or replace function public.change_own_pin(p_number text, p_old_pin text, p_new_pin text)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare c record;
begin
  if p_new_pin !~ '^\d{4,6}$' then return jsonb_build_object('ok', false, 'error', 'PIN must be 4–6 digits'); end if;
  select * into c from public._check_pin(p_number, p_old_pin);
  if not c.ok then return jsonb_build_object('ok', false, 'error', c.reason); end if;
  update public.staff set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')), updated_at = now() where id = (c.who).id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Publishes the test directory. Seniors only.
create or replace function public.publish_release(p_actor_number text, p_actor_pin text, p_revision bigint, p_publisher_name text, p_test_count integer, p_package jsonb)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare c record;
begin
  select * into c from public._check_pin(p_actor_number, p_actor_pin);
  if not c.ok then return jsonb_build_object('ok', false, 'error', c.reason); end if;
  if (c.who).role <> 'SENIOR' then return jsonb_build_object('ok', false, 'error', 'Only a Senior can publish updates'); end if;
  if p_revision <= coalesce((select max(revision) from public.directory_releases), 0) then
    return jsonb_build_object('ok', false, 'error', 'A newer update was already published — sync first, then publish again');
  end if;
  insert into public.directory_releases (revision, published_by, publisher_name, test_count, package)
  values (p_revision, (c.who).id, coalesce(nullif(trim(p_publisher_name), ''), (c.who).name), p_test_count, p_package);
  return jsonb_build_object('ok', true, 'revision', p_revision);
end;
$$;

-- Records one sample-log event (and the log itself the first time). Lab techs and Seniors.
-- Safe to repeat: an event already uploaded is ignored, so retries after a dropped
-- connection never create duplicates.
create or replace function public.log_sample_event(p_number text, p_pin text, p_log jsonb, p_event jsonb)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare c record;
begin
  select * into c from public._check_pin(p_number, p_pin);
  if not c.ok then return jsonb_build_object('ok', false, 'error', c.reason, 'pin', c.reason = 'Wrong PIN'); end if;
  if (c.who).role not in ('TECH', 'SENIOR') then return jsonb_build_object('ok', false, 'error', 'Viewers cannot log samples'); end if;
  if (p_event ->> 'staff_id')::uuid is distinct from (c.who).id then
    return jsonb_build_object('ok', false, 'error', 'This entry belongs to a different staff member');
  end if;

  insert into public.sample_logs (id, lab_number, test_ids, test_codes, created_at, created_by, created_by_name)
  values ((p_log ->> 'id')::uuid, trim(p_log ->> 'lab_number'),
          coalesce(array(select jsonb_array_elements_text(p_log -> 'test_ids')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p_log -> 'test_codes')), '{}'),
          (p_log ->> 'created_at')::timestamptz, nullif(p_log ->> 'created_by', '')::uuid, coalesce(p_log ->> 'created_by_name', ''))
  on conflict (id) do nothing;

  insert into public.sample_events (id, log_id, status, note, at, staff_id, staff_name, staff_number)
  values ((p_event ->> 'id')::uuid, (p_log ->> 'id')::uuid, p_event ->> 'status', coalesce(p_event ->> 'note', ''),
          (p_event ->> 'at')::timestamptz, (c.who).id, (c.who).name, (c.who).staff_number)
  on conflict (id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Who may call what ----------
revoke all on function public._check_pin(text, text) from public, anon, authenticated;
revoke all on function public._staff_json(public.staff) from public, anon, authenticated;
grant execute on function public.list_staff() to anon, authenticated;
grant execute on function public.verify_staff(text, text) to anon, authenticated;
grant execute on function public.upsert_staff(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.change_own_pin(text, text, text) to anon, authenticated;
grant execute on function public.publish_release(text, text, bigint, text, integer, jsonb) to anon, authenticated;
grant execute on function public.log_sample_event(text, text, jsonb, jsonb) to anon, authenticated;

-- ============================================================================
-- Done. Next: in LabDex → Settings → Cloud, paste the Project URL and anon key.
-- The first person to add themselves to the empty staff list becomes the first Senior.
-- ============================================================================
