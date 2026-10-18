# Delta DVP families

Research-backed candidates; no Delta driver implemented. The DVP catalogue distinguishes DVP12SE and DVP26SE network modes. Select DVP-SE as an initial Modbus TCP target with exact SKU/firmware and server configuration evidence. DVP-SS2/SX2 and related serial-capable families are separate Modbus RTU candidates; do not assume they have Ethernet simply because DVP-SE does.

The programming manual covers ES2/EX2/EC5/SS2/SA2/SX2/SE & TP and must be used for the selected family’s device-to-Modbus address conversion. Local D registers and Modbus offsets are distinct namespaces. Do not paste a legacy FAQ’s example page address into the current map without checking edition, family and hexadecimal/decimal convention.

Commissioning fields: complete DVP SKU/firmware, native/expansion Ethernet or serial port, station ID, configured mode, IP/port or baud/parity/stop bits, data map with source section, count/encoding/scale and module/terminal references. DVP analog modules expose their own control/buffer registers and ranges; sensor addresses come from the PLC program. Physical terminal page depends on exact CPU/output/supply suffix. DVP-EN01 module availability does not prove universal fit across all DVP models.

Sources: [DEL-CAT](https://filecenter.deltaww.com/Products/download/06/060301/Catalogue/DELTA_IA-PLC_DVP_TP_C_EN_20240513.pdf), [DEL-PROG](https://filecenter.deltaww.com/Products/download/06/060302/Manual/DELTA_IA-PLC_DVP_ES2-EX2-EC5-SS2-SA2-SX2-SE-TP_PM_EN_20231221.pdf), [DEL-MAP](https://preprod-www.deltaww.com/en-US/service-support/faq/1618). See source register for edition/access depth.
