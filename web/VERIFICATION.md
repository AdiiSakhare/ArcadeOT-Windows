# Web verification — 18 October 2026

## Executed

- `npm run build`: production React/Vite build passed. Fonts are bundled; the UI needs no external font service.
- `npm test`: 20 tests passed, zero skipped in the Linux environment.
- `node tests/browser-check.mjs`: desktop and mobile Chromium workflows passed, with no browser errors and no mobile viewport overflow.

## Protocol evidence

| Adapter         | Automated evidence                                                                                                                                 | Limits                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SLMP            | Exact binary/ASCII read vectors; actual fragmented loopback TCP exchange; raw/scaled bytes; end-code rejection; deadline/refusal; null bad samples | No physical FX5U or ASCII-configured physical PLC                                                              |
| Modbus TCP      | Actual loopback TCP FC3 exchange, exact unit/zero-based address and returned register bytes                                                        | Other FCs use library read APIs; physical devices not available                                                |
| Modbus RTU      | OS raw serial pseudo-terminal; actual station-addressed FC3 with CRC validation and returned bytes                                                 | No RS-485 wiring/adapter, electrical noise, bus turnaround or physical slave                                   |
| Siemens S7      | Actual ISO-on-TCP/PDU negotiation and DB read with local protocol peer; no write function sent                                                     | No real Siemens CPU, PUT/GET setting, or firmware                                                              |
| EtherNet/IP CIP | Actual encapsulation session registration, unconnected read-tag request and scalar UInt32 decoding with local protocol peer                        | No physical Logix, routed chassis or exact firmware; TCP 44818 only                                            |
| OPC UA          | Actual OPC UA server/session scalar read and source timestamp using library server fixture                                                         | Anonymous / None software fixture; real certificates, secure policies and username access need site acceptance |
| FINS UDP        | Actual UDP memory-area read with SID/route checks and actual returned word bytes                                                                   | No physical Omron or configured network routing                                                                |

Protocol peers are test-only and are never runtime data sources.

## Data and application checks

- Empty initial site; no generated readings; all seven protocol-specific mapping validators.
- Invalid/unknown fields, profile revisions, missing enabled connection settings, numeric/bit mismatches, finite scaling, address limits, HTTPS-only cloud URL, and OPC UA security-policy pairing.
- Multiword/octal group stride, stable/new IDs, overlapping SLMP range warnings, quoted Unicode CSV and malformed-import rejection.
- Durable SQLite samples and revision history across gateway restart; rejected configuration leaves the active revision unchanged; restore creates a new revision and keeps measurements.
- Scheduled acquisition with a connected and a disconnected controller: independent healthy reads, continued collection without any browser, and stopping after saved disable.
- Persistence-before-live, explicit timeouts/disconnects, null missing values, source timestamps only from actual source, and raw-byte provenance where exposed by the driver.
- Ingestion request schema, partial acknowledgments, stable retry IDs, invalid/unsent ACK rejection, pending retention on 401, 409 quarantine, explicit retry and acknowledged state. Cloud tests inject HTTP responses at the fetch boundary; no deployed ingestion or real cloud TLS test is claimed.
- Browser: initial empty dashboard, controller setup/save, sensor creation/save, actual refused TCP read, disabled collection display, live refresh pause/resume, history/CSV download, group preview, CSV preview/import, site settings, narrow viewport and mobile navigation.

## Unverified operational acceptance

No physical PLC, exact model/firmware tuple, real serial adapter/wiring, Windows UI/runtime execution, secure OPC UA commissioning, deployed ingestion backend, long-running soak, disk-full/power-loss recovery, Windows auto-start service installation, or multi-user role model was validated. Build/test success is software evidence, not hardware qualification. Run the gateway on the PLC network and compare raw/scaled values against the engineering tool before enabling acquisition for the installation.

The original .NET solution was not rebuilt: this environment has no `dotnet` SDK and Windows/WPF execution is unavailable. Existing C# source and artifacts were not changed. The new web build was validated separately.

## macOS launcher addition

`bash -n web/Start-ArcadeOT.command` passed. Official Node.js 24 release-manifest selection was checked for both darwin-arm64 and darwin-x64. The launcher uses a private app-local runtime and verifies downloaded SHA-256 before extraction. macOS Finder/Terminal launch and native serial drivers cannot be executed in this Linux environment and remain unverified.
