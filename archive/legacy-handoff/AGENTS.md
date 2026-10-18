# ArcadeOT implementation rules

Read README.md, docs/01_REQUIREMENTS_AND_RECONCILIATION.md and CODEX_EXECUTION.md before changing code. The latest human direction is **real FX5U hardware testing first today**, with all site settings configurable through the app. Do not replace that objective with simulator-first work or additional planning-only deliverables.

Preserve originals byte-for-byte when recovered; do not claim they were read if missing. Preserve the independent UI/service design: arcadeOT.exe configures/observes, ArcadeOT.Service.exe owns collection and starts at Windows boot without login. Never couple collection lifetime to UI lifetime.

Implement read-only PLC operations. Never issue write, reset, run/stop, unlock or broad discovery commands as an incidental test. Never fabricate registers, pinouts, firmware limits, licenses, compatibility status or successful hardware checks. Use official sources, exact editions/locators and explicit unknowns. Model metadata entered by the operator is not identity verification.

Every sensor needs stable ID, mapping/type/order/scaling/unit, quality and timestamp provenance. Multiple PLCs and arbitrary mixed/repeated sensor lists are first-class. No fixed temperature/pressure slots. Preserve UTC and raw values; bad/missing data is null, never zero/Good. Never invent source timestamps.

Persist before claiming a current sample. Keep unsent records until explicit sink commit acknowledgment; preserve event IDs across retry. Report storage exhaustion and avoid silent loss. Do not put secrets into JSON config, logs, CSV or source control. Keep local API loopback-only and authenticated. Do not weaken data ACLs to make non-admin UI access work.

Run core checks, compile both Windows projects with warnings treated as errors, audit restored packages and publish self-contained win-x64 outputs. Test install/boot/recovery on Windows and values/reconnect on the exact hardware before promoting status. If the environment lacks Windows/PLC, say so and retain pending hardware gates. See docs/07_ACCEPTANCE.md.

Additional protocols need a capability descriptor, versioned structured config, source evidence and independent hardware status. Keep the compatibility CSV/Markdown consistent. Do not rewrite the separate mobile app or assume its API contracts; inspect/reconcile first. Keep sample endpoints disabled and label constructed fixtures as test-only.
