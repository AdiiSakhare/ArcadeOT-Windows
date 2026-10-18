# ArcadeOT 0.3 — Windows x64 installation build

The download `ArcadeOT-windows-x64.exe` is a native Windows installer containing the desktop, independent Windows Service and bundled .NET runtime. Copy that single EXE to a **Windows 11 Intel/AMD x64** PC and open it. Approve normal administrator elevation, choose Install/update and then Open workspace. No manual ZIP extraction or PowerShell commands are needed with the EXE installer.

The EXE is Windows software; it does not run on macOS. The installer and app are unsigned. Windows execution/visual/installer/boot and physical PLC gates have not been performed in the Mac build environment. This is a compiled installation build, not a hardware-certified production release.

## Installation and recovery

Files: `%ProgramFiles%\ArcadeOT2`. Data: `%ProgramData%\ArcadeOT2`. Collector: automatic Windows Service `ArcadeOT2`, independent of desktop login/window lifetime. Local API: authenticated `127.0.0.1:17846`. This is separate from any v1 installation; no old measurement database is overwritten or automatically migrated.

Setup verifies the embedded ZIP SHA-256 and every payload file, extracts into a new administrator/SYSTEM-only directory, backs up existing data after stopping the service, swaps binaries and checks service health before reporting completion. Start menu/desktop entries and Windows Installed Apps removal are registered. Re-running the same/newer installer repairs or updates the binary payload while preserving configuration/history. Binary rollback is attempted if an upgrade fails; data snapshots remain protected for explicit recovery. Downgrades are refused. Inspection is required if a previous failed staging/backup directory remains.

Setup logs remain in `%ProgramData%\ArcadeOT-Setup-<random>\setup.log`; successful staging payloads are cleaned. Data snapshots remain under `%ProgramData%\ArcadeOT2\backups`. Setup does not reset PLC parameters, configure electrical I/O or enable a disabled PLC listener.

For the developer payload ZIP only, installation is also available through elevated Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
```

## Configure the installation in the app

1. Add controller; select family/profile and enter exact model/firmware/interface, actual IP/host and configured port. Configure SLMP encoding/poll/deadline.
2. Add sensors individually, by repeated group or CSV preview. Enter the approved address/type/order/scaling/unit/limits. D/M labels are decimal; X/Y labels are octal.
3. Enter physical module, slot, channel, terminal/pin, common, signal range, sensor model and manual edition/page under I/O references. These are unverified operator references, separate from network memory mappings.
4. Review/save; optionally read the first saved mapping. Enable collection only after confirming the actual listener and PLC application map. Observe Live monitor and History.
5. Site & delivery exposes site ID, storage, retention, HTTPS URL/token, import/export, config history/restore and quarantine retry. Legacy v1 configuration import preserves IDs and disables acquisition for review.

Only direct SLMP 3E TCP binary/ASCII reads are implemented. Other families are research-only and cannot collect. No exact hardware tuple is yet qualified. The desktop currently requires elevation; non-admin role-aware access remains pending.

## Storage and cloud

Unsent events never expire automatically, including local-only operation. CSV export does not acknowledge them. At buffer/free-disk limits, collection pauses visibly and cannot recover states missed while paused. Cloud delivery needs a compatible deployed HTTPS ingestion API, not supplied by this installer. HTTP 400/409/422 rejected batches are preserved in quarantine for review/retry.

Before production use, validate actual raw/scaled values, reconnect, UI closure, crash/recovery, boot without login, backup/restore and real cloud replay. A successful build is distinct from these operational checks.
