# Recovery notes

## Database migration drift

Authenticated CI exposed that the committed Supabase migration directory cannot currently recreate Khonsera from a clean database.

Observed failure: a clean local `supabase start` reaches `0015_default_flight_origin.sql` and fails because `transport_hubs` does not exist, even though later committed migrations also alter/index that table.

Production's `supabase_migrations.schema_migrations` ledger contains historical timestamped migrations that are absent from or no longer align with the current Git migration directory, including transport-hub seed/setup and train-journey-detail migrations. Production therefore has schema state that the repository alone cannot reproduce.

Recovery requirement:

- compare the full remote migration ledger with Git;
- capture the current remote schema into a reviewed migration/baseline using the supported Supabase workflow;
- reconcile missing/out-of-band historical changes without resetting or destructively rebuilding production;
- prove `supabase db reset` succeeds from a clean clone;
- only then make full migration replay a CI gate.

The authenticated browser E2E fixture is intentionally isolated from this problem and is not a substitute for repairing canonical database history.
