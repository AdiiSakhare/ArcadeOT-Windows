# ArcadeOT 2 — Windows x64 commissioning preview

This is the new WPF application, version 0.2.0. Keep the complete `ui/` and `service/` folders together. The .NET runtime is bundled; a separate SDK/runtime installation is not required for the target PC.

Extract the ZIP to a local directory. Open Windows PowerShell as Administrator and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
```

The installer provisions `ArcadeOT2`, an independent automatic Windows Service, and opens the elevated desktop. Data lives in `%ProgramData%\ArcadeOT2`; files in `%ProgramFiles%\ArcadeOT2`; authenticated API at `127.0.0.1:17846`. This preview is separate from any v1 service/data. There is no automatic v1 data migration. Existing legacy source/release remains recoverable.

1. Add controller; select the family/profile and enter exact model/firmware/interface, actual IP/host and configured TCP port. Configure frame encoding/poll/deadline.
2. Add sensors individually, by repeated group or CSV preview. Enter approved register/type/order/scaling/unit and optional limits. D/M labels are decimal; X/Y are octal.
3. Use I/O references for module, slot, channel, terminal/pin, common, signal range, sensor model and manual edition/page. These are unverified installation references, not remote electrical configuration or automatically inferred registers.
4. Save and apply; optionally test the first saved mapping. Enable only after confirming the actual PLC listener and approved memory map. Observe Live monitor, per-PLC health and History.
5. Site & delivery controls expose site ID, retention, buffer cap, HTTPS URL/token, config import/export/history restore and quarantine retry. CSV sensor import requires Name,Address,Type headers. A template is supplied in the source workspace.

Only direct SLMP 3E TCP binary/ASCII reads are implemented. Other family choices are research-only and cannot collect. All exact hardware tuples remain unqualified until tested. No writes, resets, run/stop, password unlock or broad discovery are supplied.

Unsent events do not expire automatically, including in local-only operation. CSV export does not acknowledge records. At storage limits, collection pauses; it cannot reconstruct changes missed while paused. Cloud delivery requires a deployed compatible API, not supplied here. Rejected HTTP 400/409/422 batches are preserved in quarantine. Correct the backend/configuration before retrying them.

This package is unsigned. Compilation and local fixture tests do not establish Windows UI/installer/boot or physical PLC validation. Complete these gates before production deployment: exact-value comparison with engineering tool, disconnect/reconnect, close UI, service crash/recovery, reboot without login, backup/restore and cloud replay. The target signed MSI/EXE installer remains a later packaging milestone; this preview uses PowerShell.
