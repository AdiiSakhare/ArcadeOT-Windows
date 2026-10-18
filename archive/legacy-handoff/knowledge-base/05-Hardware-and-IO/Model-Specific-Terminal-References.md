# Model-specific I/O and terminal reference register

No site CPU/module/terminal-block order codes were provided. This table identifies the appropriate authoritative reference and the missing evidence; it is not an installation pinout. Never substitute a family diagram for an exact terminal assignment. No terminal number has been fabricated.

| Family / example reference | Official manual | Exact reference needed before wiring | Status |
|---|---|---|---|
| FX5U e.g. FX5U-32MR/ES | MIT-HW JY997D55301U; newer combined SH-082452ENG-P indexed | actual CPU supply/output suffix, terminal layout section/page, expansion analog SKU | reference located; site terminal mapping pending |
| S7-1200 | SIE-SEC/SIE-UA collection links installation and module sections | full 6ES7 SKU, CPU type, SM/SB part number and wiring diagram | per-module diagram pending |
| Delta DVP-SE/SS2/SX2 | DEL-CAT and DEL-PROG identify families | exact hardware instruction sheet and terminal page for CPU/module SKU | hardware sheet acquisition pending |
| M221 | SCH-HW EIO0000003313 v04 | full TM221 order code and expansion module, specific diagram/page | hardware guide located; exact diagram pending |
| Omron CP1E | OMR-HW W479-E1-09 | full CP1E suffix and expansion model | guide located; mapping pending |
| Omron CP1L/CJ2M | OMR-CP / OMR-CJ | exact CP1L/CJ CPU, expansion I/O and hardware guide edition | terminal manual acquisition pending |
| CompactLogix 5380 / 5069 I/O | RA-IO module installation index | exact 5069 module and removable terminal block SKU | installation index located; diagram pending |
| CompactLogix 1769 I/O | RA-DATA confirms separate controller family | exact 1769 hardware/terminal publication; do not borrow 5069 diagram | terminal reference pending |

An approved terminal record must capture full SKU, hardware revision, manual number/revision, diagram title/page, terminal designation, electrical function/rating, common grouping, source/sink and isolation, verified by/date. An approved sensor-map record additionally links PLC application register/tag and its encoding/scaling. Empty evidence disables any “verified wiring” claim.


Sources: [MIT-HW](https://dl.mitsubishielectric.com/dl/fa/document/manual/plcf/jy997d55301/jy997d55301u.pdf), [MIT-INDEX](https://www.mitsubishielectric.com/fa/products/faspec/download.page?category=ex&formNm=FX5_ENETIP_FX5-ENET%2FIP_7265&id=spec&kisyu=%2Fplcnet&lang=2&word=Ethernet), [SIE-UA](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/communication/opc-ua-server), [DEL-CAT](https://filecenter.deltaww.com/Products/download/06/060301/Catalogue/DELTA_IA-PLC_DVP_TP_C_EN_20240513.pdf), [DEL-PROG](https://filecenter.deltaww.com/Products/download/06/060302/Manual/DELTA_IA-PLC_DVP_ES2-EX2-EC5-SS2-SA2-SX2-SE-TP_PM_EN_20231221.pdf), [SCH-HW](https://www.se.com/us/en/download/document/EIO0000003313/), [OMR-HW](https://assets.omron.com/m/555e9a5e7b4c8f0d/original/CP1E-Hardware-Users-Manual.pdf), [OMR-CJ](https://www.ia.omron.com/data_pdf/cat/cj2m-cpu3__-cpu1_-md21__ds_e_12_7_csm2201.pdf?id=2712), [RA-IO](https://www.rockwellautomation.com/en-gb/support/documentation/technical/i-o/compact-5000-i-o-modules.html). See source register for edition/access depth.
