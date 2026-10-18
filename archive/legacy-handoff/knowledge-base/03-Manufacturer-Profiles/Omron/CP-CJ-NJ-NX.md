# Omron CP / CJ / NJ / NX

Research-backed, conditional candidates; no Omron driver implemented. CP1L-EM/EL have embedded Ethernet while CP1L-M/L differ; a CP-family profile must name exact CPU and interface. CJ2M CPU3/CPU1 variants and add-on Ethernet products require separate connection evidence. Target FINS only after obtaining the selected CPU commands and network-unit manuals.

Required manuals: W342 for CS/CJ/CP/NSJ CPU commands; W420 for applicable Ethernet-unit network construction; exact CP1L/CJ hardware manual. Direct candidate W342/W420 PDF URLs were inaccessible and are not claimed verified. CP1E W479-E1-09 supplies a separate hardware reference, not a CP1L terminal layout. NJ FINS W518 confirms a separate guide exists; NX/NJ symbolic variable mapping, FINS support and OPC UA server availability must be checked by exact CPU/firmware.

Config includes CPU order code, unit version, interface SKU, FINS transport/network/node/unit, source node conversion policy, area/word/bit address, datatypes/order and signal map. No generic Omron FINS memory-area byte table or pinout is invented. Confirm the I/O table and PLC program mapping before reading data.

Sources: [OMR-CP](https://www.ia.omron.com/products/family/1916/), [OMR-FINS](https://www.ia.omron.com/support/faq/answer/26/faq00136/), [OMR-NJ](https://assets.omron.com/m/7b1f867d19635636/original/Sysmac-NJ-FINS-Technical-Guide.pdf), [OMR-HW](https://assets.omron.com/m/555e9a5e7b4c8f0d/original/CP1E-Hardware-Users-Manual.pdf), [OMR-CJ](https://www.ia.omron.com/data_pdf/cat/cj2m-cpu3__-cpu1_-md21__ds_e_12_7_csm2201.pdf?id=2712). See source register for edition/access depth.
