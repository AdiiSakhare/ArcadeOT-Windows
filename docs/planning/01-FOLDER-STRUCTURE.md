# Complete folder structure

This layout is implemented on disk. Source and test projects now contain the v0.3.0 implementation; catalog directories reserve unpopulated reference domains. Existing source and executables are isolated together under archive so the replacement can be developed cleanly.

```text
ArcadeOT-Windows-x64/
├── README.md
├── AGENTS.md
├── .gitignore
├── src/
│   ├── ArcadeOT.Desktop/          WPF desktop, MVVM, configuration and monitoring
│   ├── ArcadeOT.Service/          Windows host, boot startup, local API
│   ├── ArcadeOT.Domain/           IDs, typed values, quality and mapping concepts
│   ├── ArcadeOT.Application/      configuration, polling and delivery use cases
│   ├── ArcadeOT.Infrastructure/   SQLite, secrets, HTTP upload and diagnostics
│   └── ArcadeOT.Drivers.Slmp/      read-only Mitsubishi transport and codec
├── tests/
│   ├── unit/                     decoding, validation and transformations
│   ├── integration/              persistence, IPC and ingestion behavior
│   └── hardware/                 exact model/firmware acceptance records
├── catalog/
│   ├── plc/                      evidence-backed CPU/interface profiles
│   ├── modules/                  I/O channel/terminal profiles
│   └── sensors/                  sensor reference metadata and templates
├── config/examples/              copied disabled v1 examples, not site mappings
├── contracts/                    v1 API/driver baseline to reconcile
├── schemas/                      v1 JSON/SQL baseline to migrate
├── docs/
│   ├── planning/                 folder map, build plan, legacy review
│   ├── product/                  operator requirements
│   ├── architecture/             boundaries and future component ownership
│   ├── ux/                       guided setup and sensor workspace
│   └── validation/               audit and acceptance evidence
├── research/                     original inventory, changes, new findings
├── references/
│   ├── manuals/                  official PDF copies when download succeeds
│   ├── download-urls.json        reproducible vendor URL list
│   └── download-status.json      success/failure, size and SHA-256
├── packaging/windows/            native EXE bootstrapper, install/uninstall and manifests
├── scripts/                      reference fetch and workspace verification
├── artifacts/                    generated replacement release output
└── archive/
    ├── legacy-release/           old ui/, service/, runtime DLLs and installer
    └── legacy-handoff/           old source, engineering docs and knowledge base
```

The two old package checksum files still validate within their new archive locations. Moving entire packages preserves their relative paths. A root commissioning guide was removed only after byte comparison proved it duplicated the retained legacy guide. Finder `.DS_Store` metadata was removed. No legacy source or runtime dependency was deleted.

Working contract/schema copies are intentional migration inputs. They are not a second independent authority. Their README files identify the original implementation. Update new contracts and code together when v2 is implemented; preserve archived v1 originals.

The workspace now includes ArcadeOT.slnx, pinned global.json, shared build properties, NuGet lock files, a Windows CI workflow and publish/install scripts. The native single-EXE bootstrapper is implemented under packaging/windows/bootstrapper. Authenticode signing, optional MSI/Burn packaging and a verified hardware catalog remain pending.
