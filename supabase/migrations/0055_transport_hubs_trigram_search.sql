-- 0055 — Trigram search for the 11k-row transport_hubs catalogue.
--
-- Station/airport search ran THREE serial ilike queries (code prefix, name prefix,
-- substring fallback), each a kind-index scan + filter over ~2.6k rail rows (~31ms
-- measured) — a per-keystroke grind. Trigram GIN indexes turn name/code ilike
-- (prefix AND substring) into single-digit-ms bitmap scans, so searchTransportHubs
-- collapses to ONE fast query (measured 31ms → 0.6ms).
create extension if not exists pg_trgm;
create index if not exists transport_hubs_name_trgm on transport_hubs using gin (name gin_trgm_ops);
create index if not exists transport_hubs_code_trgm on transport_hubs using gin (code gin_trgm_ops);
