# Evidence-backed hardware catalog (planned)

No fabricated universal model database is supplied. The current multi-brand research baseline remains in `../archive/legacy-handoff/knowledge-base/` with its compatibility CSV. That matrix describes research and old driver status, not compatibility of the new application.

`plc/`, `modules/` and `sensors/` reserve separate data domains. A catalog schema must cover ID/version, manufacturer, exact order code, firmware/interface bounds, source URL/manual revision/locator, documented capabilities, implemented driver reference and exact hardware-validation evidence. Module records add channel/terminal/electrical metadata; sensor records add quantity/range/unit/datasheet references. Never infer firmware ranges or pinouts from family names.

The new app will allow all site choices through controls, and custom unverified profiles when an implemented protocol supports them. Research profiles cannot be promoted by merely entering a model name. Catalog availability and tested support are separate UI states.
