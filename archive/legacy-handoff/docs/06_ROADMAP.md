# Execution sequence

Priority 0 — today: use the packaged Windows binaries against a real FX5U. Complete endpoint/mode configuration, one known D scalar comparison, mixed/repeated sensors, disconnect/reconnect, UI closed, service restart and boot/no-login evidence. Do not replace the live PLC with a simulator as a release prerequisite. Protocol unit tests remain useful engineering checks.

Priority 1 — harden actual FX5U deployment: preserve captured read-only request/response fixtures, confirm full SKU/firmware and memory boundaries, optimize batching without crossing invalid memory, evaluate PLC scan/network load, test long-run SQLite/disk recovery, introduce config history/audit and package signing. Add source timestamps only where a trusted PLC/application source exists.

Priority 2 — implement authenticated ingestion API from contract and PostgreSQL DDL; prove retry idempotence, site isolation and outage replay; add browser dashboard using existing mobile/backend contracts only after reconciliation. Add bounded permanent-error quarantine and uploader backoff/jitter.

Priority 3 — Modbus TCP (exact Delta SE/Schneider Ethernet models), Modbus RTU (serial bus ownership), OPC UA (exact enabled/licensed servers), then S7 legacy, CIP explicit Logix and FINS. Each driver follows the same read-only interface and independent hardware evidence. Matrix status can advance only with test artifacts. Prioritize actual installed customer hardware rather than nominal brand count.

Release gates: build verified → protocol checked → Windows installed → exact model hardware validated → monitored site pilot. A docs-only row cannot bypass any gate. Expand strings/arrays/custom structures/64-bit types and richer transformation rules only with type-specific vectors and schema versioning.
