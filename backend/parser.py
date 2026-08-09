import pymupdf


def extract_lab_text(file_bytes: bytes) -> str:
    """Extracts and concatenates all text across pages from PDF bytes using PyMuPDF.

    Args:
        file_bytes: Raw bytes of the PDF file.

    Returns:
        Extracted text as a single string.
    """
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    text_pieces = []

    for page in doc:
        page_text = page.get_text()
        if page_text:
            text_pieces.append(page_text)

    doc.close()
    return "\n\n".join(text_pieces).strip()
