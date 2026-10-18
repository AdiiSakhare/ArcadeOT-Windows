# Automated checks

ArcadeOT.Checks is a dependency-light console test runner covering configuration, SLMP transport/decoding, CSV/migration, SQLite and mocked cloud ACK behavior. Run through scripts/verify_build.py or dotnet run --project tests/unit/ArcadeOT.Checks. Fixtures contact only loopback peers, never a physical PLC.
