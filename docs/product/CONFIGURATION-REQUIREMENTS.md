# Everything configured by the installer/operator

Direct user clarification, 18 October 2026: every installation must select/configure its own PLC models, IP, I/O pins and other settings through the application. Development must not depend on choosing one fixed site in advance.

## PLC and connection

Select manufacturer, family, exact CPU order code, firmware, built-in interface or module, and protocol. The UI filters choices by a versioned capability profile and implemented driver. Research-only options show their status and cannot start collection. An advanced custom profile may use an implemented driver but remains explicitly unqualified.

Configure PLC ID/name, host/IP, actual port, supported frame/encoding, permitted route, poll target, deadline and enabled state. Protocol-specific fields are shown only when implemented: serial parameters/station ID for RTU; table/offset/unit ID for Modbus; endpoint/trust/node identity for UA. A manufacturer selection alone never establishes compatibility.

## Physical I/O and sensor definition

Select CPU/expansion module, slot, channel, terminal designation, common group, input/output kind, electrical signal range and sensor model. Display the exact manual edition and diagram/page for verified terminal entries. Allow operator-entered references when the catalog is incomplete, visibly marked unverified. Never manufacture terminal assignments.

Each physical channel links to a separately configured readable PLC register/tag/node. The PLC program may scale or move that signal. Pin selection cannot automatically infer D-register addresses, data types or engineering conversion. Pin fields describe the installation; the app does not remotely rewire, configure I/O parameters or write PLC values.

Configure stable sensor ID, display name/group, address, declared data type, byte/word order, raw width, unit, scale/offset or endpoint conversion, validity limits and provenance. Preserve raw bytes and decoded values. Support repeated categories and arbitrary mixtures: eight temperatures or two pressure + four gas-quality + five temperatures, in any order and on multiple PLCs.

## Convenient configuration tools

Guided PLC setup, single read-only test, editable sensor grid, repeated-sensor generator with type-aware stride, CSV preview/import, duplicate/overlap warnings, saved templates, clone PLC, delete/disable with preview, searchable mappings and configuration diff. IDs survive rename, export and retry. Applying config validates the whole revision on the service, preserves the last working revision on failure and records an audit entry.

Site ID, destination URL, credentials, retention, buffer capacity, polling and all driver options must have first-class controls. JSON is optional advanced access; basic setup must not require editing JSON. Credentials remain outside normal JSON, logs and exports.

## Monitoring and operation

Per-PLC connection and per-sensor quality; raw/scaled value and timestamp; nullable trusted source time; poll duration/overrun; storage/backlog/disk state; cloud outcome; configuration revision and driver/profile version. Mark stale observations visibly and distinguish a healthy PLC from another disconnected PLC. Provide bounded history queries and paginated export.

The Windows Service owns collection and starts at boot without login. Closing the UI has no effect on acquisition. Separate Operator viewing from Technician configuration and installation administration in the production access design.

## Data correctness

Bad/missing values remain null with explicit quality. Source timestamps are never invented. Persist before presenting current samples. Keep pending event IDs stable until sink commit acknowledgment. Expose storage pauses and missed acquisition periods. Physical sensor fault/heartbeat interpretation requires configured diagnostic mappings; a successful protocol read alone means no calibration or sensor-health certification.
