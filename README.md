# ArcadeOT 2 for Windows x64

New WPF industrial workspace and independent Windows collector service, version **0.3.0 installation build**. Built from the clean replacement workspace; archived packages remain unchanged.

## Current delivery

- Configurable site, controller family/profile, exact CPU model, firmware, host/IP, TCP port, SLMP frame encoding, polling/deadline and enabled state.
- Sensor grid with stable IDs, type/order/scaling/units/limits, repeated groups, CSV preview/import and separate physical module/slot/channel/terminal/sensor/manual references.
- Read-only SLMP 3E TCP binary/ASCII driver; other family profiles are labelled research-only and cannot collect.
- Independent per-PLC collection, quality/staleness, durable SQLite measurements/outbox, configuration revision history/restore, cursor history and CSV export.
- Optional HTTPS uploader with per-event ACK, bounded response handling, backoff and preserved rejected-batch quarantine/retry.
- A native single-download Windows installer with protected extraction, checksums, install/update/repair, backups, service health checks, Start menu and Installed Apps integration. The managed runtime is bundled.

Physical I/O metadata is operator-entered and unverified; selecting pins does not configure PLC hardware or infer register mappings. The new database/service identity is **ArcadeOT2**, separate from v1. V1 configuration import preserves IDs and disables acquisition for review; old measurement database migration is not implemented.

## Run the preview

[**Download ArcadeOT-windows-x64.exe**](artifacts/ArcadeOT-windows-x64.exe). Copy it to a Windows 11 Intel/AMD x64 PC and open it. No separate runtime, ZIP extraction or manual PowerShell invocation is required. See [installation and configuration instructions](packaging/windows/START-HERE.md).

The installer was cross-compiled on macOS using a checksum-verified LLVM-MinGW toolchain. Application builds, protocol/storage/delivery checks, local service integration and installer archive checks passed. **The build is unsigned, and Windows UI/install/boot and physical PLC validation remain pending.** It is a Windows executable, not a macOS application.

The planned MSI/Burn packaging was adapted to a native Win32 bootstrapper after the user confirmed there was no Windows machine/repository and requested building without one. Collection, storage, configuration and service architecture follow the existing plan. See [installer evidence and limits](docs/validation/INSTALLER-BUILD.md).

## Development

```sh
dotnet restore ArcadeOT.slnx --locked-mode
dotnet build ArcadeOT.slnx -c Release --no-restore
dotnet run --project tests/unit/ArcadeOT.Checks -c Release --no-build
python3 tests/integration/service_integration.py
```

Use `python3 scripts/verify_build.py --dotnet /path/to/dotnet` for build, core checks, isolated service integration and a fresh transitive dependency audit. Windows CI entry point: `scripts/Build-Windows.ps1`. macOS publishing: `scripts/publish_windows.py` followed by `scripts/build_installer.py` after verification; the pinned compiler fetch helper requires Python with safe archive extraction support. No physical PLC is contacted by automated fixtures. Installed users do not need the development SDK.

## Documentation

- [Implementation status and remaining gates](docs/validation/BUILD-STATUS.md)
- [Folder map](docs/planning/01-FOLDER-STRUCTURE.md)
- [Build plan](docs/planning/02-BUILD-PLAN.md)
- [Configuration requirements](docs/product/CONFIGURATION-REQUIREMENTS.md)
- [Local API](contracts/local-api.md)
- [Schema versions](schemas/README.md)
- [Research update](research/RESEARCH-UPDATE.md)
- [Original preservation audit](docs/validation/WORKSPACE-AUDIT.md)

`archive/legacy-release/` and `archive/legacy-handoff/` retain all 700 original package files. The new app has not yet passed the gates required to retire those recovery copies.
