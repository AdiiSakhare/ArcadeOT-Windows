# Service integration

service_integration.py starts the compiled service with isolated temporary SQLite data and a constructed local SLMP peer, using dynamic loopback ports. It checks auth, bounded request bodies, config rejection/apply/restore, per-PLC isolation, data export/history and process restart durability. Run python3 tests/integration/service_integration.py --dotnet /path/to/dotnet after a Release build.
