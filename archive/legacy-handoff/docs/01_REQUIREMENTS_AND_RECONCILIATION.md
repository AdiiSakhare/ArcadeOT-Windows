# Requirements and reconciliation

Authority order: latest direct user instructions; recovered original documents where consistent; this explicit decisions log; researched vendor capability. Conversation text is context, not proof a feature was implemented. User now requires real FX5U testing today and an in-app configuration form, superseding the earlier assistant’s simulator-first recommendation.

| Requirement | Delivered behavior | Remaining acceptance |
|---|---|---|
| Installable arcadeOT.exe | compiled WinForms UI plus installation script | execute on Windows, signed installer later |
| Independent ArcadeOT.Service.exe | automatic service, LocalService, recovery | boot/no-login and power-loss test |
| Multiple PLCs/site | list of PLC configs, separate polling tasks | site throughput qualification |
| Arbitrary mixed/repeated sensors | sensor grid and bulk creation; no fixed sensor slots | supported scalar types only in first driver |
| Configurable mapping/type/scaling | per sensor address, type, scale/offset, word swap, limits | strings/arrays/BCD/advanced formulas future |
| Timestamps/quality | UTC observation, null absent source time, Good/bad/range/stale | source-device diagnostics mapped per future driver |
| SQLite buffering | durable per-event insert, ack flag, retry queue, backpressure | Windows fault/power-loss test |
| SQL/cloud ingestion | SQL schema and generic HTTPS uploader/API contract | deploy backend and configure credentials |
| Dashboard | local live grid, service/buffer health, CSV export | hosted web dashboard future |
| Security | read-only PLC commands, loopback secret, restricted data ACL | granular roles, signing, security review |
| Broad PLC compatibility | official-source KB and explicit status matrix | only FX5U driver implemented here |

The prior chat reported 14 original files: README, docs 01–08, C# driver reference, PLC/sensor JSON, normalized event JSON and local/cloud SQL. These names/content claims are recovered conversation evidence, not inspected file contents. The known document name `03_PLC_PROTOCOLS_AND_TAGS.md` is reported by that conversation. Do not regenerate replacements under original names and claim identity.

When originals arrive: retain byte-for-byte copies in originals/, record filename/size/SHA-256; safely inspect ZIP members before extraction (reject absolute paths, traversal, symlinks); compare every requirement/API/schema against this package; create a table with original path/line, new path/section, conflict and resolution. Keep mobile app APIs and IDs compatible only after inspecting that project’s contracts. Never merge unrelated mobile source into the Windows service by assumption.

Design decisions made here: .NET 10 + WinForms for immediate Windows desktop delivery; ASP.NET loopback API; LocalService account; SQLite; PostgreSQL reference ingestion schema; local admin UI in first release; read-only collection; direct SLMP TCP 3E first. These are new implementation decisions, not claims about missing originals. Initial real FX5U delivery precedes additional protocol drivers.
