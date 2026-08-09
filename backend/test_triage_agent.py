from triage_agent import _clean_and_parse_json, validate_and_align_evidence


def test_clean_and_parse_json_raw():
    raw = '{"triage_level": "Priority", "reasoning": "Slight elevation.", "flagged_values": ["Glucose"], "evidence": [{"value_text": "Glucose: 135 mg/dL", "reason": "Elevated fasting blood sugar"}]}'
    res = _clean_and_parse_json(raw)
    assert res["triage_level"] == "Priority"
    assert res["flagged_values"] == ["Glucose"]
    assert len(res["evidence"]) == 1
    assert res["evidence"][0]["value_text"] == "Glucose: 135 mg/dL"
    assert "fasting blood sugar" in res["evidence"][0]["reason"]


def test_clean_and_parse_json_with_fences():
    fenced = '```json\n{"triage_level": "Critical", "reasoning": "High potassium.", "flagged_values": ["Potassium"], "evidence": [{"value_text": "Potassium: 6.8 mEq/L", "reason": "Severe hyperkalemia with cardiac risk"}]}\n```'
    res = _clean_and_parse_json(fenced)
    assert res["triage_level"] == "Critical"
    assert res["flagged_values"] == ["Potassium"]
    assert len(res["evidence"]) == 1
    assert res["evidence"][0]["value_text"] == "Potassium: 6.8 mEq/L"


def test_validate_and_align_evidence_exact():
    text = "LAB RESULTS\nTroponin I: 2.8 ng/mL (Ref: 0.0 - 0.04)\nGlucose: 95 mg/dL"
    evidence = [
        {"value_text": "Troponin I: 2.8 ng/mL", "reason": "Critical troponin elevation suggesting acute myocardial injury."}
    ]
    verified = validate_and_align_evidence(evidence, text)
    assert len(verified) == 1
    assert verified[0]["value_text"] == "Troponin I: 2.8 ng/mL"
    assert "myocardial injury" in verified[0]["reason"]


def test_validate_and_align_evidence_case_insensitive():
    text = "LAB RESULTS\nTroponin I: 2.8 ng/mL (Ref: 0.0 - 0.04)\nGlucose: 95 mg/dL"
    evidence = [
        {"value_text": "troponin i: 2.8 ng/ml", "reason": "Case insensitive test."}
    ]
    verified = validate_and_align_evidence(evidence, text)
    assert len(verified) == 1
    assert verified[0]["value_text"] == "Troponin I: 2.8 ng/mL"  # Recovered verbatim slice


def test_validate_and_align_evidence_whitespace_normalized():
    text = "LAB RESULTS\nGlucose,   Serum:    380 mg/dL (Ref: 70-99)\nPotassium: 4.2"
    evidence = [
        {"value_text": "Glucose, Serum: 380 mg/dL", "reason": "Severe hyperglycemia requiring urgent care."}
    ]
    verified = validate_and_align_evidence(evidence, text)
    assert len(verified) == 1
    assert verified[0]["value_text"] == "Glucose,   Serum:    380 mg/dL"


def test_validate_and_align_evidence_drop_unmatchable():
    text = "LAB RESULTS\nHemoglobin: 14.2 g/dL\nPlatelets: 250 K/uL"
    evidence = [
        {"value_text": "Troponin I: 5.0 ng/mL", "reason": "Hallucinated biomarker not in text."}
    ]
    verified = validate_and_align_evidence(evidence, text)
    assert len(verified) == 0  # Dropped completely rather than highlighting wrong text
