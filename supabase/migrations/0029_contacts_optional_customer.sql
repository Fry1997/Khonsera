-- Personal contacts captured via Tell Khonsera (e.g. "meet Derek") don't
-- belong to a customer. Make contacts.customer_id nullable so a contact can
-- exist at the workspace level without a customer. The FK + ON DELETE CASCADE
-- stay intact for contacts that DO belong to a customer.
ALTER TABLE public.contacts
  ALTER COLUMN customer_id DROP NOT NULL;
