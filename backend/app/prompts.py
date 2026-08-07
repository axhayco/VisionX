# prompts.py
# ──────────────────────────────────────────────────────────────────────────────
# Prompt templates for each stage of the VisionX AI pipeline.
#
# Pipeline role:
#   EXTRACTION_PROMPT_TEMPLATE → PDF Text Extraction → Structured Lab Value Extraction
#   CLINICIAN_PROMPT_TEMPLATE  → Explainability Layer → Doctor Summary
#   PATIENT_PROMPT_TEMPLATE    → Explainability Layer → Patient Summary
# ──────────────────────────────────────────────────────────────────────────────

CLINICIAN_PROMPT_TEMPLATE = """You are a clinical assistant. Review the following flagged abnormal values for patient {patient_name} in their lab report (overall priority: {priority}).

Flagged values:
{flagged_values_text}

Generate a concise, 2-3 sentence clinician-facing summary written for a doctor. It must be clinically dense, reference the specific abnormal values and what they suggest together as a cohesive clinical picture (do not just list them individually), and suggest a clear next clinical action. Do not include introductory text.
"""

PATIENT_PROMPT_TEMPLATE = """You are an empathetic, clear medical communicator. Review the following flagged abnormal values for patient {patient_name} in their lab report (overall priority: {priority}).

Flagged values:
{flagged_values_text}

Generate a concise, 2-3 sentence patient-facing summary written in plain, everyday language that a non-medical person can easily understand. Use a calm, reassuring tone, explain what the abnormal values mean in simple terms, and tell them what to expect next (e.g., that their doctor will contact them shortly). Do not use complex medical jargon or cause panic. Do not include introductory text.
"""

# ──────────────────────────────────────────────────────────────────────────────
# Extraction prompt — Structured Lab Value Extraction layer.
# Used by POST /api/extract to parse raw report text into a structured JSON
# payload before the Clinical Risk Scoring Engine runs.
# ──────────────────────────────────────────────────────────────────────────────

EXTRACTION_PROMPT_TEMPLATE = """You are a precise medical data extraction system.
Extract laboratory values from the following lab report text and return them as
structured JSON. Map any synonym to the EXACT standard parameter names listed.

STANDARD PARAMETERS (map all synonyms to these names):
  "Hemoglobin"               — synonyms: Hgb, HGB, Hb, Haemoglobin        | unit: g/dL
  "WBC Count"                — synonyms: WBC, TLC, Leukocytes, White Cells  | unit: cells/mcL
  "Platelet Count"           — synonyms: PLT, Platelets, Thrombocytes       | unit: cells/mcL
  "Glucose (fasting)"        — synonyms: FBS, Blood Sugar, RBS, Glucose     | unit: mg/dL
  "Creatinine"               — synonyms: SCr, Serum Creatinine, Creat       | unit: mg/dL
  "Potassium"                — synonyms: K, K+, Serum Potassium             | unit: mEq/L
  "Sodium"                   — synonyms: Na, Na+, Serum Sodium              | unit: mEq/L
  "Blood Pressure (systolic)"— synonyms: BP systolic, SBP, Systolic BP     | unit: mmHg

UNIT CONVERSION RULES:
  - WBC or Platelet Count given as K/µL or ×10³/µL → multiply by 1000
  - Hemoglobin given as g/L → divide by 10
  - If a value is already a decimal, preserve it exactly

LAB REPORT TEXT:
{report_text}

CRITICAL OUTPUT RULES:
  - Your response must start with '{{' and end with '}}'.
  - Return ONLY the JSON object — no preamble, no explanation, no thinking, no markdown.
  - Use null (not "null", not "N/A") for any parameter not found in the text.

{{
  "patient_name": "<full name or Unknown>",
  "test_values": {{
    "Hemoglobin": <number or null>,
    "WBC Count": <number or null>,
    "Platelet Count": <number or null>,
    "Glucose (fasting)": <number or null>,
    "Creatinine": <number or null>,
    "Potassium": <number or null>,
    "Sodium": <number or null>,
    "Blood Pressure (systolic)": <number or null>
  }}
}}
"""
