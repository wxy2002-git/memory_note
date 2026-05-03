-- Re-run this if the database tables exist but the Supabase Storage bucket is missing.
-- Expected bucket: note-assets, private.

insert into storage.buckets (id, name, public)
values ('note-assets', 'note-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "note_assets_select_own" on storage.objects;
create policy "note_assets_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_insert_own" on storage.objects;
create policy "note_assets_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_update_own" on storage.objects;
create policy "note_assets_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "note_assets_delete_own" on storage.objects;
create policy "note_assets_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'note-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
