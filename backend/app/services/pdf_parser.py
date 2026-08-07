"""
pdf_parser.py
─────────────
Single-responsibility module: turn an uploaded file (PDF or image) into
plain text that the LLM extractor can work with.

WHY PyMuPDF:
  - Zero binary dependencies (no Tesseract to install)
  - Handles native-text PDFs extremely fast
  - For scanned / image-only content, we fall back to base64 + Vision LLM

WHY base64 for images:
  - Vision-capable LLMs (Groq llama-3.2-vision, gpt-4o) accept inline images
  - Avoids writing temp files to disk
"""

import fitz  # PyMuPDF
import base64


SUPPORTED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract plain text from a PDF using PyMuPDF.

    Returns:
        Concatenated page text. Empty string if the PDF has no selectable
        text (i.e. it is a scanned image PDF).
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        pages_text.append(page.get_text("text"))
    doc.close()
    return "\n".join(pages_text).strip()


def pdf_first_page_to_base64(file_bytes: bytes) -> str:
    """
    Render the first page of a PDF to a PNG and return it base64-encoded.
    Used as fallback for scanned / image-only PDFs.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page = doc[0]
    # 2× zoom for better OCR quality from Vision LLM
    mat = fitz.Matrix(2.0, 2.0)
    pix = page.get_pixmap(matrix=mat)
    doc.close()
    png_bytes = pix.tobytes("png")
    return base64.b64encode(png_bytes).decode("utf-8")


def image_to_base64(file_bytes: bytes) -> str:
    """Return a raw image file as a base64 string."""
    return base64.b64encode(file_bytes).decode("utf-8")


def get_mime_type(filename: str) -> str:
    """Derive MIME type from file extension."""
    ext = filename.rsplit(".", 1)[-1].lower()
    return {
        "pdf":  "application/pdf",
        "png":  "image/png",
        "jpg":  "image/jpeg",
        "jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")
