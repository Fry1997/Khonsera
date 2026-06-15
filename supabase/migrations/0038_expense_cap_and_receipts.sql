-- 0038 — Expenses depth (Phase 16): a per-trip spend cap + a private receipts bucket.
alter table itineraries add column if not exists expense_cap numeric(10,2);
alter table itineraries add column if not exists expense_cap_currency text not null default 'GBP';

-- Receipt files — private bucket; each file lives under the owner's uid folder.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Owner-only access to receipts (path = "{uid}/..."). RLS on storage.objects.
create policy "receipts owner read" on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner write" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner update" on storage.objects for update
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner delete" on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
