# Workspace organization audit — 18 October 2026

This is the historical folder-organization record. Subsequent implementation and verification are recorded in [build status](BUILD-STATUS.md).

## Completed

- Inventoried and SHA-256 hashed all 700 files in the two supplied packages, including binary payloads. Inventory: `research/original-file-inventory.json`.
- Read the supplied application source, scripts, tests, contracts, schemas, examples, engineering documents, research/provenance and PLC knowledge-base text. Binary runtime libraries were inventoried/hashed rather than reverse-engineered.
- Verified all 624 legacy release manifest entries and all 74 legacy handoff manifest entries. Both manifests and all original package files remain unchanged after relocation.
- Confirmed `arcadeOT.exe` and `ArcadeOT.Service.exe` have AMD64 Windows PE headers. This checks file format, not execution or provenance/signature trust.
- Created the replacement source/test/catalog/docs/config/packaging layout and a root entry point. Copied v1 contracts/schemas/disabled examples as migration inputs with the originals retained.
- Removed only `.DS_Store` metadata and the root guide proven byte-identical to the retained handoff guide. Moves and removals: `research/reorganization-log.json`.
- Parsed workspace JSON, executed the baseline SQLite DDL in an in-memory database, and checked the new Markdown file links. Machine-readable results: `research/workspace-verification.json`.
- Downloaded six official manual PDFs. Two further requests failed and are recorded as unavailable rather than complete. URLs/hashes/results are in `references/`; cover and targeted text checks are in `references/pdf-review.json`.

## Limits

This is a folder restructuring/research/planning pass. No new application code, executable, MSI or EXE installer has been implemented or built. Source directories contain scope notes only.

.NET SDK and PowerShell were not found on this session's PATH. The current host is macOS. No fresh compilation, NuGet vulnerability audit, Windows installation/UI/service/boot execution, physical PLC validation or cloud deployment was run. Historical build claims remain only in the archived handoff and are not promoted to new test results.

The previous app is isolated under `archive/`, not placed in macOS Trash. This preserves a recovery/reference copy while the new application does not yet exist. Retiring that copy is scheduled after the replacement passes acceptance. It is not an active development dependency.

## Repeatable checks

From this workspace root:

```sh
python3 scripts/verify_workspace.py
```

This is a read-only check of the archive and a basic check of the prepared workspace, except for updating its JSON report. It contacts no PLC and installs/runs no Windows software.
