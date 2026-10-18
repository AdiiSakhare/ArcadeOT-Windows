# Technician workflows

PLCs & sensors form: select/add PLC; edit endpoint, port, CPU/firmware evidence, mode, timeout and interval; enable/disable. Sensor grid permits repeated categories and arbitrary ordering. Stable IDs are separate from display names. Address and engineering-unit interpretation belong to each sensor, never to sensor category alone. Bulk creation asks prefix/count/start/type and uses type-width stride. For eight temperatures choose count 8; add separate groups for two pressures, four gas-quality and five temperatures. Review all generated mappings before enabling reads.

Save & apply validates site/PLC/sensor IDs, address syntax, numeric options and supported modes; an error displays a message and leaves the service config unchanged. It does not guarantee the real CPU has that address or the PLC program stores the expected data there. Preview raw values against a PLC monitor before using scaling. Advanced JSON supports site ID, retention, live-page quota, PLC deletion and complete configuration import/export by copy. Do not store secret values there. The cloud token field is write-only and masked.

Live dashboard: one row per configured scalar mapping, raw/scaled values, unit, type, address, current quality, UTC and diagnostic details. Service/API failure clears the visible live grid; previous values are not silently treated as current. Old observations are marked stale in the UI. CSV export sanitizes spreadsheet formulas and quotes values. CSV export is capped at 100,000 recent rows.

Future requirements: searchable/grouped grid, validation preview with overlap warnings, CSV sensor import, saved templates, role-aware changes/audit trail, per-PLC test-read button and friendly health cards. Do not label these future features complete.
