# Current and historical schemas

`config.schema.json` describes the new version 2 configuration shape. Runtime ConfigurationValidator additionally enforces IDs, supported/implemented profiles, address/type/width/radix rules, finite ordered bounds, string limits and enabled-PLC requirements. JSON Schema alone cannot establish a real hardware memory range or wiring assignment.

`sqlite.sql` mirrors the new measurements/outbox/quarantine/config-history tables. `config.v1.schema.json` and `sqlite.v1.sql` are retained migration baselines. Do not apply v1 DDL to the new service database. The new service uses a separate ArcadeOT2 directory and rejects unsupported schema versions. Automatic old-measurement database migration is pending.

`postgresql.sql` is the ingestion reference, not a deployed backend. Measurement wire shape remains compatible with ingestion version 1.

Disabled v2 configuration and sensor CSV are under config/examples/. Legacy examples are explicitly under config/examples/legacy-v1/. Desktop import supports strict v1 config conversion, preserving IDs and disabling acquisition for review. Credentials never import/export with configuration.
