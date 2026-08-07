from app.reference_ranges import REFERENCE_RANGES

def classify_report(test_values: dict) -> tuple[str, list]:
    """
    Classifies a lab report based on the provided test values.

    Implements the Clinical Risk Scoring Engine layer of the pipeline:
      1. Normalises each value against reference ranges (Feature Normalization)
      2. Applies deterministic clinical rules (Critical / Urgent thresholds)
      3. Returns the worst-case priority and all flagged findings (Explainability)

    Args:
        test_values: dict mapping test names to numeric values (or None for missing).

    Returns:
        A tuple of (priority, flagged_values)
        - priority: "Critical", "Urgent", or "Normal" (worst flag determines priority)
        - flagged_values: List of dicts, each with {test_name, value, reason}
    """
    priority = "Normal"
    flagged_values = []

    for test_name, value in test_values.items():
        # ── Feature Normalization Guard ───────────────────────────────────────
        # Skip parameters that were not present in the uploaded report (null).
        # This is expected for partial PDFs — not a data error.
        if value is None:
            continue

        if test_name not in REFERENCE_RANGES:
            continue

        cfg  = REFERENCE_RANGES[test_name]
        unit = cfg["unit"]

        # ── Critical Low Check ────────────────────────────────────────────────
        if cfg.get("critical_low") is not None and value < cfg["critical_low"]:
            flagged_values.append({
                "test_name": test_name,
                "value":     value,
                "reason":    (
                    f"Critical low: {value} {unit} is below the critical threshold "
                    f"of {cfg['critical_low']} {unit}."
                )
            })
            priority = "Critical"
            continue

        # ── Critical High Check ───────────────────────────────────────────────
        if cfg.get("critical_high") is not None and value >= cfg["critical_high"]:
            flagged_values.append({
                "test_name": test_name,
                "value":     value,
                "reason":    (
                    f"Critical high: {value} {unit} is at or above the critical threshold "
                    f"of {cfg['critical_high']} {unit}."
                )
            })
            priority = "Critical"
            continue

        # ── Urgent Check ──────────────────────────────────────────────────────
        is_urgent    = False
        urgent_reason = ""
        for urgent_range in cfg.get("urgent", []):
            min_val = urgent_range.get("min")
            max_val = urgent_range.get("max")
            if min_val is not None and max_val is not None:
                if min_val <= value <= max_val:
                    is_urgent     = True
                    normal_min    = cfg["normal"]["min"]
                    normal_max    = cfg["normal"]["max"]
                    if value < normal_min:
                        urgent_reason = (
                            f"Urgent low: {value} {unit} is below the normal range "
                            f"of {normal_min}-{normal_max} {unit}."
                        )
                    else:
                        urgent_reason = (
                            f"Urgent high: {value} {unit} is above the normal range "
                            f"of {normal_min}-{normal_max} {unit}."
                        )
                    break

        if is_urgent:
            flagged_values.append({
                "test_name": test_name,
                "value":     value,
                "reason":    urgent_reason
            })
            if priority == "Normal":
                priority = "Urgent"

    return priority, flagged_values
