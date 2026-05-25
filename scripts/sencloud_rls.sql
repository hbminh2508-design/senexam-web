-- SenCloud RLS policies
-- Run in Supabase SQL Editor

-- Optional: inspect current rows before changing policies
-- select id, name, created_by from public.library_folders order by created_at desc;
-- select id, title, created_by from public.library_documents order by created_at desc;

create or replace function public.is_library_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'collab')
  );
$$;

alter table public.library_folders enable row level security;
alter table public.library_documents enable row level security;

-- Clean up older policies first
 drop policy if exists library_folders_select_shared on public.library_folders;
 drop policy if exists library_folders_update_shared on public.library_folders;
 drop policy if exists library_folders_delete_shared on public.library_folders;
 drop policy if exists library_documents_select_shared on public.library_documents;
 drop policy if exists library_documents_update_shared on public.library_documents;
 drop policy if exists library_documents_delete_shared on public.library_documents;

-- Shared visibility
create policy library_folders_select_shared
on public.library_folders
for select
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

create policy library_documents_select_shared
on public.library_documents
for select
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

-- Shared edit: anyone can update shared items, owner/staff can update own items too
create policy library_folders_update_shared
on public.library_folders
for update
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
)
with check (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

create policy library_documents_update_shared
on public.library_documents
for update
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
)
with check (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

-- Shared delete: anyone can delete shared items, owner/staff can delete own items too
create policy library_folders_delete_shared
on public.library_folders
for delete
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

create policy library_documents_delete_shared
on public.library_documents
for delete
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_library_staff()
);

-- If you want to convert existing admin-owned items to shared, uncomment and run carefully:
-- update public.library_folders set created_by = null where created_by in (
--   select id from public.profiles where role in ('admin', 'collab')
-- );
-- update public.library_documents set created_by = null where created_by in (
--   select id from public.profiles where role in ('admin', 'collab')
-- );
