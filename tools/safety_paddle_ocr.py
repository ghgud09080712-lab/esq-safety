import base64
import io
import json
import sys


def write_json(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def collect_text(value, output):
    if value is None:
        return
    if isinstance(value, str):
        text = value.strip()
        if text:
            output.append(text)
        return
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and isinstance(value[1], (list, tuple)) and value[1]:
            if isinstance(value[1][0], str):
                text = value[1][0].strip()
                if text:
                    output.append(text)
                return
        for item in value:
            collect_text(item, output)


def main():
    if "--check" in sys.argv:
        import fitz  # noqa: F401
        import numpy  # noqa: F401
        from PIL import Image  # noqa: F401
        from paddleocr import PaddleOCR  # noqa: F401
        write_json({"ok": True, "engine": "PaddleOCR"})
        return

    payload = json.loads(sys.stdin.read() or "{}")
    base64_pdf = str(payload.get("base64") or "")
    max_pages = max(1, min(10, int(payload.get("maxPages") or 5)))
    dpi = max(120, min(260, int(payload.get("dpi") or 180)))
    if not base64_pdf:
        write_json({"ok": False, "text": "", "error": "PDF base64 is empty"})
        return

    import fitz
    import numpy as np
    from PIL import Image
    from paddleocr import PaddleOCR

    pdf_bytes = base64.b64decode(base64_pdf)
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    ocr = PaddleOCR(use_angle_cls=True, lang="korean", show_log=False)
    scale = dpi / 72
    matrix = fitz.Matrix(scale, scale)
    lines = []
    page_count = min(max_pages, len(document))

    for page_index in range(page_count):
        page = document.load_page(page_index)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        image = Image.open(io.BytesIO(pixmap.tobytes("png"))).convert("RGB")
        image_array = np.array(image)
        result = ocr.ocr(image_array, cls=True)
        page_lines = []
        collect_text(result, page_lines)
        if page_lines:
            lines.append(f"[page {page_index + 1}]")
            lines.extend(page_lines)

    write_json({
        "ok": True,
        "engine": "PaddleOCR",
        "pages": page_count,
        "text": "\n".join(lines).strip()
    })


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        write_json({"ok": False, "text": "", "error": str(error)})
        sys.exit(1)
