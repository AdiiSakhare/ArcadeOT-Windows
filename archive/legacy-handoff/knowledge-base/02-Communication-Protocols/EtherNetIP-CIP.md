# EtherNet/IP / CIP / Logix

Planned explicit-message collector. EtherNet/IP carries CIP; implicit cyclic I/O and explicit request/reply access are different mechanisms. A data collector should use documented explicit read services, not take ownership of physical I/O assemblies. Record endpoint, routing path/backplane slot where applicable, controller/tag scope, tag name, type and element count.

Rockwell’s Data Access manual documents Read Tag service 4C and its CC reply. Symbolic paths, arrays, program-scoped tags and structured members require deliberate encoding. A successful encapsulation response does not establish successful CIP service completion. Validate session, sender context, general/extended status, declared type, fragmentation and byte lengths. Never reuse packed BOOL/UDT layouts as universal offsets.

Constructed payload-only decoder fixture for a DINT: `C4 00 F0 02 00 00` represents declared DINT and value 752 in the cited manual examples. It is not a complete EtherNet/IP packet or a user tag map. A library adapter must supply full encapsulation/session/routing fixtures. ODVA catalogue lists April 2026 CIP and EtherNet/IP editions; full licensed volumes were not accessed. Resolve library/specification licensing before distribution. CIP Security is not assumed for a plain EtherNet/IP connection.

Sources: [RA-DATA](https://literature.rockwellautomation.com/idc/groups/literature/documents/pm/1756-pm020_-en-p.pdf), [ODVA-EIP](https://www.odva.org/publication_download/ethernet-ip-technology-overview/), [ODVA-SPEC](https://www.odva.org/subscriptions-services/specifications/). See source register for edition/access depth.
