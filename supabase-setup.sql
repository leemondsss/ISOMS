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
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = case
            when public.profiles.display_name = '' then excluded.display_name
            else public.profiles.display_name
        end,
        updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_isoms on auth.users;
create trigger on_auth_user_created_isoms
    after insert on auth.users
    for each row execute procedure public.handle_new_isoms_user();

insert into public.profiles (id, email, display_name)
select
    users.id,
    coalesce(users.email, ''),
    coalesce(users.raw_user_meta_data ->> 'display_name', '')
from auth.users as users
on conflict (id) do update
set email = excluded.email,
    display_name = case
        when public.profiles.display_name = '' then excluded.display_name
        else public.profiles.display_name
    end,
    updated_at = now();

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
    type text not null check (type in ('revision', 'approved', 'pending', 'announcement', 'resubmitted', 'registered', 'adviser_comment')),
    message text not null check (length(message) between 1 and 1000),
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    read_at timestamptz
);

alter table public.organization_notifications
    drop constraint if exists organization_notifications_type_check;
alter table public.organization_notifications
    add constraint organization_notifications_type_check
    check (type in ('revision', 'approved', 'pending', 'announcement', 'resubmitted', 'registered', 'adviser_comment'));

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
              and role in ('officer', 'adviser')
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
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role in ('officer', 'adviser')
              and account_status = 'active'
              and lower(organization_id) = lower(organization_notifications.organization_id)
        )
    )
    with check (
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role in ('officer', 'adviser')
              and account_status = 'active'
              and lower(organization_id) = lower(organization_notifications.organization_id)
        )
    );

grant select on public.organization_notifications to authenticated;
grant update (read_at) on public.organization_notifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'isoms-organization-documents',
    'isoms-organization-documents',
    false,
    10485760,
    array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.organization_documents (
    id uuid primary key default gen_random_uuid(),
    organization_id text not null,
    document_type text not null check (length(document_type) between 1 and 160),
    person_name text,
    file_name text not null check (length(file_name) between 1 and 255),
    storage_path text not null unique,
    content_type text not null,
    uploaded_by uuid not null references auth.users(id),
    created_at timestamptz not null default now()
);

create index if not exists organization_documents_org_created_idx
    on public.organization_documents (organization_id, created_at desc);

alter table public.organization_documents enable row level security;

drop policy if exists "Organization members can view organization documents" on public.organization_documents;
create policy "Organization members can view organization documents"
    on public.organization_documents
    for select
    to authenticated
    using (
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role in ('officer', 'adviser')
              and account_status = 'active'
              and lower(organization_id) = lower(organization_documents.organization_id)
        )
    );

drop policy if exists "Assigned officers can add organization documents" on public.organization_documents;
create policy "Assigned officers can add organization documents"
    on public.organization_documents
    for insert
    to authenticated
    with check (
        uploaded_by = (select auth.uid())
        and exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower(organization_documents.organization_id)
        )
    );

grant select, insert on public.organization_documents to authenticated;

drop policy if exists "Assigned organization members can read stored documents" on storage.objects;
create policy "Assigned organization members can read stored documents"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'isoms-organization-documents'
        and exists (
            select 1
            from public.organization_documents as documents
            where documents.storage_path = storage.objects.name
              and (
                  (select public.is_isoms_admin())
                  or exists (
                      select 1
                      from public.profiles
                      where id = (select auth.uid())
                        and role in ('officer', 'adviser')
                        and account_status = 'active'
                        and lower(organization_id) = lower(documents.organization_id)
                  )
              )
        )
    );

drop policy if exists "Assigned officers can upload organization documents" on storage.objects;
create policy "Assigned officers can upload organization documents"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'isoms-organization-documents'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower((storage.foldername(name))[1])
        )
    );

drop policy if exists "Assigned officers can remove their uploaded documents" on storage.objects;
create policy "Assigned officers can remove their uploaded documents"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'isoms-organization-documents'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role = 'officer'
              and account_status = 'active'
              and lower(organization_id) = lower((storage.foldername(name))[1])
        )
    );

create table if not exists public.organization_document_comments (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.organization_documents(id) on delete cascade,
    organization_id text not null,
    author_id uuid not null references auth.users(id),
    author_name text not null,
    comment text not null check (length(trim(comment)) between 1 and 700),
    created_at timestamptz not null default now()
);

