# Addressing and mapping provenance

Store protocol-specific structured addresses in future drivers. SLMP: device area plus numeric device index with UI radix conversion. Modbus: table + zero-based PDU offset + unit ID and explicit display convention. S7: connection mode + DB/byte/bit or supported symbolic identifier. Logix: symbolic tag scope/path plus array indexes. FINS: memory area/word/bit and network destination. UA: namespace URI + identifier type/value.

Do not infer sensor semantics from D100, %MW100 or DB1.DBD0. They are example labels until the PLC application map establishes a meaning. Address zero can be valid and must not be rejected globally; an unset endpoint port zero is invalid when a PLC is enabled. Validate syntactic range, type width, device-specific map limits and overlapping spans. Shared reads can be legal (two derived measurements) but require explicit configuration.

Current form: D/M decimal and X/Y octal; 32-bit D spans Dn and D(n+1). Logical maximum 24-bit address is a codec format bound only, not proof CPU implements that device number. Device end code remains a commissioning diagnostic. Never silently change number base based on presence of letters.


Sources: [MIT-SLMP](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf), [MOD-APP](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf). See source register for edition/access depth.
