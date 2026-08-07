"""
llm_extractor.py
────────────────
Single-responsibility: extract structured lab values from raw text or images.

WHY this is separate from llm_summary.py:
  - Different prompt, different JSON schema, different error handling
  - Keeps each module focused on one job (Single Responsibility Principle)
  - Makes it trivial to swap the extraction model independently of the summary model

MODEL ROUTING (Groq-exclusive):
  Text PDFs  → GROQ llama-3.3-70b-versatile  (fast, structured JSON extraction)
  Images/Scanned PDFs → GROQ qwen/qwen3.6-27b  (multimodal vision capable)
  No GROQ_API_KEY → raises ValueError with clear message
"""

import os
import json
import re
from typing import Optional
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from app.prompts import EXTRACTION_PROMPT_TEMPLATE

# ── Ensure env is loaded even if database.py was not imported first ───────────
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
load_dotenv(os.path.join(_BASE_DIR, ".env"))


# The 8 standard parameters we recognise. Any key not in this set is discarded.
STANDARD_PARAMS = [
    "Hemoglobin",
    "WBC Count",
    "Platelet Count",
    "Glucose (fasting)",
    "Creatinine",
    "Potassium",
    "Sodium",
    "Blood Pressure (systolic)",
]


def _parse_llm_json(raw: str) -> dict:
    r"""
    Robustly extract the FIRST non-empty JSON object from LLM output.

    Uses a character-level brace-counting walk so it handles:
      - Markdown code fences
      - Conversational prefix/suffix text from the model
      - Qwen3 <think>...</think> reasoning blocks
      - Multiple JSON objects (takes the first one that has actual keys)
      - Correctly nested objects inside test_values

    The old regex r"(\{.*\})" with re.DOTALL was GREEDY: it matched
    from the FIRST '{' to the LAST '}', merging separate JSON objects
    into one malformed string, causing:
        json.JSONDecodeError: Extra data: line 1 column 3 (char 2)
    """
    # 1. Strip markdown fences
    text = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    # 2. Scan through the text looking for complete JSON objects.
    #    We may encounter empty {} objects before the real one, so we
    #    iterate and skip any object that is empty (has no keys).
    pos = 0
    while True:
        # Find the next '{' from current position
        start = text.find("{", pos)
        if start == -1:
            raise ValueError(
                f"LLM returned no JSON object. Raw response (first 300 chars): {raw[:300]!r}"
            )

        # Walk forward using brace counting to find matching '}'
        depth = 0
        in_string = False
        escape_next = False
        end = -1

        for i, ch in enumerate(text[start:], start):
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break

        if end == -1:
            raise ValueError(
                f"LLM returned an incomplete JSON object (unbalanced braces). "
                f"Raw (first 300 chars): {raw[:300]!r}"
            )

        candidate = text[start : end + 1]
        parsed = json.loads(candidate)

        # Skip trivially empty objects like {} — keep looking for the real payload
        if isinstance(parsed, dict) and len(parsed) > 0:
            return parsed

        # Empty object — advance past it and keep searching
        pos = end + 1




def _sanitise_result(data: dict) -> dict:
    """
    Normalise the LLM output:
    - Ensure patient_name is a non-empty string
    - Ensure test_values contains only the 8 known params, as float | None
    """
    patient_name = (data.get("patient_name") or "Unknown").strip() or "Unknown"
    raw_values = data.get("test_values", {}) or {}

    test_values = {}
    for param in STANDARD_PARAMS:
        v = raw_values.get(param)
        if v is None:
            test_values[param] = None
        else:
            try:
                test_values[param] = float(v)
            except (TypeError, ValueError):
                test_values[param] = None

    return {"patient_name": patient_name, "test_values": test_values}


# ─── Text-based extraction (Groq / OpenAI / Anthropic) ───────────────────────

def _extract_via_text(report_text: str) -> dict:
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(report_text=report_text)

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise ValueError("GROQ_API_KEY environment variable is not configured.")


    from groq import Groq
    client = Groq(api_key=groq_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        temperature=0.0,
    )
    raw = response.choices[0].message.content
    return _sanitise_result(_parse_llm_json(raw))



# ─── Vision-based extraction (Groq vision / OpenAI vision) ───────────────────

VISION_PROMPT = (
    "This is a medical lab report image. Extract all laboratory values and the "
    "patient name. Return ONLY a JSON object with keys 'patient_name' (string) "
    "and 'test_values' (object). Map synonyms: Hgb→Hemoglobin (g/dL), "
    "WBC/TLC→WBC Count (cells/mcL, multiply K/µL by 1000), "
    "PLT/Platelets→Platelet Count (cells/mcL, multiply K/µL by 1000), "
    "FBS/Blood Sugar→Glucose (fasting) (mg/dL), SCr→Creatinine (mg/dL), "
    "K+→Potassium (mEq/L), Na+→Sodium (mEq/L), SBP→Blood Pressure (systolic) (mmHg). "
    "Use null for any parameter not found. No markdown."
)


def _extract_via_vision(b64_image: str, mime_type: str = "image/png") -> dict:
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise ValueError("GROQ_API_KEY environment variable is not configured.")

    image_url = f"data:{mime_type};base64,{b64_image}"

    from groq import Groq
    client = Groq(api_key=groq_key)
    response = client.chat.completions.create(
        model="qwen/qwen3.6-27b",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": image_url}},
                {"type": "text", "text": VISION_PROMPT},
            ],
        }],
        max_tokens=2048,
        temperature=0.0,
    )

    raw = response.choices[0].message.content
    return _sanitise_result(_parse_llm_json(raw))



# ─── Public API ───────────────────────────────────────────────────────────────

def extract_lab_values(
    file_bytes: bytes,
    filename: str,
) -> dict:
    """
    Main entry point.  Chooses the appropriate strategy:
      PDF with text → text extraction → LLM text prompt
      PDF scanned   → render page → Vision LLM
      Image file    → base64      → Vision LLM

    Returns:
        {"patient_name": str, "test_values": {param: float|None, ...}}
    """
    from app.services.pdf_parser import (
        extract_text_from_pdf,
        pdf_first_page_to_base64,
        image_to_base64,
        get_mime_type,
    )

    ext = filename.rsplit(".", 1)[-1].lower()
    mime = get_mime_type(filename)

    if ext == "pdf":
        text = extract_text_from_pdf(file_bytes)
        if text and len(text) > 30:
            # Native text PDF — fast path
            return _extract_via_text(text)
        else:
            # Scanned PDF — render to image and use Vision LLM
            b64 = pdf_first_page_to_base64(file_bytes)
            return _extract_via_vision(b64, mime_type="image/png")
    else:
        # Direct image upload
        b64 = image_to_base64(file_bytes)
        return _extract_via_vision(b64, mime_type=mime)
