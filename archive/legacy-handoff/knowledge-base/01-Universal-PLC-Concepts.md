# Universal PLC concepts

A sensor → electrical input/module → PLC application value → mapped readable memory/tag → protocol → ArcadeOT measurement is a chain of distinct mappings. A terminal number is not a network register address. PLC logic may filter, scale, aggregate or relocate the input before exposing it. Read the PLC application’s data map, not only a hardware manual.

Record exact manufacturer, family, order code, firmware, interface/module, engineering-tool version and protocol mode before enabling a model profile. Persist the mapping revision with every observation. A family profile describes potential capability; a commissioned installation profile contains the actual endpoint, map, datatype/order, unit, valid range and provenance.

Polling one request successfully establishes transport readability, not signal correctness. A PLC can return old program data with no protocol error. Optional application heartbeat/sequence/diagnostic mappings are required to determine freshness beyond communications. PLC scan timing is independent of the host polling cycle; no hard real-time guarantees are implied.

Treat input bits, output-state bits, internal relays, registers, symbolic tags and UA variables as different address kinds. Output-state reads do not authorize output actuation. Permission changes, ladder downloads, write commands and machine operations remain outside this collector’s read-only interface.
