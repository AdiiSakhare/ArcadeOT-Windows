# Mitsubishi FX5U / related iQ-F

Primary deployment target. Vendor Ethernet table explicitly lists FX5U SLMP server 3E/1E and Modbus/TCP; the companion app implements only direct 3E TCP reads. The built-in CPU Ethernet interface differs from FX5-ENET/IP or FX5-EIP expansion products. Do not advertise EtherNet/IP on a bare FX5U by borrowing an add-on module specification.

Commissioning profile must contain complete order code (for example FX5U-32MR/ES is a model identifier, not a selected user machine), CPU firmware, engineering-tool edition, built-in/add-on interface, IP/port/data-code mode, filtering/password state, permitted device ranges and PLC program mapping revision. No values for these site-specific fields have been inferred.

I/O reference: legacy JY997D55301U hardware guide; vendor index lists combined SH-082452ENG-P (2026/04). Use exact SKU’s terminal/layout sections and output/supply variant; no terminal numbers are reproduced. Confirm whether analog channels are built in or expansion modules and whether the PLC program exposes raw or already-scaled measurements.

Related FX5UC/FX5UJ/FX5S: current combined manuals and network table cover them, but their firmware/features/terminals must be qualified separately. FX3 family is a separate research/driver profile, not implicitly validated by the FX5U codec. Actual performance and maximum supported mapping range remain commissioning evidence.

Sources: [MIT-NET](https://sg.mitsubishielectric.com/fa/products/cnt/plcf/pmerit/communication/ethernet.html), [MIT-HW](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d55301/jy997d55301u.pdf), [MIT-INDEX](https://www.mitsubishielectric.com/fa/products/faspec/download.page?category=ex&formNm=FX5_ENETIP_FX5-ENET%2FIP_7265&id=spec&kisyu=%2Fplcnet&lang=2&word=Ethernet), [MIT-SLMP](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d56001/jy997d56001k.pdf). See source register for edition/access depth.
