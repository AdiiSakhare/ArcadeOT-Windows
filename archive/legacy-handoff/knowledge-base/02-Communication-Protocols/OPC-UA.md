# OPC UA

Planned generic client driver. The target must actually expose an enabled server. Discover endpoint/security policy, validate server certificate/identity, provision a client certificate and user permissions, and preserve trust decisions; never auto-trust arbitrary certificates in production. Store namespace URI with identifier, resolving session namespace indexes after reconnect.

Preserve DataValue severity and original StatusCode with source/server timestamps separately from gateway observation time. Bad status is not usable data; source time is nullable if unavailable. Good server quality does not independently certify a physical sensor. Typed variants should be mapped deliberately; subscriptions require sampling/publishing/queue/loss policies, reconnection/resubscription and overflow detection. Report overflow or missed data instead of inventing interpolated observations.

No raw binary UA codec should be written for this project’s first release; evaluate a maintained OPC UA SDK and license it appropriately. Commission exact server capabilities, datatype nodes, namespace persistence, limits, user rights and certificate expiry behavior. OPC UA availability is per CPU/firmware/license, not universal across the researched brands.

Sources: [UA-DATA](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11), [SIE-UA](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/communication/opc-ua-server). See source register for edition/access depth.
