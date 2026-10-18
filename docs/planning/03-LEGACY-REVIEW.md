# Review of the archived application

Reviewed editable C#, PowerShell, JSON, SQL, tests, engineering docs and knowledge-base files. Runtime payloads were inventoried and hashed; the two app EXEs were checked as Windows AMD64 PE files. DLLs were not reverse-engineered, and this is not a fresh Windows execution or vulnerability audit.

## Useful baseline

The existing app implements a WinForms UI, independent service, SLMP 3E TCP binary/ASCII scalar reads, multiple PLCs, repeated/mixed sensor configuration, scaling, UTC/quality, SQLite WAL buffering, CSV and an HTTPS uploader with explicit event acknowledgments. These behaviors are visible in source. It includes runtime DLLs and compiled EXEs, not a single ready-made installer named ArcadeOT-windows-x64.exe.

The original source is about 33 KB across its four principal C# files. It is a compact commissioning implementation, not a finished universal gateway. Its docs already distinguish implemented connectivity from hardware validation.

## Improvements grounded in source

| Priority | Existing behavior / source locator | Replacement action and verification |
|---|---|---|
| P0 | `app/src/ArcadeOT.Core/Models.cs`, GatewayConfig.Validate assumes non-null collections/elements; normal deserialization ignores unknown properties | Strict DTO/schema + semantic validation; reject nulls, unknown fields and malformed bounded payloads with controlled errors |
| P0 | `app/src/ArcadeOT.Service/Program.cs`, `/config` guards ContentLength only when present; cloud credential body and upload response are read before explicit size validation | Enforce actual streamed byte limits, bounded JSON depth and bounded responses; test chunked/oversized requests |
| P0 | `Runtime.Status` is one shared string written by independent workers | Per-PLC and storage/cloud health, derived aggregate state; one healthy worker cannot hide another PLC's storage/fault state |
| P0 | `Uploader` retries the earliest 100 pending rows every 5 seconds; no permanent-rejection isolation | Backoff/jitter and preserved quarantine/replay workflow; rejected head batches cannot indefinitely hide later valid data |
| P0 | No fresh Windows installer/boot or physical PLC execution evidence | Exact hardware reads and Windows boot/recovery gates before claiming production readiness |
| P1 | WinForms model is free text; no actual model catalog or physical module/terminal fields | Evidence-backed catalog plus custom unverified entries; physical pin-to-memory mapping remains explicit |
| P1 | Site ID, deletion and storage settings rely on advanced JSON | Ordinary controls for all configuration, schema-driven validation and import/diff/history |
| P1 | One scalar request and one SQLite connection/insert per sensor; entire export materialized under a shared lock | Measure load; bounded batching, persistence writer/query paging and streamed export after correctness gates |
| P1 | Local-only operation never acknowledges pending rows, so export alone cannot prevent eventual queue quota | Explicit local archive/retention mode with visible policy; do not fake cloud ACKs |
| P1 | All UI use requires administrator; bearer token is a shared privileged secret | Role-aware local authorization with protected IPC/broker design; test unauthorized access |
| P1 | RawHex and config revision are persisted but absent from live rows/CSV fields | Useful diagnostics and provenance-aware exports without secret exposure |
| P1 | Config is replaced but has no durable revision history or rollback UI | Validated immutable history, audit and tested restoration/migration |
| P1 | `Install.ps1` copies payload in place; no transaction/rollback or signed EXE installer | MSI/Burn packaging, payload signing, clean upgrade and failed-upgrade rollback |
| P1 | Integration Python harness has hardcoded paths to a prior workspace | Portable CLI-driven harness, dynamic endpoint/data paths and cleanup |
| P1 | No SDK pin, dependency lock, solution or CI configuration in supplied source | Pin and audit build inputs; Windows build/release pipeline and reproducibility evidence |

Locator paths above are relative to `archive/legacy-handoff/`. Findings are review conclusions, not newly reproduced fault-test results. Do not turn planning into an unsupported claim that the old app has been fully runtime-tested here.

## Preservation and cleanup

Both legacy package checksum manifests remain intact. Keep their bundled DLLs together; removing apparently unused framework assemblies can break the self-contained applications. The exact-duplicate top-level commissioning guide and Finder metadata were the only removed files. The archived handoff retains the original guide and all source. The old package's instructions no longer drive the replacement scope.
