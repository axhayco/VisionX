import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.classifier import classify_report
from app.llm_summary import generate_summary

# 1. Normal Report Values (Jane Doe)
normal_values = {
    "Hemoglobin": 14.2,
    "WBC Count": 6500,
    "Platelet Count": 250000,
    "Glucose (fasting)": 88,
    "Creatinine": 0.8,
    "Potassium": 4.1,
    "Sodium": 139,
    "Blood Pressure (systolic)": 115
}

# 2. Critical Report Values (Bob Miller)
critical_values = {
    "Hemoglobin": 15.0,
    "WBC Count": 32000,  # Critical high
    "Platelet Count": 40000,  # Critical low
    "Glucose (fasting)": 280,  # Critical high
    "Creatinine": 3.5,  # Critical high
    "Potassium": 6.2,  # Critical high
    "Sodium": 120,  # Critical low
    "Blood Pressure (systolic)": 190  # Critical high
}

def test_report(name, values):
    print("\n" + "="*60)
    print(f"Testing Report for: {name}")
    print("="*60)
    
    priority, flagged = classify_report(values)
    print(f"Triage Result: Priority={priority}")
    print(f"Flagged values count: {len(flagged)}")
    for f in flagged:
        print(f"  - {f['test_name']}: {f['reason']}")
        
    print("\nCalling LLM API to generate summaries...")
    try:
        clinician_summary, patient_summary = generate_summary(name, flagged, priority)
        print("\n[CLINICIAN SUMMARY] (Blue Card)")
        print(clinician_summary)
        print("\n[PATIENT SUMMARY] (Green Card)")
        print(patient_summary)
    except Exception as e:
        print(f"\nERROR calling LLM: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

    if "GROQ_API_KEY" not in os.environ:
        print("ERROR: GROQ_API_KEY is not set in your environment.")
        print("Please configure it in .env and re-run this script.")
        sys.exit(1)
        
    print("Using provider: Groq (llama-3.3-70b-versatile)")
    
    test_report("Jane Doe (Normal Case)", normal_values)
    test_report("Bob Miller (Critical Case)", critical_values)

