from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "poster"
OUT.mkdir(parents=True, exist_ok=True)

SRC = Path.home() / "Desktop" / "생성된 이미지 1.png"

A4_PX = (2480, 3508)  # 300 dpi A4


def enhance_for_print(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    resized = img.resize(size, Image.Resampling.LANCZOS)
    resized = ImageEnhance.Contrast(resized).enhance(1.04)
    resized = ImageEnhance.Sharpness(resized).enhance(1.18)
    resized = resized.filter(ImageFilter.UnsharpMask(radius=1.15, percent=115, threshold=3))
    return resized


def save_pdf_from_image(image_path: Path, pdf_path: Path):
    page_w, page_h = A4
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    c.drawImage(str(image_path), 0, 0, width=page_w, height=page_h, preserveAspectRatio=False, mask=None)
    c.showPage()
    c.save()


def main():
    src = Image.open(SRC).convert("RGB")

    # 1) Preserve exact poster aspect ratio. This is the safest for avoiding distortion.
    fit = ImageOps.contain(src, A4_PX, method=Image.Resampling.LANCZOS)
    fit = enhance_for_print(fit, fit.size)
    fit_page = Image.new("RGB", A4_PX, "white")
    fit_page.paste(fit, ((A4_PX[0] - fit.width) // 2, (A4_PX[1] - fit.height) // 2))

    fit_png = OUT / "생성된_이미지1_A4_300dpi_비율유지_선명화.png"
    fit_pdf = OUT / "생성된_이미지1_A4_인쇄용_비율유지.pdf"
    fit_page.save(fit_png, dpi=(300, 300), quality=100)
    save_pdf_from_image(fit_png, fit_pdf)

    # 2) Fill A4 completely. This slightly changes the aspect ratio, but uses the whole sheet.
    full = enhance_for_print(src, A4_PX)
    full_png = OUT / "생성된_이미지1_A4_300dpi_꽉채움_선명화.png"
    full_pdf = OUT / "생성된_이미지1_A4_인쇄용_꽉채움.pdf"
    full.save(full_png, dpi=(300, 300), quality=100)
    save_pdf_from_image(full_png, full_pdf)

    # 3) Large source-preserving upscale for other print tools.
    upscale = enhance_for_print(src, (src.width * 4, src.height * 4))
    upscale_png = OUT / "생성된_이미지1_4배_업스케일_선명화.png"
    upscale.save(upscale_png, dpi=(300, 300), quality=100)

    for path in [fit_png, fit_pdf, full_png, full_pdf, upscale_png]:
        print(path)


if __name__ == "__main__":
    main()
