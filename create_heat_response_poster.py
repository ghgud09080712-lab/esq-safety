from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "poster"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 2480, 3508  # A4 at 300 dpi
S = W / 595.276

FONT_DIR = Path("C:/Windows/Fonts")
FONT_REG = str(FONT_DIR / "malgun.ttf")
FONT_BOLD = str(FONT_DIR / "malgunbd.ttf")


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def rr(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, s, size, fill="#111111", bold=False, anchor="la", align="left", spacing=4):
    draw.multiline_text(xy, s, font=font(size, bold), fill=fill, anchor=anchor, align=align, spacing=spacing)


def center(draw, box, s, size, fill="#111111", bold=False):
    x1, y1, x2, y2 = box
    f = font(size, bold)
    lines = s.split("\n")
    heights = []
    widths = []
    for line in lines:
        b = draw.textbbox((0, 0), line, font=f)
        widths.append(b[2] - b[0])
        heights.append(b[3] - b[1])
    total_h = sum(heights) + (len(lines) - 1) * int(size * 0.35)
    y = y1 + ((y2 - y1) - total_h) / 2
    for i, line in enumerate(lines):
        b = draw.textbbox((0, 0), line, font=f)
        draw.text((x1 + (x2 - x1) / 2, y), line, font=f, fill=fill, anchor="mt")
        y += heights[i] + int(size * 0.35)


def icon_thermo(draw, cx, cy, scale=1.0):
    red = "#d93636"
    draw.rounded_rectangle((cx - 9*scale, cy - 52*scale, cx + 9*scale, cy + 18*scale), radius=int(9*scale), outline=red, width=int(5*scale), fill="#ffffff")
    draw.ellipse((cx - 24*scale, cy + 8*scale, cx + 24*scale, cy + 56*scale), fill="#ffffff", outline=red, width=int(5*scale))
    draw.line((cx, cy - 30*scale, cx, cy + 24*scale), fill=red, width=int(8*scale))
    draw.ellipse((cx - 14*scale, cy + 18*scale, cx + 14*scale, cy + 46*scale), fill=red)


def icon_drops(draw, cx, cy, scale=1.0):
    blue = "#1976d2"
    for dx, dy, sz in [(-20, 0, 30), (18, 8, 24), (0, -28, 20)]:
        x = cx + dx*scale
        y = cy + dy*scale
        r = sz * scale
        pts = [(x, y - r), (x - r*0.75, y + r*0.2), (x, y + r), (x + r*0.75, y + r*0.2)]
        draw.polygon(pts, fill=blue)
        draw.ellipse((x - r*0.66, y - r*0.05, x + r*0.66, y + r*1.05), fill=blue)


def icon_worker(draw, cx, cy, scale=1.0, color="#2e7d32"):
    draw.ellipse((cx - 31*scale, cy - 36*scale, cx + 31*scale, cy + 26*scale), fill=color, outline="#222222", width=int(4*scale))
    draw.pieslice((cx - 38*scale, cy - 58*scale, cx + 38*scale, cy + 16*scale), 180, 360, fill="#f4c430", outline="#222222", width=int(4*scale))
    draw.rectangle((cx - 40*scale, cy - 15*scale, cx + 40*scale, cy - 4*scale), fill="#f4c430", outline="#222222", width=int(3*scale))
    draw.ellipse((cx - 16*scale, cy - 2*scale, cx - 8*scale, cy + 6*scale), fill="#111111")
    draw.ellipse((cx + 8*scale, cy - 2*scale, cx + 16*scale, cy + 6*scale), fill="#111111")
    draw.arc((cx - 14*scale, cy + 3*scale, cx + 14*scale, cy + 20*scale), 0, 180, fill="#111111", width=int(3*scale))


def icon_cramp(draw, cx, cy, scale=1.0):
    brown = "#7b4f28"
    draw.line((cx - 20*scale, cy - 52*scale, cx - 3*scale, cy - 10*scale, cx - 17*scale, cy + 31*scale), fill=brown, width=int(9*scale))
    draw.line((cx - 3*scale, cy - 10*scale, cx + 26*scale, cy + 7*scale), fill=brown, width=int(9*scale))
    for i in range(3):
        y = cy - 35*scale + i * 28*scale
        draw.arc((cx + 12*scale, y, cx + 54*scale, y + 28*scale), 90, 250, fill="#e53935", width=int(4*scale))


def icon_phone(draw, cx, cy, scale=1.0):
    draw.rounded_rectangle((cx - 33*scale, cy - 48*scale, cx + 33*scale, cy + 48*scale), radius=int(12*scale), fill="#ffffff", outline="#0d47a1", width=int(5*scale))
    draw.rectangle((cx - 22*scale, cy - 30*scale, cx + 22*scale, cy + 25*scale), fill="#dceeff")
    draw.ellipse((cx - 5*scale, cy + 33*scale, cx + 5*scale, cy + 43*scale), fill="#0d47a1")


