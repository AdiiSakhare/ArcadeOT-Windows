# Compatibility matrix

Snapshot 18 October 2026. No row is hardware validated. “Documented” is not “works with ArcadeOT.” See CSV for independent evidence/status dimensions and source IDs.

| Manufacturer | Family | Protocol | Documentation | Driver | Hardware | Conditions |
|---|---|---|---|---|---|---|
| Mitsubishi | FX5U | SLMP 3E TCP binary/ASCII | Documented | Implemented; build/protocol checks passed | Not tested | exact SKU/firmware/listener/mapping |
| Mitsubishi | FX5U | Modbus TCP | Documented conditional | Not implemented | Not tested | firmware/server setup/map |
| Mitsubishi | FX5U + FX5-ENET/IP | EtherNet/IP | Module documented | Not implemented | Not tested | module/firmware/role/spec |
| Mitsubishi | FX5UC/FX5UJ/FX5S | SLMP | Documented family-level | Unqualified codec reuse candidate | Not tested | model ranges/firmware/features |
| Siemens | S7-1200 classic | S7 legacy absolute | Conditional documented access concepts | Not implemented | Not tested | protection/nonoptimized exchange DB/library |
| Siemens | S7-1200 classic | OPC UA | Conditional documented server | Not implemented | Not tested | exact CPU/firmware/license/user rights |
| Siemens | S7-1200 G2 | S7/OPC UA | Separate V21 profile; feature bounds unknown | Not implemented | Not tested | generation-specific firmware/manual matrix |
| Siemens | S7-1500 | OPC UA/S7 | Research candidate; no per-model review | Not implemented | Not tested | full CPU profile and license |
| Delta | DVP12SE/DVP26SE | Modbus TCP | Catalogue documented; exact server validation pending | Not implemented | Not tested | SKU/firmware/map/unit ID |
| Delta | DVP-SS2/SX2/ES2 | Modbus RTU | Conditional family documentation | Not implemented | Not tested | port mode/station/map/adapter |
| Schneider | M221 Ethernet references | Modbus TCP | Conditional documented | Not implemented | Not tested | TM221 SKU/server map/function limits |
| Schneider | M221 serial references | Modbus RTU | Conditional guide candidate | Not implemented | Not tested | model/slave mode/serial timing |
| Schneider | M241/M251/M262 | Unknown | Unreviewed separate families | Not implemented | Not tested | obtain exact model manuals |
| Omron | CP1L-EM/EL | FINS | Ethernet documented; commands need manual | Not implemented | Not tested | W342/interface details/routing |
| Omron | CJ2M/CJ2H | FINS | Conditional referenced commands | Not implemented | Not tested | CPU variant/W342/W420 access |
| Omron | NJ/NX | FINS/OPC UA candidate | NJ FINS guide identified; NX/UA scope unknown | Not implemented | Not tested | exact CPU/firmware/variable access manual |
| Rockwell | CompactLogix 1769/5069 | EtherNet/IP explicit CIP tags | Data access documented | Not implemented | Not tested | firmware/tag permissions/route/type limits |
| Rockwell | ControlLogix 1756 | EtherNet/IP explicit CIP tags | Data access documented | Not implemented | Not tested | module path/firmware/security |
| Rockwell | Micro800/MicroLogix/SLC | Unknown | Separate unreviewed architectures | Not implemented | Not tested | obtain exact manuals; no Logix assumption |

Source IDs resolve in ../../research/SOURCES.md. Add new families only with explicit evidence. Status promotion requires a complete test tuple: CPU order code + hardware/firmware + interface + protocol/mode + driver version + test record.
