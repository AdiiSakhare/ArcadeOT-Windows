# ArcadeOT Web

React workspace and a real, read-only Node.js PLC gateway. No simulator, generated readings, sample controllers, or hardcoded installation. The gateway starts with an empty site.

## Run for today's demo

On macOS, open `Start-ArcadeOT.command` (automatic app-local Node setup; see below). On Windows, install **Node.js 24 LTS** and double-click `Start-ArcadeOT.cmd`. To start manually on any supported OS with Node.js 24 installed, run:

```sh
cd web
npm ci
npm run build
npm start
```

If you extracted the standalone web ZIP, run these commands directly in its extracted folder (omit `cd web`). Open **http://127.0.0.1:3001**. Keep the terminal running. Closing the browser does not stop acquisition; stopping the Node process does. This is a separate gateway, not the existing Windows collector service, and is not installed as an auto-start Windows service.

For development: `npm run dev` runs the API on port 3001 and Vite on http://127.0.0.1:5173. Stop the production server before using that command.

### macOS (Apple Silicon or Intel)

Extract the ZIP and open `Start-ArcadeOT.command`. If Node.js 24 is missing, the launcher downloads the matching official Node.js 24 macOS runtime, verifies its SHA-256 against the official release manifest, and keeps it privately inside the extracted app's ignored `.runtime` folder. No Homebrew or administrator installation is required. The first launch needs Internet access for Node/npm dependencies. It builds the app, starts the real gateway and opens the browser after the page responds.

If Finder does not launch the command file, open Terminal, type `bash ` (including the space), drag `Start-ArcadeOT.command` into Terminal, then press Return. Keep that terminal open while collecting. This starts a foreground gateway; it does not install a 24/7 background service or prevent Mac sleep.

For Modbus RTU on Mac, configure the actual adapter path such as `/dev/cu.usbserial-…` and its installed driver. GX Works3 still requires its supported engineering environment; the web gateway itself is cross-platform.

### Mitsubishi FX5U

1. Connect this computer to the PLC network. Confirm the PLC IP, exact CPU model/firmware, SLMP TCP listener port, binary/ASCII encoding, and approved readable address using GX Works3 / the installation's PLC program.
2. In **Add controller → Mitsubishi SLMP**, enter those settings. The port suggestion is editable and is **not** a claim about the PLC's configured listener.
3. Keep acquisition disabled initially. Open **Sensor mappings → Add sensor**. Enter the known address (for example, `D100` only if approved), actual data type, unit and conversion. Physical terminal references are separate.
4. **Save & apply**, then **Connection → Test first saved mapping**. This sends a real read and persists the result. A timeout/refusal/protocol error remains an explicit bad-quality, null-value observation.
5. Confirm raw/scaled values against the engineering tool. Enable acquisition and save. Use **Live monitor**, **History & exports**, and **Diagnostics**.

The web gateway must be on a machine that can reach the equipment. A browser or a static website cannot directly open PLC TCP/UDP or serial connections. An unrelated cloud workspace cannot reach a private plant LAN without separately configured networking.

## Protocol support

All seven adapters perform real read operations. All exact hardware/firmware tuples remain unqualified until tested against that installation. Neither manufacturer labels nor a passing software fixture establishes physical compatibility.

| Adapter         | Connection                                                                          | Mapping and supported scope                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mitsubishi SLMP | TCP, direct CPU 3E binary / ASCII octal / ASCII hex wire format                     | `D100` numeric; `M10`, `X10`, `Y10` Boolean. D/M decimal; X/Y labels octal. No routed 4E frames.                                                                                     |
| Modbus TCP      | TCP, configured unit ID                                                             | `holding:0`, `input:0`, `coil:0`, `discrete:0`; **zero-based** offsets. Read FC1–4 only.                                                                                             |
| Modbus RTU      | Gateway serial device, baud/parity/data/stop bits, unit ID 1–247                    | Same zero-based mappings. `COM3` / `/dev/ttyUSB0`; host needs serial driver and permission. Shared ports are scheduled serially.                                                     |
| OPC UA          | `opc.tcp://` endpoint, security mode/policy, optional username credential reference | Scalar NodeId, e.g. `ns=2;s=Temperature`. Bool, Int16/UInt16, Int32/UInt32, Float32 must match server type. No writes or browsing service.                                           |
| Siemens S7      | ISO-on-TCP, rack, CPU slot                                                          | Absolute DB reads, e.g. `DB1,INT0`, `DB1,REAL0`, `DB1,X0.0`. Configure applicable PUT/GET permissions and non-optimized blocks. No symbolic S7 or control commands.                  |
| EtherNet/IP CIP | TCP 44818, explicit CPU slot                                                        | Controller-scoped Logix scalar tags/members and element reads, e.g. `Temperature`, `Tank.Level`, `Counts[0]`. No arbitrary CIP services, program-scoped tags, structures, or writes. |
| Omron FINS      | UDP, explicit source/destination node and network                                   | `D100`, `CIO0.0`, W/H/A areas. Numeric word reads / Boolean bit reads. No FINS TCP or control commands.                                                                              |