def draw_header(draw):
    draw.rectangle((0, 0, W, 420), fill="#183b7a")
    text(draw, (W/2, 72), "온열질환 현장 대응 가이드라인", 106, "#ffe34d", True, anchor="ma")
    text(draw, (W/2, 190), "체감온도 단계별 작업 전 반드시 확인하세요", 43, "#ffffff", True, anchor="ma")

    rr(draw, (145, 260, W - 145, 548), 34, "#f2f7ff", "#1e4d8f", 5)
    text(draw, (218, 304), "작업 전 확인", 36, "#183b7a", True)
    text(draw, (218, 362), "• 기상청 체감온도와 현장 상태를 함께 확인\n• 물, 그늘, 응급연락망, 작업자 건강상태를 점검\n• 고위험 작업은 2인 1조로 관찰하며 이상 증상 즉시 중지", 30, "#111111", False, spacing=10)

    rr(draw, (1765, 302, 2222, 505), 28, "#ffffff", "#8aa2c8", 4)
    icon_worker(draw, 1845, 405, 1.0, "#4f9f52")
    text(draw, (1930, 360), "현장 안전수칙", 35, "#183b7a", True)
    text(draw, (1930, 414), "폭염 작업 전\n관리자 확인", 27, "#111111", False, spacing=5)


def draw_section_title(draw, x, y, label):
    rr(draw, (x, y, x + 500, y + 68), 18, "#183b7a")
    text(draw, (x + 28, y + 16), label, 32, "#ffffff", True)


def draw_symptoms(draw, y):
    draw_section_title(draw, 120, y, "2. 온열질환 주요 증상")
    top = y + 95
    labels = [
        ("체온상승\n붉은 피부", icon_thermo),
        ("탈수\n갈증·어지러움", icon_drops),
        ("두통\n메스꺼움", lambda d, cx, cy, s: icon_worker(d, cx, cy, s, "#ef5350")),
        ("근육경련\n팔·다리 통증", icon_cramp),
        ("의식저하\n응답 둔화", lambda d, cx, cy, s: icon_worker(d, cx, cy, s, "#222222")),
    ]
    start_x = 250
    gap = 410
    for i, (label, fn) in enumerate(labels):
        cx = start_x + i * gap
        fn(draw, cx, top + 72, 1.35)
        text(draw, (cx, top + 175), label, 28, "#111111", True, anchor="ma", align="center", spacing=4)
    text(draw, (W/2, top + 270), "※ 증상 발생 시 즉시 작업중지 및 관리자 보고", 35, "#d71920", True, anchor="ma")


def draw_risk_cards(draw, x, y, w, h):
    draw_section_title(draw, x, y, "1. 위험 단계 확인")
    card_y = y + 86
    levels = [
        ("관심", "31℃ 미만", "#49a6e9", "수분 섭취·상태 확인"),
        ("주의", "31℃ 이상", "#56b45d", "매시간 이상증상 확인"),
        ("경고", "33℃ 이상", "#f7c948", "그늘 휴식 확대"),
        ("위험", "35℃ 이상", "#f28c28", "고강도 작업 조정"),
        ("매우위험", "38℃ 이상", "#e84545", "작업 중지 검토"),
    ]
    row_h = 65
    for i, (name, temp, color, desc) in enumerate(levels):
        yy = card_y + i * (row_h + 12)
        rr(draw, (x, yy, x + w, yy + row_h), 16, "#ffffff", "#c7d2e5", 3)
        rr(draw, (x + 10, yy + 10, x + 150, yy + row_h - 10), 12, color)
        center(draw, (x + 10, yy + 10, x + 150, yy + row_h - 10), name, 26, "#111111", True)
        text(draw, (x + 180, yy + 14), temp, 29, "#111111", True)
        text(draw, (x + 400, yy + 17), desc, 27, "#333333")


def draw_rest_criteria(draw, x, y, w, h):
    draw_section_title(draw, x, y, "3. 체감온도별 휴식기준")
    card_y = y + 86
    rows = [
        ("31℃ 이상", "1시간당 10분 이상 휴식", "#50a7e8"),
        ("33℃ 이상", "1시간당 10~15분 휴식", "#f7c948"),
        ("35℃ 이상", "1시간당 20분 이상 휴식", "#f28c28"),
        ("38℃ 이상", "작업중지 또는 특별관리", "#e84545"),
    ]
    col1 = x + 18
    col2 = x + 300
    text(draw, (col1 + 25, card_y + 8), "체감온도", 27, "#183b7a", True)
    text(draw, (col2 + 25, card_y + 8), "휴식기준", 27, "#183b7a", True)
    for i, (temp, rule, color) in enumerate(rows):
        yy = card_y + 56 + i * 78
        rr(draw, (x, yy, x + w, yy + 64), 14, "#ffffff", "#c7d2e5", 3)
        rr(draw, (x + 14, yy + 10, x + 252, yy + 54), 12, color)
        center(draw, (x + 14, yy + 8, x + 252, yy + 54), temp, 28, "#111111", True)
        text(draw, (col2 + 24, yy + 15), rule, 27, "#111111", True)


