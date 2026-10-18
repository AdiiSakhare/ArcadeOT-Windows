# ArcadeOT delivery — 18 October 2026

Start with **docs/00_TODAY_FX5U.md**. The companion Windows release contains actual compiled `ui/arcadeOT.exe` and `service/ArcadeOT.Service.exe`, installation scripts and bundled runtime. This directory contains editable source, engineering specifications and a PLC integration knowledge base.

The user explicitly replaced simulator-first delivery with real FX5U testing today. All connection and sensor settings belong in the app. This release reads an actual PLC endpoint; it does not start a simulator or use invented measurements. Offline protocol checks use local test peers only.

Current implementation: Windows x64 desktop form, multiple direct FX5U connections, SLMP 3E TCP binary and ASCII, D numeric/M-X-Y Boolean reads, scaling, engineering limits, timestamps, quality, durable SQLite buffer, live dashboard, CSV export, generic authenticated HTTPS upload with per-event acknowledgment, automatic Windows Service and recovery. The UI requires local administrator access for this first release. Other protocol drivers, browser/cloud dashboard, granular roles, signed MSI and a hosted ingestion deployment remain implementation work; research documentation is not an implementation claim.

Read order:
1. docs/00_TODAY_FX5U.md — commissioning and installer.
2. docs/01_REQUIREMENTS_AND_RECONCILIATION.md — requirement coverage and missing originals.
3. docs/02_ARCHITECTURE.md through docs/07_ACCEPTANCE.md.
4. knowledge-base/00-README.md, research/SOURCES.md and compatibility matrix.
5. AGENTS.md and CODEX_EXECUTION.md before development.

Original `ArcadeOT_Codex_Package.zip` and `ArcadeOT_Master_Specification.md` were not found in accessible Documents, Downloads or Desktop file inventories. The referenced conversation exposes the historical sandbox links but no retrievable attachments. No claim is made that those original files were inspected or reconciled line by line. The existing separate mobile project at Documents/ArcadeOT was not modified. Preserve recovered originals under `originals/`, hash them, and reconcile using docs/01 before replacing any requirement.

Status wording: **documented** = vendor evidence; **implemented** = source exists; **build verified** = compiler passed; **protocol checked** = local automated checks; **hardware validated** = exact PLC/firmware/installation tested. No model is hardware validated in this delivery.
