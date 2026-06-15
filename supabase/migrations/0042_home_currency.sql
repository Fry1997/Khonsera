-- 0042 — Home currency (Phase 19, international). The traveller's home currency,
-- so foreign spend reads in £ everywhere. Defaults GBP; owner edits via settings.
alter table profiles add column if not exists home_currency text not null default 'GBP';
