# Schema semantics

config.schema.json covers version 1 of the implemented FX5U form. Runtime validator also enforces unique PLC IDs, unique sensor IDs within each PLC, D numeric versus M/X/Y Bool, datatype widths, address overflow, finite scaling and ordered bounds. JSON Schema cannot replace these semantic checks. Unknown fields are rejected by the schema; the runtime JSON reader currently ignores unknown properties, so implement strict deserialization before accepting third-party schema evolution. Schema and code extensions require a migration/version decision.

examples/site.fx5u.disabled.json is intentionally disabled and contains constructed mappings, not physical channel claims. Do not enable until the actual PLC program map, host, port and mode are entered in the form.
