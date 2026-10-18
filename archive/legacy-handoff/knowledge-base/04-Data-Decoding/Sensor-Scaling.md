# Scaling and engineering validation

Current transform: value = decodedRaw × Scale + Offset. Preserve RawValue/RawHex and unit. Example 1234 × 0.1 = 123.4 °C is an application fixture, not an FX5U analog range. Range bounds are engineering-validity checks, not automatic clamping. Invalid values must remain visible as bad/uncertain quality.

Future endpoint transform: engineering = engLow + (raw - rawLow) × (engHigh - engLow)/(rawHigh - rawLow). Reject equal raw endpoints and nonfinite values. A 4–20 mA sensor’s ADC counts depend on the actual module and configured range; do not assume universal 0–4095, 0–32000 or 0–27648 scaling. Determine whether the PLC has already scaled the value to avoid applying scaling twice.

Gas-quality measurements need their real quantity/unit (ppm, %vol, etc.), instrument compensation and fault-state interpretation. Pressure may be absolute/gauge/differential; temperature can use different units. Counter rollover, rate calculation, debouncing and calibration history require explicit future transforms; they are not implemented by changing a display label.
