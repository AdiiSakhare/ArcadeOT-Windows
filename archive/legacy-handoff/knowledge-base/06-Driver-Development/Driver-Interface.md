# Driver contract

Actual implemented contract is app/src/ArcadeOT.Core/Models.cs IPlcDriver and Slmp.cs. It exposes only asynchronous read and asynchronous disposal. Cancellation must interrupt connect/read/deadlines; no background task survives disposal. A driver instance belongs to one PLC session and must not be shared concurrently. The service owns retries, poll scheduling, quality persistence and cloud delivery.

The present contract receives Gateway site/revision, Plc and Sensor and returns a normalized Measurement. For additional protocols, version the config using a discriminated address/connection union and split wire result from normalization if necessary. Do not overload the FX-specific Address string with ambiguous manufacturer syntax. Extend public contracts deliberately and migrate old config before a driver accepts it.

Required future capability descriptor: stable driver ID/version; transport modes; address kinds/radix; supported scalar/array/string types and bounds; allowed reads/max batch; subscription capability; timestamp/status fidelity; connection security; required licenses; exact model validation records. The UI should offer supported config options based on that descriptor without hardcoding fabricated capabilities.

Error contract: distinguish invalid config, transport timeout/disconnect, protocol end code, permission failure, unsupported address/type, malformed length and decode/range quality. Preserve raw status/bytes bounded and redact secrets. Never return fabricated Good measurements or catch cancellation as success. Unknown model requires explicit unqualified status, not an assumed compatible manufacturer match.
