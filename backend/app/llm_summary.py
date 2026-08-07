import os
from dotenv import load_dotenv
from app.prompts import CLINICIAN_PROMPT_TEMPLATE, PATIENT_PROMPT_TEMPLATE

# ── Ensure .env is loaded even if database.py was not imported first ──────────
# (mirrors the same guard in llm_extractor.py)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(_BASE_DIR, ".env"))


def generate_summary(patient_name: str, flagged_values: list, priority: str) -> tuple:
    """
    Explainability Layer — generates plain-language summaries using the Groq API
    (llama-3.3-70b-versatile). Requires GROQ_API_KEY environment variable.

    Produces two outputs in parallel (single API client, sequential calls):
      - Clinician Summary  : Dense, clinical language for the doctor dashboard
      - Patient Summary    : Plain-language, empathetic, jargon-free

    Args:
        patient_name:   Name of the patient.
        flagged_values: List of flagged test results from classify_report().
        priority:       Overall report priority ("Critical" | "Urgent" | "Normal").

    Returns:
        A tuple of (clinician_summary, patient_summary)
    """
    # Format the flagged values block for both prompts
    if not flagged_values:
        flagged_values_text = (
            "No abnormal values detected. "
            "All parameters fall within normal biological reference intervals."
        )
    else:
        flagged_values_text = "\n".join(
            [f"- {fv['test_name']}: {fv['value']} ({fv['reason']})"
             for fv in flagged_values]
        )

    clinician_prompt = CLINICIAN_PROMPT_TEMPLATE.format(
        patient_name=patient_name,
        priority=priority,
        flagged_values_text=flagged_values_text
    )

    patient_prompt = PATIENT_PROMPT_TEMPLATE.format(
        patient_name=patient_name,
        priority=priority,
        flagged_values_text=flagged_values_text
    )

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise ValueError(
            "GROQ_API_KEY is not set. Add it to your .env file and restart the server."
        )

    try:
        from groq import Groq
        client = Groq(api_key=groq_key)

        clinician_resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": clinician_prompt}],
            max_tokens=350,
            temperature=0.2
        )
        patient_resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": patient_prompt}],
            max_tokens=350,
            temperature=0.3
        )
        return (
            clinician_resp.choices[0].message.content.strip(),
            patient_resp.choices[0].message.content.strip()
        )
    except Exception as e:
        raise RuntimeError(f"Groq API call failed: {e}")
