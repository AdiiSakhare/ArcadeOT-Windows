# Modbus TCP

Planned driver. Four address spaces: coils/discrete inputs/holding registers/input registers. Read functions 01/02/03/04 select the table. Keep zero-based PDU offset separate from human 40001-style notation; never blindly subtract 40001 from a vendor hexadecimal map. Config requires address table, offset convention, unit identifier and register count.

A 16-bit register is sent most-significant byte first. Multi-register float/32-bit word order is a device/application mapping choice and must be explicit. MBAP includes transaction ID, protocol ID, length and unit ID; match them before decoding. TCP reassembly, exception function (requested function OR 80 hex) and exception code are separate failure paths. TCP uses no serial CRC.

Constructed read-only fixture: request `00 01 00 00 00 06 01 03 00 00 00 02`; response `00 01 00 00 00 07 01 03 04 41 20 00 00`. With explicit high-word-first IEEE754 mapping this yields 10.0. It does not define any Delta/M221 sensor address. Respect both protocol and device request limits. Default standard TCP port is 502, but configured endpoints can differ.

Sources: [MOD-APP](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf). See source register for edition/access depth.
