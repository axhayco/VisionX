import os
import sys
import pymupdf
from parser import extract_lab_text


def create_sample_pdf_bytes() -> bytes:
    """Creates a simple mock multi-page lab report in-memory using PyMuPDF."""
    doc = pymupdf.open()

    # Page 1
    page1 = doc.new_page()
    page1.insert_text(
        (50, 50),
        "PATIENT LAB REPORT\n"
        "Patient Name: John Doe\n"
        "Date: 2026-08-09\n\n"
        "TEST RESULTS:\n"
        "Hemoglobin: 14.2 g/dL (Reference: 13.5 - 17.5)\n"
        "WBC Count: 7.1 x10^3/uL (Reference: 4.5 - 11.0)\n"
        "Platelets: 250 x10^3/uL (Reference: 150 - 450)",
    )

    # Page 2
    page2 = doc.new_page()
    page2.insert_text(
        (50, 50),
        "METABOLIC PANEL (Page 2):\n"
        "Glucose: 95 mg/dL (Reference: 70 - 99)\n"
        "Creatinine: 0.9 mg/dL (Reference: 0.7 - 1.3)\n"
        "Potassium: 4.2 mmol/L (Reference: 3.5 - 5.0)",
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def main():
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        if not os.path.exists(pdf_path):
            print(f"Error: File not found at '{pdf_path}'")
            sys.exit(1)
        print(f"--- Reading PDF from: {pdf_path} ---")
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        print("--- No file path provided, using synthetic sample lab report ---")
        print("(You can pass a custom PDF via: python test_parser.py <path_to_pdf>)\n")
        pdf_bytes = create_sample_pdf_bytes()

    extracted_text = extract_lab_text(pdf_bytes)
    print("=== EXTRACTED LAB TEXT ===")
    print(extracted_text)
    print("==========================")


def test_extract_lab_text():
    sample_bytes = create_sample_pdf_bytes()
    text = extract_lab_text(sample_bytes)
    assert "PATIENT LAB REPORT" in text
    assert "Hemoglobin" in text
    assert "METABOLIC PANEL (Page 2)" in text


if __name__ == "__main__":
    main()
