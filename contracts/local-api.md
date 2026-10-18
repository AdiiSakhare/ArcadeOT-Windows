# ArcadeOT 2 local API (implemented preview)

Default bind: `http://127.0.0.1:17846`. Every request requires `X-ArcadeOT-Key` from the protected ArcadeOT2 data directory. No CORS or remote binding. Config and result fields use PascalCase. Body limit: 2,000,000 actual bytes enforced by Kestrel, including chunked requests. Credentials: maximum 8192 bytes. Unknown config fields and invalid/null structures are rejected.

| Method | Path | Behavior |
|---|---|---|
| GET | /health | Aggregate state, per-PLC status/cycle time, buffer/quarantine counts and upload state |
| GET | /catalog | Profile choices and independently labelled implementation status |
| GET | /config | Active version 2 configuration without credentials |
| POST | /config | Strict validation; persist immutable new revision; apply new worker generation |
| GET | /config/history | Latest 50 revision IDs and UTC save times |
| POST | /config/restore/{revision} | Restore stored content as a new revision |
| GET | /live | Persisted observations with stale quality overlay |
| GET | /history?before={sequence}&limit={count} | Descending sequence cursor; count clamped to 1–10,000, default 200 |
| GET | /export.csv | Latest 10,000 observations with raw hex, quality, source/config provenance |
| POST | /plcs/{id}/test | Read first saved mapping, validate actual connection settings, persist result; no PLC writes |
| POST | /cloud-credential | Plaintext token body; separate protected storage, never returned |
| POST | /quarantine/retry | Return preserved rejected events to upload eligibility |

Config revision is the immutable database audit reference. Test-read uses its saved mapping and revision. Service identity/data directory is ArcadeOT2, separate from v1. Environment overrides ARCADEOT_DATA_DIR and ARCADEOT_LOCAL_URL exist for isolated development/test use; installed service should use defaults. Local URL override must remain IPv4 loopback.

The copied ingestion.openapi.json remains wire version 1 because measurement/batch fields remain compatible. The archived `driver-reference.v1.cs` is historical contract material; actual v2 interfaces live in src/ArcadeOT.Domain. Data migration of old SQLite is not implemented; configuration import supports strict v1→v2 conversion in the desktop with migrated PLCs disabled for review.
