# Omron FINS

Planned driver. FINS provides addressed controller commands across supported Omron networks. CP/CJ variants require different Ethernet/serial modules and configuration; a family name does not establish Ethernet reachability. Record destination/source network, node, unit, transport and service ID with memory area, word and bit address.

FINS/TCP includes connection/node negotiation beyond the FINS command header; FINS/UDP requires matching IDs and handling duplicates/timeouts. Decode response command and end code before accessing data. Memory areas such as CIO/DM/WR/HR/EM must be selected using the exact CPU’s table, not arbitrary universal byte codes. Host Link/C-mode is not synonymous with raw FINS Ethernet.

The W342 communications command manual and W420 Ethernet manual were identified via Omron references, but direct candidate URLs were inaccessible during research. No complete FINS wire specification or normative raw FINS fixture is claimed reviewed. Obtain the exact manuals/interface support and license an appropriate stack before implementing. NJ/NX require their own Sysmac/variable-access model; do not copy CJ memory semantics.

Sources: [OMR-FINS](https://www.ia.omron.com/support/faq/answer/26/faq00136/), [OMR-CP](https://www.ia.omron.com/products/family/1916/), [OMR-NJ](https://assets.omron.com/m/7b1f867d19635636/original/Sysmac-NJ-FINS-Technical-Guide.pdf), [OMR-CJ](https://www.ia.omron.com/data_pdf/cat/cj2m-cpu3__-cpu1_-md21__ds_e_12_7_csm2201.pdf?id=2712). See source register for edition/access depth.