create index if not exists organization_document_comments_org_created_idx
    on public.organization_document_comments (organization_id, created_at desc);

alter table public.organization_document_comments enable row level security;

drop policy if exists "Assigned organization members can view document comments" on public.organization_document_comments;
create policy "Assigned organization members can view document comments"
    on public.organization_document_comments
    for select
    to authenticated
    using (
        (select public.is_isoms_admin())
        or exists (
            select 1
            from public.profiles
            where id = (select auth.uid())
              and role in ('officer', 'adviser')
              and account_status = 'active'
              and lower(organization_id) = lower(organization_document_comments.organization_id)
        )
    );

grant select on public.organization_document_comments to authenticated;

create or replace function public.submit_adviser_document_comment(
    p_document_id uuid,
    p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    document_record public.organization_documents%rowtype;
    adviser_name text;
    normalized_comment text := trim(coalesce(p_comment, ''));
begin
    if p_document_id is null then
        raise exception 'A document must be selected.';
    end if;
    if length(normalized_comment) not between 1 and 700 then
        raise exception 'Comments must be between 1 and 700 characters.';
    end if;

    select documents.*
    into document_record
    from public.organization_documents as documents
    join public.profiles as adviser
      on adviser.id = (select auth.uid())
     and adviser.role = 'adviser'
     and adviser.account_status = 'active'
     and lower(adviser.organization_id) = lower(documents.organization_id)
    where documents.id = p_document_id;

    if not found then
        raise exception 'This document is not assigned to your adviser account.';
    end if;

    select coalesce(nullif(display_name, ''), email, 'Organization adviser')
    into adviser_name
    from public.profiles
    where id = (select auth.uid());

    insert into public.organization_document_comments (
        document_id, organization_id, author_id, author_name, comment
    )
    values (
        document_record.id,
        document_record.organization_id,
        (select auth.uid()),
        adviser_name,
        normalized_comment
    );

    insert into public.organization_notifications (organization_id, type, message, created_by)
    values (
        document_record.organization_id,
        'adviser_comment',
        left('Adviser comment on ' || document_record.document_type || ' (' || document_record.file_name || '): ' || normalized_comment, 1000),
        (select auth.uid())
    );
end;
$$;

revoke all on function public.submit_adviser_document_comment(uuid, text) from public;
grant execute on function public.submit_adviser_document_comment(uuid, text) to authenticated;

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

    if p_status = 'approved' then
        insert into public.organization_notifications (organization_id, type, message, created_by)
        values (
            trim(p_organization_id),
            'registered',
            'The organization has been approved and is now registered.',
            (select auth.uid())
        );
    end if;
end;
$$;

revoke all on function public.save_organization_review(text, text, text) from public;
grant execute on function public.save_organization_review(text, text, text) to authenticated;

create or replace function public.submit_organization_resubmission(p_organization_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_organization_id text := trim(coalesce(p_organization_id, ''));
begin
    if normalized_organization_id = '' or length(normalized_organization_id) > 100 then
        raise exception 'A valid organization ID is required.';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'officer'
          and account_status = 'active'
          and lower(organization_id) = lower(normalized_organization_id)
    ) then
        raise exception 'Only the active officer assigned to this organization can resubmit it.';
    end if;

    update public.organization_reviews
    set status = 'pending',
        revision_note = '',
        updated_by = (select auth.uid()),
        updated_at = now()
    where lower(organization_id) = lower(normalized_organization_id)
      and status = 'revision';

    if not found then
        raise exception 'This organization is not currently marked as needing revision.';
    end if;

    insert into public.organization_notifications (organization_id, type, message, created_by)
    values (
        normalized_organization_id,
        'resubmitted',
        'The organization submitted revised information for administrator review.',
        (select auth.uid())
    );
end;
$$;

revoke all on function public.submit_organization_resubmission(text) from public;
grant execute on function public.submit_organization_resubmission(text) to authenticated;

-- After creating your own account, run this once in the SQL Editor.
-- Replace the email below with the email used for your first administrator account.
-- Keep this bootstrap statement private and remove it after the initial admin is assigned.
-- update public.profiles
-- set role = 'administrator', account_status = 'active'
-- where email = 'your-admin-email@example.com';
