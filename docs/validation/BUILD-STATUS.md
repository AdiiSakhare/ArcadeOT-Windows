# Version 0.3.0 — build status

18 October 2026. New replacement application implemented and cross-compiled on macOS arm64 with .NET SDK 10.0.402. A single native Windows installer EXE is now compiled and structurally verified; see INSTALLER-BUILD.md. This record supersedes the earlier planning-only status; original archive contents are unchanged.

## Implemented

Seven solution projects: Domain, Application, SLMP driver, Infrastructure, Service, WPF Desktop and automated Checks. Source includes strict version 2 configuration, versioned family profiles, physical I/O reference fields, type-aware sensor groups, CSV preview/import, v1 configuration migration, immutable configuration history/restore and stable IDs.

The independent Windows Service owns read-only SLMP connections, per-PLC scheduling, persistence-before-live reporting, quality/raw/UTC/stale status, storage pause and reconnect. SQLite holds history, outbox and quarantined rejected batches. HTTPS delivery validates bounded per-event ACKs and keeps IDs stable across retries. Desktop includes connection, sensor, I/O, monitor, history and site/delivery workspaces with ordinary controls for runtime settings.

Service/data identity ArcadeOT2, loopback port 17846, separate from legacy. The UI currently requires administrator elevation to access protected installation credentials. Granular operator roles and verified hardware catalogs remain future work. Physical terminal fields are unverified operator references; no automatic hardware/pin configuration is supplied.

## Verification executed

- Full solution Release build, including WPF markup compilation: zero warnings/errors with warnings treated as errors.
- Ported exact binary/ASCII SLMP vectors, signed/unsigned/float/word-order/bit decoding, octal X conversion, fragmented socket response, protocol error, EOF and deadline checks.
- Strict invalid/null/unknown-field/profile/address/scaling validation, repeated sensor stride/IDs, quoted CSV parsing and v1 configuration migration preserving IDs while disabling acquisition.
- SQLite configuration revisions, rejection preserving active config, cursor history, restart persistence, stable replay IDs, ACK/quarantine/retry behavior and refusal of unversioned databases without adding v2 tables.
- Mock HTTP delivery: partial ACK, unsent/duplicate-ID rejection, oversized response bounds, preservation/quarantine and delivery of later eligible records. This is not a deployed HTTPS backend or certificate validation test.
- Local service process integration with constructed SLMP TCP peers: authentication rejection, malformed config rejection, actual chunked request-body limit, scaling/raw/quality, disconnected-controller isolation, I/O metadata, CSV/history, config restore and service-process restart persistence.
- Fresh dependency audit including transitive packages: no known vulnerable packages reported at execution time. Resolved dependency lock files are included.

Evidence: artifacts/build-verification.json, artifacts/core-checks.log, artifacts/service-integration.json and artifacts/package-audit.json. Cross-publish logs, installer-checks.json and installer-verification.json record checksums, source alignment, native PE/resource inspection and 12 unsafe-archive rejection fixtures. No Windows installer execution is claimed.

## Not yet validated / completed

- Actual Windows desktop interaction, accessibility/DPI and visual review. WPF markup compilation is not a screenshot or usability test.
- PowerShell installation, ACL/service registration, upgrade/binary rollback, uninstall, recovery and boot-before-login on Windows. Scripts exist; execution is pending.
- Physical FX5U values, exact model/firmware compatibility, electrical references, calibrated signal correctness and real PLC load.
- Hosted ingestion deployment, real TLS/cloud replay, database service/site authorization and long-running/power-loss behavior.
- Authenticode signing and MSI/Burn packaging. ArcadeOT-windows-x64.exe is now produced as a native Win32 bootstrapper with the self-contained payload embedded. Windows execution/upgrade/rollback verification remains pending.
- Non-admin roles, verified module/pin catalogs, new Modbus/UA/S7/CIP/FINS drivers, automatic v1 history-database migration, optimized batching and a local-only archive policy.

No exact PLC/firmware tuple is hardware validated. Other brand selections are research-only. Unsent events never automatically expire; CSV export does not acknowledge them. Storage limits pause collection visibly, including local-only installations. Rejected batch quarantine retains data and requires operator review before retry.

## Immediate next validation sequence

Install the preview on a Windows x64 test PC, inspect the new WPF setup and edit/save/import workflows, verify service/ACL/API behavior, then commission an actual FX5U using its configured listener and approved PLC map. Record raw/scaled comparison, disconnect/reconnect, UI closed, no-login reboot and recovery outcomes before promoting compatibility. Preserve the legacy archive until replacement acceptance.
