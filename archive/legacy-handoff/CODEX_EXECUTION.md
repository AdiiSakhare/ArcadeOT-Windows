# Detailed Codex execution instructions

## First action and deliverable

Open docs/00_TODAY_FX5U.md and app source. This handoff includes an actual compiled first Windows release in the companion ZIP, not only a software proposal. Continue from that implementation. The human priority is configuring and reading a real FX5U today. No simulated live data may be substituted. All endpoints and sensor maps must be edited via the form; do not ask for a fixed IP/address just to hardcode them.

## Repository orientation

- Core/Models.cs: shared version-1 config, records, validator and IPlcDriver.
- Core/Slmp.cs: direct TCP binary/ASCII 3E parser and read-only scalar codec.
- Service/Program.cs: authenticated local API, independent per-PLC polling, SQLite/outbox and HTTPS uploader.
- Desktop/Program.cs: configuration grid/bulk entry/live dashboard/CSV.
- app/Install.ps1, Uninstall.ps1 and Build-Windows.ps1: deployment/rebuild.
- schemas/, examples/, contracts/: machine-readable handoff.
- knowledge-base/ and research/: sources/capability limits.

## Execute today

1. Verify release checksums. On Windows x64 extract complete companion release, run Install.ps1 elevated, open UI and verify empty/disabled initial config. Do not guess the TCP port. Confirm actual listener/mode with GX Works3 and the site engineer.
2. Enter exact model/firmware, host/port/mode/timeout/poll. Create a known scalar mapping using the PLC application's approved register map; save/enable. Compare raw and engineering values with GX Works3. Then configure mixed/repeated sensors and multiple PLCs as available.
3. Execute disconnect/reconnect, service restart, UI closed and boot-before-login checks. Save observations into docs/08_HARDWARE_VALIDATION_RECORD.md and update only that exact hardware tuple’s status. Record failures with raw end codes and bounded wire captures; do not “repair” the PLC by writes.
4. If any check fails, reproduce the narrow fault, fix code/config with evidence and re-run impacted checks. Preserve measurement history/config. Do not mark real hardware validated based on loopback checks.

## Build and verify

Install .NET 10 SDK for development. Run `dotnet run --project app/tests/ArcadeOT.Checks -c Release`; then `dotnet build` each project. Run app/Build-Windows.ps1 to publish Windows x64 bundled-runtime directories. Copy Install/Uninstall scripts into the release root. Keep all runtime DLLs beside the published EXEs. Runtime users do not need the SDK.

Package restore warnings (including known vulnerable transitive packages) are failures. Update to a verified patched version and record the resolved dependency set instead of suppressing audits. Initial delivery uses SDK 10.0.402 and Microsoft.Data.Sqlite/Microsoft.Extensions.Hosting.WindowsServices 10.0.13 as resolved in this environment; verify availability/audit on rebuild. No source-generator/build-output folder belongs in the source ZIP.

## Complete production scope after physical test

Follow docs/06_ROADMAP.md. Implement HTTPS ingestion endpoint from OpenAPI and PostgreSQL DDL before promising cloud operation. Enforce auth/site scope, durable commit, per-event ACK and duplicate/conflict semantics. Integrate existing ArcadeOT/mobile contracts only after recovering/reading originals. Add role-aware access/audit/config history, robust uploader quarantine/backoff, signing/installer rollback and long-run disk recovery.

Add one future driver at a time from the KB. First obtain the full relevant manuals/authorized library specs when the source register says only an index/excerpt was inspected. Do not build a wire codec from vendor marketing. Add type/malformed-frame vectors and the model/firmware test record. Update schemas/migration rules and prevent selection of unimplemented protocols as if live.

## Completion report

State what changed, build/protocol/Windows/hardware checks actually run, exact verified model tuples, remaining limitations and artifacts. Provide runnable release plus editable source/config/contracts. Do not substitute a plan for requested executable changes. Never describe this first release as universal PLC support or a completed hosted cloud system.
