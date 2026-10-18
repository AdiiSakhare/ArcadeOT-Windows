# Datatypes and quality

First runtime supports Bool, Int16, UInt16, Int32, UInt32 and Float32; string, array, BCD, 64-bit, date/time and structured values are planned. Decode raw bytes using declared width/sign/order before scaling. A sensor category does not select datatype. A two-register integer and float over identical bytes can yield entirely different values.

Vectors: `FF FF` as little-endian Int16 = -1, UInt16 = 65535; `00 00 80 3F` as little-endian IEEE754 Float32 = 1; `D2 04` Int16 = 1234. These are mathematical fixtures, not a manufacturer sensor map. NaN/infinity/overflow must not be serialized as plausible numeric samples. Unsupported type/mapping is a configuration error, not automatic coercion.

Quality policies: communication/timeout → null Value and diagnostic; nonfinite decode/scale → BadDecode/null; numeric beyond configured limits → UncertainRange with value retained; successful scalar read → Good (transport/decode only); old UI observation → Stale overlay. Preserve raw protocol status in future drivers, especially OPC UA. SourceAtUtc remains null when source has no timestamp; ObservedAtUtc is gateway receipt/fault time.


Sources: [UA-DATA](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11). See source register for edition/access depth.
