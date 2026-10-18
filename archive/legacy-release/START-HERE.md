# Today: install and connect to a real FX5U

## What to install

Use the companion ArcadeOT-Windows-x64 ZIP on a Windows x64 PC. Extract the entire ZIP to a local folder. Keep both `ui` and `service` directories intact: the EXEs depend on the bundled DLLs. No .NET SDK or separately installed runtime is required. The binaries are unsigned. Windows SmartScreen or organizational policy may require your normal application approval process.

Open Windows PowerShell **as Administrator**, change to the extracted folder and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
```

The execution-policy override is confined to that invocation. The installer copies files into Program Files/ArcadeOT, creates the ArcadeOT Windows Service under LocalService, configures automatic boot startup and restart recovery, creates an administrator-only data directory in ProgramData/ArcadeOT, adds a desktop shortcut and opens the UI. This is a PowerShell installer, not a signed MSI. Existing config/data are retained on reinstall. Close the UI before upgrades. A failed install must be corrected before PLC testing; inspect service status and Windows Event Viewer.

## Confirm the PLC setup in GX Works3

Identify the complete FX5U order code and firmware. In the built-in Ethernet settings, confirm its IPv4 address, subnet and SLMP server TCP connection/open setting, selected communication data code and configured local port. GX Works3 wording differs by version; use the Ethernet/Communication manual for your CPU and tool edition. Do not treat port 5000 as a universal default. The app cannot remotely enable a disabled SLMP listener. Remote password/IP filtering may block access; this first app does not unlock PLC remote passwords. A PLC parameter download/reset is a site-controlled operation, performed by the PLC engineer in an appropriate machine state.

The PC must have a reachable route to the PLC and a nonconflicting IP address. No inbound PLC-network port needs to be exposed by the app. Its UI/service API binds only to 127.0.0.1:17845. Protocol requests go outbound to the configured PLC port. Match TCP, frame and code mode on both sides; a successful ping alone is insufficient.

## Configure entirely in the app

1. Add a uniquely named PLC. Enter its actual IP/host, SLMP TCP port, full CPU model and firmware. Select Binary, AsciiOctal or AsciiHex matching the PLC communication-data-code setting. Direct CPU routing is fixed; routed networks and 1E/4E/UDP are not implemented.
2. Set a poll interval (minimum 250 ms; start at 1000 ms) and timeout (default 3000 ms). Add sensors using the grid or Add repeated sensors. Each sensor has stable ID, display name, address, type, scale, offset, unit, optional limits and optional 32-bit word swap. Remove grid rows with Delete. Mixed and repeated sensor types may coexist. The advanced JSON tab also edits site ID, PLC removal, retention, buffer limits and all existing fields.
3. The app’s **D/M labels use decimal; X/Y labels use FX octal notation in every mode**. X10 means the eighth bit device, sent as numeric address 8 in binary and as 000008 in ASCII HEX. Do not enter hexadecimal X labels into this UI. D supports Int16, UInt16, Int32, UInt32 or Float32; M/X/Y support Bool. A 32-bit D reading occupies two adjacent 16-bit devices. Confirm the PLC program’s actual word layout.
4. Replace sample addresses with the PLC engineer’s mapping. A physical terminal does not automatically identify a D register or scale. Enable reads, then Save & apply. Use Live dashboard for value, raw value, quality, UTC timestamp and error details. Compare raw and scaled values with GX Works3 monitoring and a known sensor reference.
5. Close the UI and reopen it: the service should still collect. Reboot the PC and verify collection begins without an interactive login. Export CSV after login and verify timestamps cover the boot period. Runtime quality is a communications/decoding assessment, not a sensor calibration certificate.

## Fault checks and evidence

Disconnect PLC Ethernet: expect BadCommunication/BadTimeout with null values, then a successful reconnect with bounded backoff. The UI marks old observations Stale. Disconnect cloud only: SQLite pending count should grow while PLC readings continue. Restore cloud: acknowledged IDs clear the queue without duplicate database rows. Kill/restart service and verify existing database records survive. Compare a 32-bit changing value against PLC data; a single multiword request does not guarantee PLC-program-level atomicity. Use a PLC-maintained snapshot/sequence if required.

Record exact CPU SKU, firmware, GX Works3 version, endpoint/mode, mapping revision, expected and measured raw/scaled values, error codes and timestamps in docs/08_HARDWARE_VALIDATION_RECORD.md. Until these pass, the release is a compiled commissioning build, not hardware-certified software.

## Data and cloud

SQLite database: `%ProgramData%\ArcadeOT\arcadeot.db`; configuration: config.json; local API secret: api-token.txt; optional upload bearer: cloud-token.txt. Secrets remain outside normal config/export. Admin UI fields configure cloud HTTPS URL and masked cloud token. Backend must implement contracts/ingestion.openapi.json. No hosted cloud is supplied. Export gives the latest 100,000 rows; retain the SQLite database for a full archive using a consistent SQLite backup after stopping the service.

Unsent measurements are never automatically purged. A configured buffer live-page cap or less than 50 MiB free disk pauses collection; the health message reports this. Polling cannot recover sensor changes missed during pauses. Default buffer is 1024 MiB; acknowledged rows expire after 30 days. Deleted SQLite pages can be reused without shrinking the file.

Troubleshooting: timeout → route/port/TCP/mode/listener/password/filter; PLC end code → preserve exact hexadecimal code and consult the matched manual; implausible value → signedness/word order/scale/address; API offline → service/Event Viewer/port conflict; no rows → PLC enabled, sensor list, Save & apply, storage state. Never solve a read failure by issuing PLC write/reset commands.


Sources: [MIT-SLMP](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf), [MIT-COMM](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/sh082625eng/sh082625engf.pdf), [MIT-HW](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d55301/jy997d55301u.pdf). See source register for edition/access depth.
