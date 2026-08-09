import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List
from dotenv import find_dotenv, load_dotenv
from groq import Groq

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an AI screening triage assistant for laboratory reports. You are NOT a diagnostic tool.
Your role is to assist clinical workflow by screening lab reports for abnormal values relative to standard reference ranges.

Instructions:
1. Read the provided lab report text carefully.
2. Identify any abnormal, elevated, or deficient values relative to standard clinical reference ranges.
3. Assign an appropriate triage level:
   - "Routine": All values within normal limits or trivial deviations with no urgency.
   - "Priority": Mild abnormalities that require non-immediate clinical review or follow-up.
   - "Urgent": Significant abnormalities that warrant prompt clinical attention within 24-48 hours.
   - "Critical": Potentially life-threatening or panic-level values requiring immediate physician notification.
4. Provide clear reasoning in plain language (one paragraph). Explicitly state that this is an automated screening suggestion intended for human reviewer review, NOT a clinical diagnosis.
5. List all flagged abnormal test names in flagged_values.
6. For each flagged value, include exactly one corresponding entry in evidence:
   - "value_text": A short, EXACT substring quoted verbatim from the input text (e.g. "Troponin I: 2.8 ng/mL" or "Glucose, Serum: 380 mg/dL"). Do NOT paraphrase or reword; it must match character-for-character so it can be highlighted in the document viewer.
   - "reason": A single concise sentence explaining why this value drove the triage level.

You must respond with ONLY a valid JSON object in the following format:
{
  "triage_level": "Routine" | "Priority" | "Urgent" | "Critical",
  "reasoning": "<one paragraph plain language summary with explicit note that this is a screening suggestion for human review>",
  "flagged_values": ["<Test Name 1>", "<Test Name 2>"],
  "evidence": [
    {
      "value_text": "<short exact substring from the de-identified text>",
      "reason": "<why this value drove the triage level, one sentence>"
    }
  ]
}"""


def _clean_and_parse_json(content: str) -> dict:
    """Attempts to parse JSON from model output, handling potential markdown fences."""
    content = content.strip()
    # Remove markdown code fences if present
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Fallback regex extraction of first JSON object
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Failed to parse valid JSON from model response: {content}")


def validate_and_align_evidence(
    raw_evidence: List[Any], extracted_text: str
) -> List[Dict[str, str]]:
    """Validates and aligns evidence items against the original extracted text.

    Steps:
    1. Exact substring match against extracted_text.
    2. If exact fails, case-insensitive match (recovering verbatim slice).
    3. If case-insensitive fails, whitespace-normalized regex match (recovering verbatim slice).
    4. If all fail, drops the evidence item to prevent erroneous or misplaced text highlighting.

    Returns:
        List of aligned evidence dicts: [{"value_text": str, "reason": str}]
    """
    if not raw_evidence or not isinstance(raw_evidence, list) or not extracted_text:
        return []

    aligned_evidence: List[Dict[str, str]] = []

    for item in raw_evidence:
        if not isinstance(item, dict):
            continue

        raw_val = item.get("value_text")
        reason = item.get("reason", "")
        if not raw_val or not isinstance(raw_val, str):
            continue

        raw_val = raw_val.strip()
        if not raw_val:
            continue

        matched_substring: str | None = None

        # 1. Exact substring match
        if raw_val in extracted_text:
            matched_substring = raw_val

        # 2. Case-insensitive substring match
        if matched_substring is None:
            match = re.search(re.escape(raw_val), extracted_text, re.IGNORECASE)
            if match:
                matched_substring = extracted_text[match.start() : match.end()]

        # 3. Whitespace-normalized match (handles space/newline variations)
        if matched_substring is None:
            words = [re.escape(w) for w in raw_val.split() if w]
            if words:
                pattern = r"\s+".join(words)
                match = re.search(pattern, extracted_text, re.IGNORECASE)
                if match:
                    matched_substring = extracted_text[match.start() : match.end()]

        # 4. Keep if matched, drop if unmatchable
        if matched_substring is not None:
            aligned_evidence.append(
                {
                    "value_text": matched_substring,
                    "reason": str(reason).strip(),
                }
            )
        else:
            logger.warning(
                "Dropping unmatchable evidence substring: '%s' (not found in extracted_text)",
                raw_val,
            )

    return aligned_evidence


def classify_triage(extracted_text: str) -> dict:
    """Calls Groq API to triage the extracted lab report text and returns structured JSON.

    Args:
        extracted_text: Text extracted from the lab report PDF.

    Returns:
        dict containing triage_level, reasoning, flagged_values, and verified evidence.
    """
    # Attempt to load .env from backend directory and ancestors
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        load_dotenv(find_dotenv(), override=True)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY environment variable is not set. Please add it to your backend/.env file."
        )

    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    client = Groq(api_key=api_key)

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Please triage the following lab report text:\n\n{extracted_text}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        raw_content = completion.choices[0].message.content
        result = _clean_and_parse_json(raw_content)

        raw_evidence = result.get("evidence", [])
        verified_evidence = validate_and_align_evidence(
            raw_evidence, extracted_text
        )

        return {
            "triage_level": result.get("triage_level", "Routine"),
            "reasoning": result.get(
                "reasoning",
                "Screening suggestion generated for human review. No additional reasoning provided.",
            ),
            "flagged_values": result.get("flagged_values", []),
            "evidence": verified_evidence,
        }
    except Exception as e:
        if "response_format" in str(e).lower():
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Please triage the following lab report text:\n\n{extracted_text}",
                    },
                ],
                temperature=0.1,
            )
            raw_content = completion.choices[0].message.content
            result = _clean_and_parse_json(raw_content)
            raw_evidence = result.get("evidence", [])
            verified_evidence = validate_and_align_evidence(
                raw_evidence, extracted_text
            )

            return {
                "triage_level": result.get("triage_level", "Routine"),
                "reasoning": result.get("reasoning", ""),
                "flagged_values": result.get("flagged_values", []),
                "evidence": verified_evidence,
            }
        raise e
