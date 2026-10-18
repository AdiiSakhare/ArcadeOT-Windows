# Acceptance and evidence

Automated checks supplied: full binary/ASCII D100 request vector; signed/unsigned/float/word-swap decoding; packed bit; octal X10 conversion; malformed payload/header/address; duplicate IDs and missing enabled endpoint; fragmented binary and ASCII network responses; PLC error end code; EOF; deadline. Run app/tests/ArcadeOT.Checks with .NET 10. These tests use loopback peers, not hardware certification.

Windows/real FX5U gates (pending):
- Installer succeeds, both EXEs open/run with bundled runtime, data ACL verified and API rejects missing token.
- UI creates/edits all endpoints and mappings without source changes. Validation rejects duplicate sensor IDs/type mismatches, retains last working config.
- Actual configured TCP port and binary/ASCII mode return matching raw values from GX Works3. Record at least signed16, unsigned16, float32/word order if used and Boolean if used; do not claim unused types hardware validated.
- One PLC with eight repeated temperatures; another configuration with two pressures, four gas-quality and five temperatures. These are category/count examples, no assumed physical channels.
- Several PLCs: a disconnected controller does not block healthy controllers; response quality and errors are per mapping.
- Close UI, reboot before login, crash/restart service; verify collection timestamps and no historical row corruption.
- Cloud outage/replay/partial ACK/duplicate request; no ACK before sink commit; event ID collisions with conflicting content rejected.
- Storage quota/free disk reserve/SQLite failure; visible paused/faulted state and no silent good zero samples. Backup/restore tested with WAL awareness.
- Security: unauthorized loopback access, secret log/export check, malformed config, TLS certificate failure; no PLC write commands on wire capture.
- Throughput qualification: record PLC count, sensors/type widths, interval, request latency, cycle duration, PLC scan impact, host CPU/RAM and DB growth. No unlimited sensor/performance guarantee.

Preserve command outputs, screenshots, SQL counts, Windows version, release SHA-256 and hardware evidence alongside docs/08. Do not mark these pending checks passed without execution.
