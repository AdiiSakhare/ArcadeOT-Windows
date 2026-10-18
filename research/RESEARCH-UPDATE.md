# Official-source research update

18 October 2026. This supplements the preserved historical knowledge base; it does not certify hardware. Sources are manufacturers, standards owners and tool maintainers. Model-specific sensor datasheets depend on which models are added to the product catalog; the application must accept installation choices through its UI.

## Fresh findings and implementation use

| Reference | New check / access depth | Use and remaining restriction |
|---|---|---|
| [Mitsubishi manual index](https://www.mitsubishielectric.com/fa/products/faspec/download.page?category=ex&formNm=FX5_EIP_FX5-EIP_7159&id=spec&kisyu=%2Fplcf&lang=2&word=Network%2FCommunication+Module) | Vendor index lists Hardware SH-082452ENG-Q, August 2026 and Communication SH-082625ENG-J, April 2026 | Update research candidates beyond old P/F references; catalog listing alone is not revision-delta review |
| [Combined iQ-F hardware Q](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/sh082452eng/sh082452engq.pdf) | PDF opened through web and downloaded locally | Exact CPU/module suffix and diagram still required before terminal catalog population |
| [Communication J](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/sh082625eng/sh082625engj.pdf) | Indexed edition confirmed; web parser rejected 15.9 MB size; local fetch failed TLS | Full communication-J body review remains pending; do not silently replace legacy codec evidence |
| [Legacy FX5 SLMP K](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf) | Local original PDF downloaded for cover/targeted review | Existing codec evidence, not a claim of latest manual |
| [Modbus application protocol](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf) | PDF opened and downloaded | Normative address/read/exception reference for a future Modbus driver; does not define a PLC application's sensor map |
| [Modbus serial V1.02](https://www.modbus.org/file/secure/modbusoverserial.pdf) | 44-page PDF opened and downloaded; earlier handoff had only an index | Removes the old guide-acquisition gap; serial timing/CRC, adapter and device testing still required |
| [Omron Ethernet-unit W420](https://assets.omron.eu/downloads/latest/manual/en/w420_cj1w-etn21_cs1w-etn21_ethernet_units_-_construction_of_networks_operation_manual_en.pdf) | Official PDF found and downloaded; web parser failed | Earlier W420 retrieval gap partially resolved; full W342 commands, exact unit compatibility and full implementation review still pending |
| [Logix Data Access](https://literature.rockwellautomation.com/idc/groups/literature/documents/pm/1756-pm020_-en-p.pdf) | 92-page PDF opened and downloaded | Explicit tag-access reference; full EtherNet/IP stack/licensing and controller qualification remain separate |
| [Delta DVP programming](https://filecenter.deltaww.com/Products/download/06/060302/Manual/DELTA_IA-PLC_DVP_ES2-EX2-EC5-SS2-SA2-SX2-SE-TP_PM_EN_20231221.pdf) | Existing official URL retried; web inaccessible and downloader did not accept response as a bounded PDF | Full device map remains pending; no address offsets inferred |
| [M221 Hardware Guide](https://www.se.com/us/en/download/document/EIO0000003313/) | Official landing page confirms v04, 1 September 2025 | Full exact-model terminal page review remains pending |
| [M221 Programming Guide](https://www.se.com/us/en/download/document/EIO0000003297/) | Official landing page confirms v04, 1 September 2025 | PDF body and device-specific limits remain pending |
| [Siemens OPC UA server](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/communication/opc-ua-server) | Official TIA collection page reopened | Exact CPU/generation/firmware/license conditions must be attached to catalog entries |
| [OPC UA DataValue](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11) | Official reference reopened; page identifies v1.05.07 | Preserve value/status/source/server timestamp semantics in a future driver |
| [Microsoft Windows Service](https://learn.microsoft.com/en-us/dotnet/core/extensions/windows-service) | Official service-host guidance opened | Basis for independent boot-time collection |
| [Microsoft single-file deployment](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview) | Deployment/native-extraction guidance reviewed | Prefer single installer around folder payloads initially; runtime bundling requires separate extraction/permissions validation |
| [WiX Burn](https://docs.firegiant.com/wix/tools/burn/) and [signing](https://docs.firegiant.com/wix/tools/signing/) | Maintainer docs found/reviewed | Candidate EXE bootstrapper/MSI packaging; tool version, license, signing identity and Windows tests remain implementation inputs |

## What research cannot provide automatically

Public hardware manuals describe possible terminals and capabilities. They cannot establish a customer's ladder-program register map, installed sensor calibration/scaling, active PLC listener configuration or actual firmware behavior. The product must let the operator enter or import that evidence. A profile can be documented without being implemented or hardware validated.

Current copied v1 schema lacks physical module/terminal metadata and structured multi-protocol addresses. New profile/config schemas are implementation work. Do not enable these copied examples or label them new v2 contracts.

The original full application ZIP/master specification referenced by the historical conversation is still absent from this workspace. The bounded conversation export is preserved as provenance, not a substitute for those missing originals. The separate mobile project is outside this folder and was not inspected or modified in this session.
