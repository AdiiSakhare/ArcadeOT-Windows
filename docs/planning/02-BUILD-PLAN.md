# Recommended plan for ArcadeOT-windows-x64.exe

18 October 2026. Proposal for a new, improved application, following the user's preference to replace the old app. Folder organization and the first v0.2.0 WPF/service implementation are complete. This plan remains the roadmap; see ../validation/BUILD-STATUS.md for actual build/test evidence and remaining gates. The old release remains recoverably archived.

## Packaging adaptation — 0.3.0

The user confirmed no Windows build machine/repository is available and explicitly requested building the EXE without that infrastructure. The immediate installer is therefore a native Win32 bootstrapper cross-compiled on macOS with a pinned LLVM-MinGW toolchain. It embeds the self-contained UI/service ZIP, verifies checksums, uses a protected extraction directory and invokes the reviewed installation transaction. This replaces the immediate WiX MSI/Burn tool choice; signing and Windows/hardware operational gates remain separate. The service architecture, user-configurable installation model and read-only acquisition are unchanged. MSI/Burn can be reconsidered when Windows packaging infrastructure is available; it is not falsely presented as the current artifact.

## Product and technical direction

Build a Windows industrial data gateway with a modern configuration desktop and an independent collector service. Recommend C#/.NET 10 + WPF/MVVM for the new UI, SQLite for local durable history/replay, and an optional authenticated HTTPS backend with PostgreSQL. Reuse reviewed protocol knowledge and fixtures from the old source while replacing its monolithic forms and service structure.