def draw_heat_table(draw, x, y, w, h):
    draw_section_title(draw, x, y, "4. 체감온도 산출표")
    tx, ty = x, y + 84
    cols = 12
    rows = 18
    left_w = 112
    head_h = 52
    cell_w = (w - left_w) / cols
    cell_h = (h - head_h) / rows
    rr(draw, (tx, ty, tx + w, ty + h), 12, "#ffffff", "#355d93", 4)
    draw.rectangle((tx, ty, tx + w, ty + head_h), fill="#183b7a")
    center(draw, (tx, ty, tx + left_w, ty + head_h), "습도", 22, "#ffffff", True)
    for c in range(cols):
        center(draw, (tx + left_w + c*cell_w, ty, tx + left_w + (c+1)*cell_w, ty + head_h), f"{26+c}℃", 21, "#ffffff", True)
    for r in range(rows):
        humid = 20 + r * 4
        yy = ty + head_h + r * cell_h
        fill = "#f6f9ff" if r % 2 == 0 else "#ffffff"
        draw.rectangle((tx, yy, tx + left_w, yy + cell_h), fill=fill, outline="#c8d2e2")
        center(draw, (tx, yy, tx + left_w, yy + cell_h), f"{humid}%", 19, "#111111", True)
        for c in range(cols):
            val = 25 + c + round(r * 0.42 + max(0, c - 4) * 0.23, 1)
            if val < 31:
                color = "#7ec8f5"
            elif val < 33:
                color = "#7ad17f"
            elif val < 35:
                color = "#ffd65a"
            elif val < 38:
                color = "#ff9b45"
            else:
                color = "#e64b4b"
            xx = tx + left_w + c * cell_w
            draw.rectangle((xx, yy, xx + cell_w, yy + cell_h), fill=color, outline="#ffffff")
            center(draw, (xx, yy, xx + cell_w, yy + cell_h), f"{val:.1f}", 17, "#111111", True)
    text(draw, (x + 20, y + h + 102), "※ 표는 현장 판단 보조자료입니다. 실제 작업환경, 복장, 직사광선, 작업강도를 함께 고려하세요.", 27, "#d71920", True)


def draw_basic_rules(draw, x, y, w, h):
    draw_section_title(draw, x, y, "5. 현장 기본수칙")
    rules = [
        ("작업 전", "체감온도·건강상태 확인"),
        ("작업 중", "물 자주 마시고 그늘 휴식"),
        ("동료 확인", "2인 1조로 이상증상 관찰"),
        ("이상 시", "즉시 작업중지 후 119 신고"),
    ]
    box_w = (w - 54) / 4
    for i, (a, b) in enumerate(rules):
        xx = x + i * (box_w + 18)
        rr(draw, (xx, y + 92, xx + box_w, y + h), 22, "#f2f7ff", "#9cb1d0", 3)
        if i == 0:
            icon_thermo(draw, xx + box_w/2, y + 165, 0.9)
        elif i == 1:
            icon_drops(draw, xx + box_w/2, y + 170, 0.95)
        elif i == 2:
            icon_worker(draw, xx + box_w/2, y + 168, 0.9, "#4f9f52")
        else:
            icon_phone(draw, xx + box_w/2, y + 166, 0.9)
        text(draw, (xx + box_w/2, y + 240), a, 30, "#183b7a", True, anchor="ma")
        text(draw, (xx + box_w/2, y + 292), b, 24, "#111111", True, anchor="ma", align="center")


def main():
    img = Image.new("RGB", (W, H), "#e7edf7")
    draw = ImageDraw.Draw(img)

    draw_header(draw)
    rr(draw, (96, 600, W - 96, H - 160), 30, "#ffffff", "#183b7a", 6)

    draw_risk_cards(draw, 135, 650, 1040, 430)
    draw_rest_criteria(draw, 1285, 650, 1060, 430)
    draw_symptoms(draw, 1125)
    draw_heat_table(draw, 135, 1600, 2210, 1045)
    draw_basic_rules(draw, 135, 2790, 2210, 390)

    draw.rectangle((0, H - 132, W, H), fill="#d71920")
    text(draw, (118, H - 94), "온열질환 의심 시 즉시 작업중지", 45, "#fff348", True)
    text(draw, (W - 110, H - 94), "응급상황 119 | 현장관리자 즉시 보고", 42, "#ffffff", True, anchor="ra")

    png = OUT / "온열질환_현장대응_가이드라인_A4_300dpi.png"
    pdf = OUT / "온열질환_현장대응_가이드라인_A4_인쇄용.pdf"
    img.save(png, dpi=(300, 300), quality=95)

    c = canvas.Canvas(str(pdf), pagesize=A4)
    page_w, page_h = A4
    c.drawImage(str(png), 0, 0, width=page_w, height=page_h, preserveAspectRatio=False, mask=None)
    c.showPage()
    c.save()

    print(png)
    print(pdf)


if __name__ == "__main__":
    main()
