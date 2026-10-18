# Replacement desktop workflow

1. Site workspace: name/ID, service status, storage and cloud setup.
2. Add PLC: select manufacturer, family, exact model, firmware and interface. Show verified capability and driver status.
3. Connection: IP/host, actual port and driver-specific fields. Read-only single test with clear protocol/end-code diagnostics.
4. I/O layout: select module/slot/channel/terminals and attach manual diagram references. Unverified custom entries remain marked.
5. Sensors: link each channel to the PLC application's memory/tag/node mapping. Set type/order/scaling/unit/quality rules. Offer repeated groups and CSV import preview.
6. Review: validation results, overlaps, selected driver/profile versions and config diff. Save a new revision and enable collection.
7. Monitor: searchable live rows, raw/scaled values, per-PLC health, history and queue/disk states. Open diagnostics from the failed mapping.

All existing runtime configuration fields receive ordinary controls, including PLC removal, retention, buffer size and site ID. Model and terminal selection does not enable an unimplemented driver. Template addresses remain disabled examples until reviewed. Display hardware validation separately from an operator's selected model label.

The UI should use a consistent navigation shell, readable tables, keyboard navigation, accessible validation and useful empty/offline states. WPF/MVVM is the recommended new desktop baseline; visual design and interactive verification are a later implementation task.
