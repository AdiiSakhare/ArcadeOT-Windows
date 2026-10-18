# Byte and word order

Define order at the protocol adapter boundary, not by CPU-brand folklore. Current SLMP driver produces little-endian word bytes; word order of a two-word application value is configurable through SwapWords. Default is low word first, and must match the PLC program. SwapWords swaps the two 16-bit words, not bytes inside each word. Boolean bit-mode payload is separately decoded.

For future Modbus drivers, wire registers are big-endian, but a multi-register value can place its high/low word in different register order. Canonical 32-bit fixture IEEE754 10 = bytes 41 20 00 00. Specify ABCD, BADC, CDAB or DCBA explicitly, normalize to canonical order, then interpret. Do not apply both a library’s word conversion and another hidden swap. Library APIs returning typed values must state whether conversion already happened.

Use asymmetric fixture bytes (12 34 56 78) to catch accidental no-op swaps. The live UI’s raw numeric value/RawHex and PLC monitor should establish actual order before scaling. Keep every ordering choice in the configuration revision.


Sources: [MIT-SLMP](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf), [MOD-APP](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf). See source register for edition/access depth.
