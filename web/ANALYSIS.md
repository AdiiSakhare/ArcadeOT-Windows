# Source review and web implementation

Reviewed the requested `dev` branch before implementing the web app. The initial workspace had an unborn `work` branch and no checked-out files. Fetched GitHub `dev` and checked it out as local `dev`; existing archived packages were not edited.

## Findings

The existing app is a .NET 10 WPF workspace plus independent Windows collector (`ArcadeOT2`), not an existing web client. The reviewed code implements SLMP 3E TCP binary/ASCII, strict v2 site/controller/sensor contracts, physical references separate from memory addresses, durable SQLite storage/outbox, explicit quality/UTC provenance, and per-event cloud acknowledgment. Other catalog protocols in the Windows app are research-only.

The loopback API requires a protected `X-ArcadeOT-Key` and deliberately has no browser CORS or remote binding. Simply replacing WPF with a hosted React page would not enable PLC communications. The platform-specific Windows desktop and service also cannot be executed in this Linux cloud environment with no .NET SDK.

Reviewed sources:

- Root `AGENTS.md` and `README.md`.
- `docs/product/CONFIGURATION-REQUIREMENTS.md` and `docs/planning/02-BUILD-PLAN.md`.
- `docs/validation/BUILD-STATUS.md` and local API/ingestion contracts.
- `src/ArcadeOT.Domain/Configuration.cs` and `Measurements.cs`.
- `src/ArcadeOT.Drivers.Slmp/SlmpDriver.cs` request/response framing, routes, types and error rules.
- `src/ArcadeOT.Service/Program.cs` and `Uploader.cs`.
- `src/ArcadeOT.Desktop/MainWindow.xaml` and `WorkspaceViewModel.cs`.
- Installed protocol library implementations and their documented connection/read APIs.

## Resulting architecture

`web/src` is a React 19/Vite workspace. `web/server` is a separately deployable Node 24 read-only gateway, using Node SQLite for durable records and real network/serial adapters. The browser and HTTP API share an origin. The Windows application, installer, database identity, protected key, original API and archives remain untouched.

SLMP framing follows the reviewed implementation and its direct-CPU read-only scope. Modbus TCP/RTU use `modbus-serial`; OPC UA uses `node-opcua-client` and an explicit certificate manager; S7 uses `nodes7`; CIP uses `st-ethernet-ip` with strict scalar response decoding; FINS uses bounded native UDP memory-area reads. The application exposes no PLC write/control endpoints or driver calls. Adapter availability is distinct from exact hardware qualification.

Web config uses version 3 to add protocol-specific connection settings without pretending to be backward-compatible with the strict Windows v2 schema. Measurement and ingestion fields preserve the reviewed v1 wire contract. Site configuration, observations, revisions, pending delivery and quarantine are durable; credentials stay in process environment/certificate stores. Display refresh is independent from gateway acquisition.

No simulator or generated plant values exist in the application. Local protocol peers and a serial pseudo-terminal exist only under `web/tests` for verification. They are neither bundled into the browser build nor launched by the runtime.

No branch promotion to `qa`/`main`, GitHub push, Windows service replacement, hardware certification, or hosted release is part of this change.
