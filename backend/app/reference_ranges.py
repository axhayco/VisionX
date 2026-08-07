# Reference ranges and thresholds for the 8 medical tests.
# Standard ranges based on clinical references:
# - Normal: Expected healthy baseline
# - Urgent: Elevated or depressed levels requiring prompt review
# - Critical: Severe abnormal levels requiring immediate intervention / alert

REFERENCE_RANGES = {
    "Hemoglobin": {
        "unit": "g/dL",
        "normal": {"min": 12.0, "max": 17.5},
        "urgent": [
            {"min": 8.0, "max": 11.9},
            {"min": 17.6, "max": 20.0}
        ],
        "critical_low": 8.0,
        "critical_high": 20.0,
        "description": "Measures the amount of oxygen-carrying protein in your blood."
    },
    "WBC Count": {
        "unit": "cells/mcL",
        "normal": {"min": 4500, "max": 11000},
        "urgent": [
            {"min": 2000, "max": 4499},
            {"min": 11001, "max": 30000}
        ],
        "critical_low": 2000,
        "critical_high": 30000,
        "description": "White blood cell count measures the cells that fight infection."
    },
    "Platelet Count": {
        "unit": "cells/mcL",
        "normal": {"min": 150000, "max": 450000},
        "urgent": [
            {"min": 50000, "max": 149999},
            {"min": 450001, "max": 999999}
        ],
        "critical_low": 50000,
        "critical_high": 1000000,
        "description": "Platelets help your blood clot to stop bleeding."
    },
    "Glucose (fasting)": {
        "unit": "mg/dL",
        "normal": {"min": 70, "max": 99},
        "urgent": [
            {"min": 50, "max": 69},
            {"min": 100, "max": 249}
        ],
        "critical_low": 50,
        "critical_high": 250,
        "description": "Measures blood sugar level after fasting."
    },
    "Creatinine": {
        "unit": "mg/dL",
        "normal": {"min": 0.6, "max": 1.2},
        "urgent": [
            {"min": 1.3, "max": 2.9}
        ],
        "critical_low": None,
        "critical_high": 3.0,
        "description": "Measures kidney function by checking creatinine levels in blood."
    },
    "Potassium": {
        "unit": "mEq/L",
        "normal": {"min": 3.5, "max": 5.0},
        "urgent": [
            {"min": 3.0, "max": 3.4},
            {"min": 5.1, "max": 5.9}
        ],
        "critical_low": 3.0,
        "critical_high": 6.0,
        "description": "An essential electrolyte for nerve and muscle function, especially the heart."
    },
    "Sodium": {
        "unit": "mEq/L",
        "normal": {"min": 135, "max": 145},
        "urgent": [
            {"min": 125, "max": 134},
            {"min": 146, "max": 150}
        ],
        "critical_low": 125,
        "critical_high": 150,
        "description": "An electrolyte that helps regulate water balance and blood pressure."
    },
    "Blood Pressure (systolic)": {
        "unit": "mmHg",
        "normal": {"min": 90, "max": 120},
        "urgent": [
            {"min": 70, "max": 89},
            {"min": 121, "max": 179}
        ],
        "critical_low": 70,
        "critical_high": 180,
        "description": "Measures the pressure in your arteries when your heart beats."
    }
}
