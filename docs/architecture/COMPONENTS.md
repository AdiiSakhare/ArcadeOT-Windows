# Recommended component ownership

Implemented v0.2.0 baseline: .NET 10, WPF with MVVM, an independent Windows Service, SQLite local persistence and authenticated HTTPS ingestion to a PostgreSQL backend when that backend is implemented. Confirm a currently available patched SDK/package set during bootstrap; archived 10.0.13 versions are not automatically endorsed for future builds.

Desktop calls application-facing service APIs and never opens a PLC or writes SQLite directly. Service owns lifecycle and schedules. Domain holds protocol-neutral measurement/configuration concepts. Application coordinates validation, polling, persistence and replay. Infrastructure owns SQLite, bounded HTTP, secrets, diagnostics and OS adapters. Each driver owns wire framing and read decoding only.

Prefer extending source-reviewed legacy algorithms over importing the old monolithic Programs wholesale. Preserve useful protocol fixtures with their provenance. Introduce generic interfaces only when needed by the first concrete driver; do not create a speculative plugin framework or load arbitrary external code.

Catalog data is versioned separately from runtime settings. Record profile ID/version and mapping revision with configuration history. A catalog entry carries exact CPU/interface scope, sources, verification depth, supported address rules and independent driver/hardware status. Module terminal metadata and sensor datasheets are linked reference data. Installed sites retain the profile snapshot used for commissioning.

Use service-side strict DTO validation, finite/type/range checks, semantic address validation and bounded bodies. Design authenticated IPC for non-admin roles without exposing the privileged service token. Assess a Windows ACL-controlled named-pipe transport or a broker before changing the existing loopback design. Keep remote access disabled by default.

Storage commits measurements and replay eligibility durably. Add schema migrations, configuration history, event/diagnostic tables, per-PLC status and explicit failed-upload handling. Quarantine preserves events and reasons; it never silently deletes unacknowledged data. Calculate storage policy using measured payload/index/WAL overhead.

See the build plan for sequence and acceptance. These boundaries are represented by solution projects. See ../validation/BUILD-STATUS.md for implemented scope and pending hardening.
