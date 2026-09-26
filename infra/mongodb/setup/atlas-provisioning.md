# Atlas provisioning runbook

1. Create the cluster on **Google Cloud, asia-southeast1**. Start on **M0**; upgrade to **M10** only if
   change streams or connection limits force it (one dropdown). Confirm M0 availability in the region and
   its change-stream and connection limits before relying on it.
2. Create one database user for `sentinel-core` (readWrite on `sentinel`) and one for `sentinel-stream`
   (read on `sentinel`). No shared admin credentials.
3. Restrict network access. The documents call for "the Cloud Run egress range": Cloud Run has no fixed egress
   IP by default, so this needs Direct VPC egress with Cloud NAT and a static IP — decide at build order step 3.
4. Store each connection string in Secret Manager (`../../secret-manager/README.md`). Never in the repository,
   never in `.env` committed anywhere.
5. Create indexes by running `ensureIndexes()` (`apps/core/src/infrastructure/database/mongodb/indexes/`) once
   against the provisioned cluster. Creating an index also creates its collection.

## The eleven collections

`accounts`, `transaction_events`, `transactions`, `security_events`, `decisions`, `assessments`,
`interventions`, `alerts`, `cases`, `entities`, `entity_edges`.

`decisions`, `alerts` and `interventions` are watched by `sentinel-stream` through change streams.
