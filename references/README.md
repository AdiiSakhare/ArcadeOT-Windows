# Official reference library

Local PDFs are engineering review copies from manufacturer/standards-owner sites, not application runtime dependencies. Do not bundle these third-party documents into a commercial installer without checking redistribution rights. No private site wiring or sensor map is supplied.

- `download-urls.json`: official requested URLs.
- `download-status.json`: actual download outcome, byte count and SHA-256.
- `pdf-review.json`: PDF page counts and targeted review locators; this does not mean every page was reviewed.
- `manuals/`: downloaded original PDFs, excluded from source control by default.

Run `python3 scripts/fetch_references.py` from the workspace root to refresh downloads when network access is available. Vendor URLs may change; retain hashes and approved revisions for actual driver work. Download failure does not establish lack of vendor capability.

See `../research/RESEARCH-UPDATE.md` for the new findings, access limits and source links. Historical source register and knowledge base remain in `../archive/legacy-handoff/research/` and `../archive/legacy-handoff/knowledge-base/`.