Numeric mapping types: Int16, UInt16, Int32, UInt32, Float32. Modbus and FINS decode big-endian bytes per register; SLMP uses little-endian words. `SwapWords` reverses the two 16-bit words of a 32-bit register value. S7/OPC UA use their library's typed values; word swapping is rejected for S7/OPC UA/CIP. Unknown or mismatched types become errors, never a successful zero. Source time is null unless provided by OPC UA. SLMP/Modbus/FINS/CIP preserve actual returned value bytes; S7's typed API does not expose raw bytes, so `RawHex` stays empty.

### OPC UA credentials and certificate trust

The UI stores only an uppercase environment prefix, e.g. `PLC1`. Set `PLC1_USERNAME` and `PLC1_PASSWORD` in the gateway process environment; restart after changing them. Empty prefix uses anonymous access. Secrets are never in config exports. `None` security must pair with `None` policy; secure modes require a secure policy.

The gateway maintains certificate trust under `.data/pki/`. Unknown server certificates are **not automatically trusted**. Verify certificate identity/fingerprint out of band, then use the certificate manager's normal trusted-store workflow before reconnecting. Supply optional absolute client certificate/private-key paths on the gateway if using provisioned identities. Configure corresponding client trust and user permissions on the server. Secure-channel certificate deployment on real hardware remains an installation acceptance step.

## Functional workspace

- Add, edit, clone, enable/disable and remove controllers with protocol-specific controls. Clones start disabled with new IDs.
- Add/edit/remove sensors, scale/offset, units, engineering limits, word order, stable sensor IDs, and operator-entered physical I/O references. No inferred pins or register mappings.
- Repeated groups with type-aware stride for SLMP/Modbus/numeric FINS. CSV preview/import for explicit mappings; quoted fields are supported. SLMP overlap warnings do not silently alter addresses.
- Independent controller collection. No overlapping cycles per PLC; serial buses serialize. Collection survives UI closure while the gateway process remains running.
- SQLite WAL durable history, persistence before live display, raw/scaled values, explicit quality, stale overlay, UTC timestamps, configuration provenance, cursor history and CSV export (up to 10,000 matching records).
- Versioned web configuration (`Version: 3`), export/import preview, immutable history and restore as a new revision. Existing Windows v2 configuration and database remain separate; automatic migration is not implemented.
- Real HTTPS cloud upload using the existing ingestion v1 contract: stable event IDs, subset acknowledgment, rejection quarantine, explicit retry, exponential backoff. CSV export does not acknowledge events. Pending/quarantined records never expire automatically.

`npm start` serves the built React app and API on the same origin. Settings and measurements are stored in `web/.data/gateway.sqlite`; no plant data is tracked in Git. Back up the stopped gateway's entire `.data` directory. For a live backup use SQLite's backup mechanism; copying only the main file while WAL is active is not a consistent backup.

## Cloud delivery

Enter a compatible full HTTPS ingestion URL in **Cloud delivery**, set `ARCADEOT_CLOUD_TOKEN` in the gateway process environment, restart, and save the destination. The endpoint receives:

```json
{ "schemaVersion": 1, "measurements": ["actual measurement objects"] }
```

It must commit measurements idempotently by `EventId` before returning `{"acceptedEventIds":["committed IDs only"]}`. The repository's `contracts/ingestion.openapi.json` defines the actual object schema. Invalid/duplicate/unsent acknowledgment IDs never clear the queue. HTTP 400/403/409/422 preserves the batch in quarantine; transient errors retain pending records. Response bodies and batch sizes are bounded. No ingestion backend is provisioned by this change.

## Access and hosting

Default binding is IPv4 loopback, port 3001. Optional variables:

| Variable                | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `PORT`                  | HTTP port; default 3001                                     |
| `HOST`                  | Binding; default `127.0.0.1`                                |
| `ARCADEOT_WEB_DATA_DIR` | Absolute durable directory; default `web/.data`             |
| `ARCADEOT_WEB_TOKEN`    | Gateway bearer key; required before binding beyond loopback |
| `ARCADEOT_CLOUD_TOKEN`  | Ingestion bearer credential, held server-side               |

For another browser on the LAN, run this gateway on the PLC network, set a strong `ARCADEOT_WEB_TOKEN`, and expose it only through an authenticated HTTPS reverse proxy. Keep the token in the server environment. The UI requests the access key and holds it only in memory. Do not send access keys over plain LAN HTTP. This commissioning build has a shared technician key, not role-based multi-user accounts. For unattended operation, configure this Node process using your approved service manager; auto-start installation is not provided here. The original Windows service and its protected key/API are not modified.

Static-only/Cloudflare Worker hosting cannot run this TCP/UDP/serial gateway. Do not deploy `dist` alone and expect PLC acquisition. This version is intended to run with the gateway on the equipment network.

## Verification

```sh
npm test
npm run build
npm run test:browser
```

Browser QA requires Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). The RTU pseudo-terminal fixture uses Python 3 on Linux and is skipped on other OSes. These fixtures are test-only; none are shipped or started by the application. Browser checks use isolated temporary storage and real failed connections, never synthetic live measurements.

See [ANALYSIS.md](ANALYSIS.md) and [VERIFICATION.md](VERIFICATION.md) for reviewed source, exact evidence and limitations.
