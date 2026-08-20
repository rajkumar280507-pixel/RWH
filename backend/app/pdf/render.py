"""HTML -> PDF rendering, wrapped behind one function so the chosen library
can be swapped later without touching callers.

WeasyPrint was tried first (see requirements.txt comment / Phase 7 spike);
it requires native GTK/Pango/Cairo libraries that are not installed on this
Windows dev machine and fails at import time. xhtml2pdf (pure Python,
reportlab-based) is used instead. Its CSS support is a 2.1-era subset —
no flexbox/grid, limited @media support — so `report.html` is written with
table-based layout and inline styles to stay within what xhtml2pdf renders
correctly.
"""
from __future__ import annotations

import io

from xhtml2pdf import pisa


class PdfRenderError(RuntimeError):
    """Raised when xhtml2pdf fails to produce a PDF from the given HTML."""


def render_report_pdf(html_string: str) -> bytes:
    """Renders an HTML string to PDF bytes.

    Raises PdfRenderError if xhtml2pdf reports an unrecoverable error.
    """
    buffer = io.BytesIO()
    result = pisa.CreatePDF(src=html_string, dest=buffer)
    if result.err:
        raise PdfRenderError(f"xhtml2pdf failed to render report PDF (err={result.err})")
    return buffer.getvalue()