The downloadable `ArcadeOT-windows-x64.exe` should be an installer. It deploys two separate applications, UI and service, with self-contained Windows x64 runtime payloads. The service starts at boot without login and continues when the UI closes. WiX MSI + Burn is the recommended installer approach; pin tools and review licensing before adoption. This is an engineering recommendation based on the existing code and [Microsoft Windows Service guidance](https://learn.microsoft.com/en-us/dotnet/core/extensions/windows-service), [self-contained publishing guidance](https://learn.microsoft.com/en-us/dotnet/core/deploying/) and [Burn documentation](https://docs.firegiant.com/wix/tools/burn/).

Avoid making single-file runtime bundling the first release constraint: native dependencies can need extraction, with service-account path and permissions implications. A single installer can contain normal self-contained UI/service folders. See [Microsoft single-file considerations](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview).

## Phase 0 — baseline and repeatable build

- Start a new solution in the prepared `src/` directories; retain the old packages under `archive/`.
- Select an available patched .NET 10 SDK and package set, pin the SDK, create locked restore inputs and a Windows CI build. Audit direct and transitive dependencies; preserve reports with each release.
- Port source-reviewed SLMP framing/decoding tests into the new test layout. Make the old integration harness portable, with isolated temp data, dynamic ports and reliable cleanup.
- Record explicit OS support after checking the selected .NET/runtime support matrix. Initial target is Windows x64; do not imply Windows 7, ARM64 or every Windows Server version support.

Exit: clean-machine restore/build, warnings treated as errors, meaningful codec checks and dependency audit. Compiling Windows targets on macOS is not Windows execution. No migration of production data yet.

## Phase 1 — configuration foundation and catalog

Implement strict, versioned configuration and catalog contracts. Model site → PLC → interface/module → physical channel → sensor → readable mapping → transform. Retain stable IDs and independently version profile/mapping changes. Keep physical terminals separate from memory/tag addresses.

Provide profiles for documented candidates without promising live support. The first runnable driver remains SLMP 3E TCP for appropriately configured FX5U installations. UI controls must be generated or filtered by actual driver capabilities. Add module/terminal choices only with exact source evidence; support clearly marked operator-entered references where the catalog is incomplete.

Reconcile v1 API/SQL/JSON copies under contracts/schemas/config with the new model. Plan deterministic v1→v2 migration, validation report and rollback. A migration must preserve history, IDs and secret isolation; never silently drop unknown configuration fields.

Exit: configure two PLCs, repeated/mixed sensors, modules/channels/terminals, all connection fields, units/scaling, retention and destinations with no code edits. Strict validation handles nulls, malformed types, duplicate IDs, widths, finite values, address syntax and bounded content. Unsupported capabilities cannot be enabled.

## Phase 2 — reliable read-only acquisition

Implement independent per-PLC scheduling, one outstanding transaction per SLMP session, deadlines, reconnect/backoff and fair resource use. Port supported D numeric and M/X/Y Boolean reads with explicit radix/order rules. Keep unimplemented frame/route/device types disabled.

Persist samples before publishing them as current. Distinguish transport, protocol, decode, range and freshness status. Expose per-PLC health, timing/overrun, storage pause and unknown hardware status. Validate on actual FX5U as early as a site is available; generated fixtures support development and do not replace that gate.

Benchmark scalar polling before introducing bounded contiguous reads. Batch only within confirmed readable ranges and response limits; split results by sensor and preserve error provenance. Use a PLC-maintained snapshot/sequence where cross-word/application consistency is required.

Exit: known engineering-tool values agree for types actually used; disconnect/reconnect, multiple-PLC isolation, config replacement and cancellation pass. Captured read-only traffic contains no write or control requests. Record full SKU, firmware, mode and map revision.

## Phase 3 — usable desktop

Implement WPF shell, guided PLC setup, physical I/O reference panel, sensor workspace, bulk generation, CSV import preview, templates and configuration diff/history. Provide first-class controls for every operational setting, including site ID, PLC deletion, storage and credentials. Keep JSON as an optional advanced tool.

Add read-only test connection/sample workflow, live raw/scaled values, history, exports, per-PLC diagnostics and cloud/disk/backlog cards. Preserve keyboard navigation, clear validation, mixed DPI/layout support and visible offline/stale states. Implement roles and authenticated local access without sharing privileged installation credentials with ordinary users.

Exit: a technician configures the eight-temperature and mixed-sensor examples entirely through the UI; malformed imports preserve the existing configuration. Verify on real Windows at representative display sizes and DPI. Closing the UI leaves collection active.

## Phase 4 — durability and SQL/cloud delivery

Version database migrations, config history, operational events and backup/restore. Bound history/export queries and payload/ACK sizes. Measure WAL/index overhead and provide usable retention/backpressure behavior. Decide local-only mode explicitly: today's old queue never clears from CSV export, so a local-only installation needs a deliberate archive/retention policy rather than pretending cloud acknowledgment occurred.

Implement or connect a backend based on the reviewed ingestion contract. Enforce authentication/site authorization, input limits, EventId uniqueness, same-ID/different-content conflict handling and commit-before-ACK. Add retry backoff/jitter and explicit permanent-error quarantine with operator visibility; preserve rejected records and reasons.

Exit: cloud outage/replay, partial/duplicate ACK, conflicting IDs, expired credential, malformed/oversized response, TLS failure, disk quota/full, service crash and consistent backup/restore pass. No silent deletion or good-zero substitution.

## Phase 5 — installer and pilot

Build MSI + EXE bundle with per-machine installation, service account/ACL provisioning, automatic startup, recovery, shortcuts, repair, upgrade and uninstall. Preserve user data, back up before migrations and exercise rollback. Separate installation elevation from routine viewing/configuration privileges. Sign payloads and packages using a protected signing workflow; keep private keys outside this project. See [WiX signing guidance](https://docs.firegiant.com/wix/tools/signing/).

Exit: fresh Windows install, UI use, no-login reboot, service recovery, upgrade, failed-upgrade rollback and uninstall/data-retention checks. Run a monitored site pilot against approved mappings. Proposed initial soak target: 72 hours plus outage/replay and controlled restart tests; site throughput/load criteria must be agreed and measured, not inferred from configured sensor limits.

Release artifacts: installer, checksums, versioned source, reproducible build/dependency reports, operator guide, supported-model matrix and exact hardware test evidence. Only after replacement acceptance should the old app be moved from the project archive to the OS Trash or removed under the agreed retention policy.

## Phase 6 — broaden tested PLC support

Add protocols driven by customer hardware: Modbus TCP, then RTU where serial adapters/bus ownership are known, then OPC UA using a maintained SDK. S7, CIP and FINS follow exact documentation, library licensing and hardware requirements. Each driver gets structured config, capability metadata, malformed-frame/decoding/reconnect tests and its own hardware qualification record. Brand names alone never imply support.

The existing matrix covers research candidates for Mitsubishi, Siemens, Delta, Schneider, Omron and Rockwell. It is not a completed device catalog. Sensor-model datasheets and pin diagrams can be populated as exact catalog models are added, while every installation remains user-configurable.

## Definition of done

A user installs one EXE, configures PLC/model/IP/module/pins/mappings/sensors through the desktop, observes correct raw and formatted data, and exports or uploads SQL-compatible events. Collection survives UI closure and Windows reboot. Offline records replay without silent loss or duplicate sink rows. Supported hardware is explicitly tested, unsupported options are clearly identified, and upgrades preserve configuration/history with a recovery path.

Dependencies that public research cannot supply: a Windows test environment, access to exact PLC/firmware tuples for qualification, approved PLC application maps, any proprietary protocol/license access, cloud deployment credentials and a signing identity. These are commissioning/deployment inputs, not hardcoded product defaults.
