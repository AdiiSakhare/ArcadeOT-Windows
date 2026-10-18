# PLC integration knowledge base

This package distinguishes vendor documentation from implemented connectivity and physical validation. All review dates are 18 October 2026. See ../research/SOURCES.md for exact editions and access depth. “Unknown” is intentional evidence tracking, not an invitation to guess. Manuals published later than the inspected edition require a recorded delta review.

02-Communication-Protocols contains seven protocol implementation briefs. 03-Manufacturer-Profiles contains exact family restrictions. 04-Data-Decoding defines transformations and addressing. 05-Hardware-and-IO links model-specific wiring references without invented terminal numbers. 06-Driver-Development defines interfaces/testing and compatibility status. CSV matrix is machine-readable.

Only the FX5U-oriented SLMP driver is implemented in the companion source. No hardware compatibility certificate is supplied. Public vendor summaries are sufficient to select a research path, not to implement undocumented wire commands. Retrieve full authorized specifications before adding S7/CIP/FINS codecs. Never infer that one Ethernet-equipped model proves all controllers in its brand support a protocol.
