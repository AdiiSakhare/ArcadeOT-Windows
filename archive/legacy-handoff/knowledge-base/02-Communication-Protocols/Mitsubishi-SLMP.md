# SLMP / Mitsubishi 3E

Implemented first path: direct FX5U CPU over TCP, binary or ASCII 3E. Command 0401 reads device data. Decoder must validate subheader, destination route, declared length, end code and payload shape. A TCP read may contain only part of a frame. On error close the stream to prevent a late response being misassociated with the next request. The code uses one outstanding transaction per session.

The delivered form accepts FX X/Y octal labels and converts them to numeric addresses for binary/ASCII HEX; D/M are decimal. In ASCII OCT mode it retains octal X/Y digits. Direct route is network 00, station FF, module I/O 03FF, multidrop 00. Endpoint port is configured, never guessed. Device code D=A8, M=90, X=9C, Y=9D; bit read uses subcommand 0001, word read 0000. Mapping ranges require the exact CPU manual/program.

Request fixture for D100, one word: `50 00 00 FF FF 03 00 0C 00 10 00 01 04 00 00 64 00 00 A8 01 00`. This is a constructed parser fixture, not captured site traffic. Monitoring timer is 0010 (250 ms units); host timeout is independent. Response end code precedes data. Packed Boolean response nibbles are not a word bitfield.

Current exclusions: 1E/4E, UDP, routed destinations, remote-password unlock, arbitrary device families, module buffers, write commands. Implement new options only with protocol vectors and exact model evidence. A future module’s SLMP capability does not imply FX5U built-in EtherNet/IP capability.

Sources: [MIT-SLMP](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf), [MIT-NET](https://sg.mitsubishielectric.com/fa/products/cnt/plcf/pmerit/communication/ethernet.html), [MIT-COMM](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/sh082625eng/sh082625engf.pdf). See source register for edition/access depth.
