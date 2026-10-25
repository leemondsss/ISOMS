create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    display_name text not null default '',
    role text check (role in ('administrator', 'adviser', 'officer')),
    account_status text not null default 'pending'
        check (account_status in ('pending', 'active', 'disabled')),
    organization_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_isoms_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'administrator'
          and account_status = 'active'
    );
$$;

revoke all on function public.is_isoms_admin() from public;
grant execute on function public.is_isoms_admin() to authenticated;

create or replace function public.handle_new_isoms_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'display_name', '')
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_isoms on auth.users;
create trigger on_auth_user_created_isoms
    after insert on auth.users
    for each row execute procedure public.handle_new_isoms_user();

drop policy if exists "Users can view their own profile or admins can view all" on public.profiles;
create policy "Users can view their own profile or admins can view all"
    on public.profiles
    for select
    to authenticated
    using ((select auth.uid()) = id or (select public.is_isoms_admin()));

drop policy if exists "Admins can update other profiles" on public.profiles;
create policy "Admins can update other profiles"
    on public.profiles
    for update
    to authenticated
    using ((select public.is_isoms_admin()) and id <> (select auth.uid()))
    with check ((select public.is_isoms_admin()));

grant select, update on public.profiles to authenticated;

create table if not exists public.organization_reviews (
    organization_id text primary key,
    status text not null check (status in ('pending', 'approved', 'revision')),
    revision_note text not null default '',
    updated_by uuid not null references auth.users(id),
    updated_at timestamptz not null default now()
);

alter table public.organization_reviews enable row level security;

drop policy if exists "Organization officers can view their review status" on public.organization_reviews;
create policy "Organization officers can view their review status"
    on public.organization_reviews
    for select
    to authenticated
    using (
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower(organization_reviews.organization_id)
        )
    );

grant select on public.organization_reviews to authenticated;

create table if not exists public.organization_notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id text not null,
    type text not null check (type in ('revision', 'approved', 'pending', 'announcement')),
    message text not null check (length(message) between 1 and 1000),
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    read_at timestamptz
);

create index if not exists organization_notifications_org_created_idx
    on public.organization_notifications (organization_id, created_at desc);

alter table public.organization_notifications enable row level security;

drop policy if exists "Organization officers can view their notifications" on public.organization_notifications;
create policy "Organization officers can view their notifications"
    on public.organization_notifications
    for select
    to authenticated
    using (
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower(organization_notifications.organization_id)
        )
    );

drop policy if exists "Organization officers can mark their notifications read" on public.organization_notifications;
create policy "Organization officers can mark their notifications read"
    on public.organization_notifications
    for update
    to authenticated
    using (
        exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower(organization_notifications.organization_id)
        )
    )
    with check (
        exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower(organization_notifications.organization_id)
        )
    );

grant select on public.organization_notifications to authenticated;
grant update (read_at) on public.organization_notifications to authenticated;

create or replace function public.save_organization_review(
    p_organization_id text,
    p_status text,
    p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not (select public.is_isoms_admin()) then
        raise exception 'Only an active administrator can save organization reviews.';
    end if;

    if p_organization_id is null or length(trim(p_organization_id)) not between 1 and 100 then
        raise exception 'A valid organization ID is required.';
    end if;

    if p_status is null or p_status not in ('pending', 'approved', 'revision') then
        raise exception 'Invalid organization review status.';
    end if;

    if p_message is null or length(trim(p_message)) not between 1 and 1000 then
        raise exception 'Review instructions or a status message are required.';
    end if;

    insert into public.organization_reviews (organization_id, status, revision_note, updated_by, updated_at)
    values (
        trim(p_organization_id),
        p_status,
        case when p_status = 'revision' then trim(p_message) else '' end,
        (select auth.uid()),
        now()
    )
    on conflict (organization_id) do update
    set status = excluded.status,
        revision_note = excluded.revision_note,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

    insert into public.organization_notifications (organization_id, type, message, created_by)
    values (trim(p_organization_id), p_status, trim(p_message), (select auth.uid()));
end;
$$;

revoke all on function public.save_organization_review(text, text, text) from public;
grant execute on function public.save_organization_review(text, text, text) to authenticated;

-- After creating your own account, run this once in the SQL Editor.
-- Replace the email below with the email used for your first administrator account.
-- Keep this bootstrap statement private and remove it after the initial admin is assigned.
-- update public.profiles
-- set role = 'administrator', account_status = 'active'
-- where email = 'your-admin-email@example.com';
