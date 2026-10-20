"""Private, source-labelled PDF/ZIP creation. Files are served by owned API routes."""
from __future__ import annotations

from io import BytesIO
import json
from pathlib import Path
import re
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import SimpleDocTemplate, Paragraph


def _font():
    if "STSong-Light" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    return "STSong-Light"


def pdf_bytes(title: str, subtitle: str, sections: list[tuple[str, object]]) -> bytes:
    """A readable multipage A4 report; all caller text is escaped, never interpreted."""
    target = BytesIO()
    font = _font()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="WeTitle", fontName=font, fontSize=22, leading=28, textColor=colors.HexColor("#1A4F99"), spaceAfter=12))
    styles.add(ParagraphStyle(name="WeSection", fontName=font, fontSize=13, leading=18, textColor=colors.HexColor("#1A4F99"), spaceBefore=16, spaceAfter=8))
    styles.add(ParagraphStyle(name="WeBody", fontName=font, fontSize=10, leading=16, wordWrap="CJK", spaceAfter=7))
    styles.add(ParagraphStyle(name="WeSmall", fontName=font, fontSize=8, leading=12, textColor=colors.HexColor("#616161"), wordWrap="CJK", spaceAfter=7))

    def paragraph(value, style="WeBody"):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), styles[style])

    def label(value):
        return str(value).replace("_", " ").strip().capitalize()

    def display(value):
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, list):
            return ", ".join(str(v).replace("_", " ") for v in value) if value else "None selected"
        if isinstance(value, dict):
            return "; ".join(f"{label(k)}: {display(v)}" for k, v in value.items())
        return str(value)

    story = [paragraph(title, "WeTitle"), paragraph(subtitle, "WeSmall")]
    for heading, content in sections:
        story.append(paragraph(heading, "WeSection"))
        if isinstance(content, dict):
            for key, value in content.items():
                if value is None or value == "":
                    continue
                story.append(paragraph(f"{label(key)}: {display(value)}"))
        elif isinstance(content, list):
            for index, value in enumerate(content, 1):
                if isinstance(value, dict):
                    value = "; ".join(f"{label(k)}: {display(v)}" for k, v in value.items() if v is not None and v != "")
                story.append(paragraph(f"{index}. {display(value)}"))
        else:
            story.append(paragraph(content))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#DADFE6"))
        canvas.line(42, 38, A4[0] - 42, 38)
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#616161"))
        canvas.drawString(42, 25, "WeWise | User-reviewed preparation | Not an insurer receipt")
        canvas.drawRightString(A4[0] - 42, 25, str(doc.page))
        canvas.restoreState()

    SimpleDocTemplate(target, pagesize=A4, rightMargin=44, leftMargin=44,
                      topMargin=42, bottomMargin=54, title=title,
                      author="WeWise insurance assistant").build(story, onFirstPage=footer, onLaterPages=footer)
    return target.getvalue()


def manifest_bytes(manifest: dict) -> bytes:
    return json.dumps(manifest, ensure_ascii=False, indent=2).encode()


def archive_name(index: int, document: dict) -> str:
    name = re.sub(r"[^\w.\- ()]", "_", Path(document["name"]).name)[:150] or "document"
    return f"originals/{index:02d}-{name}"


def zip_bytes(pdf: bytes, manifest: dict, documents: list[dict], proof: dict | None = None) -> bytes:
    target = BytesIO()
    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        archive.writestr("01-reviewed-summary.pdf", pdf)
        archive.writestr("02-manifest.json", manifest_bytes(manifest))
        archive.writestr("README.txt", "PREPARED - NOT SUBMITTED TO INSURER\nThis archive contains user-provided originals and a reviewed preparation summary.\nAI explanations/translations are not insurer decisions or certified translations.\nCheck each insurer's current official channel and requested format.\n")
        for index, document in enumerate(documents, 1):
            archive.write(document["storage_path"], archive_name(index, document))
        if proof:
            archive.writestr("proof.json", json.dumps(proof, ensure_ascii=False, indent=2))
    return target.getvalue()
