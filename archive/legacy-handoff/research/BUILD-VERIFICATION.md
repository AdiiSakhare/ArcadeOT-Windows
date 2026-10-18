# Build verification — 18 October 2026

Executed on macOS arm64 with official .NET SDK 10.0.402. Windows x64 cross-publish is not Windows execution.

Passed:
- Desktop and service Release builds, zero warnings/errors (warnings treated as errors).
- Self-contained Windows x64 publishing of arcadeOT.exe and ArcadeOT.Service.exe with runtime DLLs.
- Core request/response, address, type, configuration, fragmented transport, end-code, disconnect and deadline checks in app/tests/ArcadeOT.Checks.
- Isolated local service integration: missing token rejected, invalid config rejected, config apply, real driver exchanging constructed local SLMP fixture frames, scale/quality, CSV export, SQLite persisted rows and service-process restart preserving rows. No physical PLC was contacted.
- Dependency audit including transitive dependencies reported no known vulnerable packages for the final resolved service dependencies. The earlier SQLite version was replaced after audit failure; warnings were not suppressed.
- JSON parse, disabled sample config shape/count checks, SQLite DDL execution, vector consistency, ZIP integrity and Windows PE architecture checked during packaging.

Not executed: Windows desktop visual/interactive test, PowerShell installer/service registration, no-login Windows boot, physical FX5U reads/wiring/firmware behavior, calibrated sensor validation, real HTTPS cloud ingestion deployment, long-run/power-loss/load testing. See docs/07_ACCEPTANCE.md and docs/08_HARDWARE_VALIDATION_RECORD.md.

No claim of hardware-certified or universal PLC compatibility is made. Release contains read-only SLMP TCP 3E binary/ASCII support; other protocols are research/planned.
