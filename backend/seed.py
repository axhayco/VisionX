import sys
import os
from datetime import datetime, timedelta

# Add backend directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app import models
from app.classifier import classify_report
from app.llm_summary import generate_summary

SAMPLES = [
    {
        "patient_name": "Jane Doe",
        "submitted_offset_hours": 1,
        "test_values": {
            "Hemoglobin": 14.2,
            "WBC Count": 6500,
            "Platelet Count": 250000,
            "Glucose (fasting)": 88,
            "Creatinine": 0.8,
            "Potassium": 4.1,
            "Sodium": 139,
            "Blood Pressure (systolic)": 115
        }
    },
    {
        "patient_name": "John Smith",
        "submitted_offset_hours": 2,
        "test_values": {
            "Hemoglobin": 7.2,  # Critical low (<8.0)
            "WBC Count": 8500,
            "Platelet Count": 180000,
            "Glucose (fasting)": 92,
            "Creatinine": 0.9,
            "Potassium": 3.9,
            "Sodium": 137,
            "Blood Pressure (systolic)": 105
        }
    },
    {
        "patient_name": "Alice Johnson",
        "submitted_offset_hours": 3,
        "test_values": {
            "Hemoglobin": 11.5,  # Urgent low (8.0 - 11.9)
            "WBC Count": 12500,  # Urgent high (11001 - 30000)
            "Platelet Count": 480000,  # Urgent high (450001 - 999999)
            "Glucose (fasting)": 110,  # Urgent high (100 - 249)
            "Creatinine": 1.4,  # Urgent high (1.3 - 2.9)
            "Potassium": 3.2,  # Urgent low (3.0 - 3.4)
            "Sodium": 130,  # Urgent low (125 - 134)
            "Blood Pressure (systolic)": 135  # Urgent high (121 - 179)
        }
    },
    {
        "patient_name": "Bob Miller",
        "submitted_offset_hours": 4,
        "test_values": {
            "Hemoglobin": 15.0,
            "WBC Count": 32000,  # Critical high (>=30000)
            "Platelet Count": 40000,  # Critical low (<50000)
            "Glucose (fasting)": 280,  # Critical high (>=250)
            "Creatinine": 3.5,  # Critical high (>=3.0)
            "Potassium": 6.2,  # Critical high (>=6.0)
            "Sodium": 120,  # Critical low (<125)
            "Blood Pressure (systolic)": 190  # Critical high (>=180)
        }
    },
    {
        "patient_name": "Robert Lee",
        "submitted_offset_hours": 5,
        "test_values": {
            "Hemoglobin": 13.5,
            "WBC Count": 5000,
            "Platelet Count": 300000,
            "Glucose (fasting)": 115,  # Urgent high
            "Creatinine": 1.1,
            "Potassium": 4.5,
            "Sodium": 140,
            "Blood Pressure (systolic)": 125  # Urgent high
        }
    },
    {
        "patient_name": "Sarah Davis",
        "submitted_offset_hours": 6,
        "test_values": {
            "Hemoglobin": 9.5,  # Urgent low
            "WBC Count": 15000,  # Urgent high
            "Platelet Count": 140000,  # Urgent low
            "Glucose (fasting)": 65,  # Urgent low
            "Creatinine": 1.8,  # Urgent high
            "Potassium": 5.4,  # Urgent high
            "Sodium": 132,  # Urgent low
            "Blood Pressure (systolic)": 85  # Urgent low
        }
    },
    {
        "patient_name": "David Wilson",
        "submitted_offset_hours": 7,
        "test_values": {
            "Hemoglobin": 16.5,
            "WBC Count": 7200,
            "Platelet Count": 220000,
            "Glucose (fasting)": 85,
            "Creatinine": 0.7,
            "Potassium": 4.0,
            "Sodium": 138,
            "Blood Pressure (systolic)": 118
        }
    },
    {
        "patient_name": "Emily Taylor",
        "submitted_offset_hours": 8,
        "test_values": {
            "Hemoglobin": 12.8,
            "WBC Count": 9000,
            "Platelet Count": 280000,
            "Glucose (fasting)": 90,
            "Creatinine": 0.8,
            "Potassium": 2.8,  # Critical low (<3.0)
            "Sodium": 148,  # Urgent high
            "Blood Pressure (systolic)": 95
        }
    },
    {
        "patient_name": "James Martinez",
        "submitted_offset_hours": 9,
        "test_values": {
            "Hemoglobin": 18.2,  # Urgent high
            "WBC Count": 18000,  # Urgent high
            "Platelet Count": 420000,
            "Glucose (fasting)": 105,  # Urgent high
            "Creatinine": 2.5,  # Urgent high
            "Potassium": 5.8,  # Urgent high
            "Sodium": 142,
            "Blood Pressure (systolic)": 160  # Urgent high
        }
    },
    {
        "patient_name": "Linda Anderson",
        "submitted_offset_hours": 10,
        "test_values": {
            "Hemoglobin": 14.5,
            "WBC Count": 10500,
            "Platelet Count": 310000,
            "Glucose (fasting)": 95,
            "Creatinine": 0.9,
            "Potassium": 4.3,
            "Sodium": 136,
            "Blood Pressure (systolic)": 65  # Critical low (<70)
        }
    }
]

def seed_db():
    print("Initializing database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Seeding database with sample lab reports...")
        for sample in SAMPLES:
            priority, flagged_values = classify_report(sample["test_values"])
            clinician_summary, patient_summary = generate_summary(
                patient_name=sample["patient_name"],
                flagged_values=flagged_values,
                priority=priority
            )
            
            # Stagger submitted_at times
            submitted_at = datetime.utcnow() - timedelta(hours=sample["submitted_offset_hours"])
            
            report = models.LabReport(
                patient_name=sample["patient_name"],
                submitted_at=submitted_at,
                test_values=sample["test_values"],
                priority=priority,
                flagged_values=flagged_values,
                clinician_summary=clinician_summary,
                patient_summary=patient_summary,
                processing_time_ms=850,
                confidence_score=100.0,
            )

            db.add(report)
        db.commit()
        print(f"Successfully seeded {len(SAMPLES)} records into the database.")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
