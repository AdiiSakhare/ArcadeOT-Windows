# Siemens S7 access

Planned driver. Separate classic absolute DB access from symbolic/optimized access and OPC UA. A nonoptimized, explicitly mapped DB can provide a stable exchange area for legacy reads; an optimized DB must not be read using assumed byte offsets. Enabling a legacy access mechanism may change CPU security exposure and must be approved/configured by the PLC engineer.

Configuration profile: CPU order code/firmware/generation, connection mode, endpoint, rack/slot or TSAP if required by the chosen supported stack, DB number, byte/bit offset, type, size and configured PLC permissions. Do not assume a universal rack/slot combination across all S7 families. Decode S7 STRING headers, BOOL packing and multibyte fields only from a verified target data layout.

The Siemens references reviewed document access/security concepts, not a complete public third-party S7 wire specification. Choose a maintained licensed library or supported Siemens interface and validate it against exact firmware. Capture connection-negotiation/PDU limits and protection failures. S7-1200 G2 is a separate profile; do not copy legacy settings. No wire vectors are asserted verified here.

Sources: [SIE-SEC](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/communication/secure-vs.-legacy-communication?contentId=95B1rZwB3fzZWBBqQMT9Ww), [SIE-DB](https://cache.industry.siemens.com/dl/files/088/42014088/att_954894/v1/42014088_OPC_UAClient_DOKU_V12_en.pdf), [SIE-G2](https://docs.tia.siemens.cloud/r/en-us/v21/communication-s7-1200-s7-1500-s7-1200-g2/opc-ua-s7-1200-s7-1500-s7-1200-g2?contentId=qBCxZdaeXbzw0vuAuI31AQ). See source register for edition/access depth.
