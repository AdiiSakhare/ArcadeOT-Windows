# Rockwell CompactLogix / ControlLogix

Research-backed explicit CIP target; no EtherNet/IP driver implemented. CompactLogix 1769 and 5069 controllers use Logix tag access but have different controller/connection/I/O constraints. ControlLogix 1756 often involves a separate communications module/routing path and must be commissioned independently. Logix 5000 Data Access 1756-PM020I-EN-P (September 2025) is the inspected tag-service reference.

Capture exact controller catalogue number, firmware/Studio 5000 version, Ethernet interface and routing path, controller/program-scoped tag names, external-access permissions, declared data types/arrays/UDT layouts and request limits. Avoid PLC/SLC data-table assumptions for native Logix tags. Firmware security capabilities and CIP Security support are independent checks.

Hardware reference: exact 5069/1769 I/O module installation publication and removable terminal block (RTB) SKU. The Compact 5000 I/O index links 5069 modules; do not apply its terminals to 1769 modules. A controller itself does not define the wiring for all expansion sensors. Micro800/legacy MicroLogix/PLC5/SLC need separate profiles and cannot inherit Logix symbolic service compatibility.

Sources: [RA-DATA](https://literature.rockwellautomation.com/idc/groups/literature/documents/pm/1756-pm020_-en-p.pdf), [RA-IO](https://www.rockwellautomation.com/en-gb/support/documentation/technical/i-o/compact-5000-i-o-modules.html), [ODVA-SPEC](https://www.odva.org/subscriptions-services/specifications/). See source register for edition/access depth.
