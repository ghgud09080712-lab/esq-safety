from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "poster"
OUT.mkdir(parents=True, exist_ok=True)

PDF = OUT / "온열질환_현장대응_가이드라인_벡터_인쇄용.pdf"
PNG = OUT / "온열질환_현장대응_가이드라인_벡터_미리보기_300dpi.png"

PAGE_W, PAGE_H = A4
M = 20

FONT_DIR = Path("C:/Windows/Fonts")
REG = str(FONT_DIR / "malgun.ttf")
BOLD = str(FONT_DIR / "malgunbd.ttf")
pdfmetrics.registerFont(TTFont("Malgun", REG))
pdfmetrics.registerFont(TTFont("Malgun-Bold", BOLD))


def hex_color(value):
    return colors.HexColor(value)


def rr(c, x, y, w, h, r, fill, stroke="#00356f", sw=1):
    c.setFillColor(hex_color(fill))
    c.setStrokeColor(hex_color(stroke))
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)


def txt(c, x, y, s, size=10, color="#111111", bold=False, align="left", leading=None):
    c.setFillColor(hex_color(color))
    c.setFont("Malgun-Bold" if bold else "Malgun", size)
    if leading is None:
        leading = size * 1.25
    lines = str(s).split("\n")
    for i, line in enumerate(lines):
        yy = y - i * leading
        if align == "center":
            c.drawCentredString(x, yy, line)
        elif align == "right":
            c.drawRightString(x, yy, line)
        else:
            c.drawString(x, yy, line)


def cell_text(c, x, y, w, h, s, size=8, color="#111111", bold=False):
    c.setFont("Malgun-Bold" if bold else "Malgun", size)
    c.setFillColor(hex_color(color))
    lines = str(s).split("\n")
    leading = size * 1.18
    total = leading * (len(lines) - 1) + size
    yy = y + h / 2 + total / 2 - size
    for line in lines:
        c.drawCentredString(x + w / 2, yy, line)
        yy -= leading


def icon_thermo(c, x, y, s=1):
    red = hex_color("#d71920")
    c.setStrokeColor(red)
    c.setFillColor(colors.white)
    c.setLineWidth(2 * s)
    c.roundRect(x - 3*s, y - 22*s, 6*s, 35*s, 3*s, fill=1, stroke=1)
    c.circle(x, y - 25*s, 9*s, fill=1, stroke=1)
    c.setFillColor(red)
    c.rect(x - 1.5*s, y - 18*s, 3*s, 24*s, fill=1, stroke=0)
    c.circle(x, y - 25*s, 5*s, fill=1, stroke=0)
    for dx, dy in [(-16, 21), (0, 28), (16, 21)]:
        c.setStrokeColor(hex_color("#ffd400"))
        c.line(x + dx*s, y + dy*s, x + dx*1.25*s, y + (dy+6)*s)


def icon_person(c, x, y, s=1, color="#15823b", mode="normal"):
    c.setFillColor(hex_color(color))
    if mode == "headache":
        c.circle(x - 6*s, y + 10*s, 8*s, fill=1, stroke=0)
        c.rect(x - 10*s, y - 20*s, 8*s, 24*s, fill=1, stroke=0)
        c.setStrokeColor(hex_color("#d71920"))
        c.setLineWidth(2*s)
        for i in range(3):
            c.line(x + (6+i*7)*s, y + 23*s, x + (2+i*7)*s, y + 14*s)
            c.line(x + (2+i*7)*s, y + 14*s, x + (10+i*7)*s, y + 14*s)
    elif mode == "vomit":
        c.circle(x - 4*s, y + 12*s, 7*s, fill=1, stroke=0)
        c.line(x - 2*s, y + 5*s, x + 18*s, y - 16*s)
        c.line(x + 18*s, y - 16*s, x + 6*s, y - 28*s)
        c.setStrokeColor(hex_color(color))
        c.setLineWidth(5*s)
        for dx in [0, 6, 12]:
            c.line(x - 13*s + dx*s, y - 5*s, x - 13*s + dx*s, y - 16*s)
    elif mode == "sleep":
        c.circle(x - 15*s, y - 14*s, 7*s, fill=1, stroke=0)
        c.roundRect(x - 8*s, y - 20*s, 30*s, 8*s, 4*s, fill=1, stroke=0)
        c.line(x - 24*s, y - 25*s, x + 26*s, y - 25*s)
    else:
        c.circle(x, y + 10*s, 8*s, fill=1, stroke=0)
        c.line(x, y + 1*s, x, y - 18*s)
        c.line(x, y - 10*s, x - 15*s, y - 25*s)
        c.line(x, y - 10*s, x + 15*s, y - 25*s)
        c.line(x - 3*s, y - 1*s, x - 20*s, y - 10*s)
        c.line(x + 3*s, y - 1*s, x + 20*s, y - 10*s)


def icon_drops(c, x, y, s=1):
    c.setFillColor(hex_color("#0d58a6"))
    for dx, dy, r in [(-8, 0, 9), (8, 0, 9), (0, 10, 8)]:
        c.circle(x + dx*s, y + dy*s, r*s, fill=1, stroke=0)


def icon_leg(c, x, y, s=1):
    c.setFillColor(hex_color("#0d58a6"))
    c.roundRect(x - 5*s, y - 28*s, 9*s, 52*s, 4*s, fill=1, stroke=0)
    c.roundRect(x - 9*s, y - 30*s, 20*s, 7*s, 3*s, fill=1, stroke=0)
    c.setStrokeColor(hex_color("#d71920"))
    c.setLineWidth(2*s)
    c.line(x - 18*s, y - 3*s, x - 7*s, y + 3*s)
    c.line(x + 10*s, y - 3*s, x + 22*s, y + 3*s)


def draw_table(c, x, y, w, h, rows, col_widths, fills=None, text_size=8):
    row_h = h / len(rows)
    for r, row in enumerate(rows):
        xx = x
        for col, val in enumerate(row):
            cw = w * col_widths[col]
            fill = "#ffffff"
            if fills and fills[r][col]:
                fill = fills[r][col]
            c.setFillColor(hex_color(fill))
            c.setStrokeColor(hex_color("#222222"))
            c.setLineWidth(0.5)
            c.rect(xx, y + h - (r + 1) * row_h, cw, row_h, fill=1, stroke=1)
            cell_text(c, xx, y + h - (r + 1) * row_h, cw, row_h, val, text_size, "#111111", r == 0 or col == 0)
            xx += cw


def build_pdf():
    c = canvas.Canvas(str(PDF), pagesize=A4)
    c.setTitle("온열질환 현장 대응 가이드라인")

    # Background and outer frame
    c.setFillColor(hex_color("#f4f6fb"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    rr(c, 6, 7, PAGE_W - 12, PAGE_H - 14, 6, "#ffffff", "#07336b", 0.8)

    c.setFillColor(hex_color("#002c63"))
    c.roundRect(6, PAGE_H - 112, PAGE_W - 12, 105, 6, fill=1, stroke=0)
    for i in range(9):
        c.setStrokeColor(hex_color("#174b89"))
        c.line(PAGE_W - 72 + i * 6, PAGE_H - 8, PAGE_W - 8 + i * 6, PAGE_H - 72)

    icon_thermo(c, 45, PAGE_H - 60, 1.15)
    txt(c, 79, PAGE_H - 47, "온열질환 현장 대응 가이드라인", 33, "#ffe018", True)
    txt(c, PAGE_W / 2, PAGE_H - 84, "체감온도 단계별 작업 전 반드시 확인하세요", 17, "#ffffff", True, "center")

    # Intro panel
    rr(c, 17, PAGE_H - 247, PAGE_W - 34, 105, 8, "#ffffff", "#0a3d80", 1.3)
    rr(c, 28, PAGE_H - 222, 83, 65, 4, "#073f87", "#073f87", 0)
    txt(c, 69.5, PAGE_H - 182, "위험 단계\n확인 방법", 14, "#ffffff", True, "center", 19)
    bullets = [
        "작업 전·중 체감온도를 확인하고, 단계에 맞는 안전조치를 반드시 이행합니다.",
        "체감온도는 온도, 습도, 바람, 복사열을 종합한 지수로 개인차가 있을 수 있습니다.",
        "기상청 날씨누리(날씨) 또는 현장 비치된 체감온도계를 참고하세요.",
    ]
    for i, b in enumerate(bullets):
        txt(c, 126, PAGE_H - 165 - i * 20, "• " + b, 9.4, "#111111", i == 0)
        if i == 0:
            txt(c, 176, PAGE_H - 165, "체감온도", 9.4, "#d71920", True)

    rr(c, PAGE_W - 105, PAGE_H - 231, 86, 88, 5, "#ffffff", "#073f87", 1.3)
    c.setFillColor(hex_color("#0d58a6"))
    c.roundRect(PAGE_W - 82, PAGE_H - 181, 38, 16, 5, fill=1, stroke=0)
    c.circle(PAGE_W - 63, PAGE_H - 176, 22, fill=1, stroke=0)
    txt(c, PAGE_W - 62, PAGE_H - 180, "+", 22, "#ffffff", True, "center")
    txt(c, PAGE_W - 62, PAGE_H - 196, "현장 안전수칙", 10, "#073f87", True, "center")
    txt(c, PAGE_W - 62, PAGE_H - 217, "모두의 안전이\n우리의 경쟁력입니다.", 7.6, "#111111", True, "center", 12)

    risk_rows = [
        ["위험 단계", "관심\n(31℃ 미만)", "주의\n(31~33℃)", "경고\n(33~35℃)", "위험\n(35℃ 이상)"],
        ["의미", "일반적인 상태", "더위 주의 필요", "더위로 인한\n건강위험 증가", "건강위험 매우 높음\n작업중지 또는 단축 권고"],
    ]
    risk_fills = [
        ["#073f87", "#168c28", "#ffe000", "#f17a00", "#d71920"],
        ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    ]
    draw_table(c, 28, PAGE_H - 286, 450, 74, risk_rows, [0.16, 0.215, 0.225, 0.205, 0.195], risk_fills, 8.6)

    # Section 2
    rr(c, 23, PAGE_H - 452, PAGE_W - 46, 145, 5, "#ffffff", "#073f87", 1.2)
    rr(c, 23, PAGE_H - 328, 158, 24, 4, "#073f87", "#073f87", 0)
    txt(c, 33, PAGE_H - 322, "2. 온열질환 주요 증상", 13.5, "#ffffff", True)
    symptom_x = [86, 192, 298, 404, 510]
    labels = [("어지러움", "normal"), ("두통", "headache"), ("구토", "vomit"), ("근육경련", "leg"), ("의식저하", "sleep")]
    for idx, (label, mode) in enumerate(labels):
        x = symptom_x[idx]
        c.setFillColor(hex_color("#f0f0f0"))
        c.circle(x, PAGE_H - 371, 35, fill=1, stroke=0)
        if mode == "leg":
            icon_leg(c, x, PAGE_H - 365, 1.25)
        else:
            icon_person(c, x, PAGE_H - 366, 1.25, "#15823b" if idx != 1 else "#0d58a6", mode)
        txt(c, x, PAGE_H - 421, label, 11, "#111111", True, "center")
        if idx < 4:
            c.setStrokeColor(hex_color("#1d5aa1"))
            c.setDash(2, 3)
            c.line((symptom_x[idx] + symptom_x[idx + 1]) / 2, PAGE_H - 335, (symptom_x[idx] + symptom_x[idx + 1]) / 2, PAGE_H - 416)
            c.setDash()
    c.setFillColor(hex_color("#d71920"))
    c.rect(23, PAGE_H - 452, PAGE_W - 46, 25, fill=1, stroke=0)
    txt(c, 69, PAGE_H - 444, "위 증상이 나타나면 즉시 작업을 중지하고, 시원한 장소로 이동 후 휴식을 취하세요.", 10.2, "#fff348", True)
    txt(c, 42, PAGE_H - 444, "!", 18, "#ffffff", True, "center")

    # Section 3
    rr(c, 23, PAGE_H - 682, 235, 207, 5, "#ffffff", "#073f87", 1.2)
    rr(c, 23, PAGE_H - 500, 162, 24, 4, "#073f87", "#073f87", 0)
    txt(c, 31, PAGE_H - 493, "3. 체감온도별 휴식기준", 13, "#ffffff", True)
    rest_rows = [
        ["체감온도 단계", "휴식 기준", "권장 조치"],
        ["31℃ 미만", "1시간 작업 10분 이상 휴식", "수분 섭취"],
        ["31 ~ 33℃", "1시간 작업 10 ~15분 휴식", "그늘에서 휴식"],
        ["33 ~ 35℃", "1시간 작업 15 ~20분 휴식", "2인 1조 작업"],
        ["35℃ 이상", "1시간 작업 20분 이상 휴식\n또는 작업중지 권고", "작업중지 검토"],
    ]
    rest_fills = [
        ["#073f87", "#073f87", "#073f87"],
        ["#bfe47c", "#ffffff", "#ffffff"],
        ["#ffe23b", "#ffffff", "#ffffff"],
        ["#ff9d21", "#ffffff", "#ffffff"],
        ["#d71920", "#ffffff", "#ffffff"],
    ]
    draw_table(c, 28, PAGE_H - 658, 224, 164, rest_rows, [0.30, 0.48, 0.22], rest_fills, 6.8)
    txt(c, 29, PAGE_H - 673, "※ 강도 높은 작업, 고령자, 질환자 등은 더 보수적으로 적용하세요.", 6.8, "#111111")

    # Section 4
    rr(c, 267, PAGE_H - 682, 305, 207, 5, "#ffffff", "#073f87", 1.2)
    rr(c, 267, PAGE_H - 500, 142, 24, 4, "#073f87", "#073f87", 0)
    txt(c, 276, PAGE_H - 493, "4. 체감온도 산출표", 13, "#ffffff", True)
    txt(c, 441, PAGE_H - 512, "기온(℃)", 8.5, "#111111", True, "center")
    grid_x, grid_y, grid_w, grid_h = 302, PAGE_H - 634, 254, 120
    temps = [25, 28, 30, 32, 34, 36, 38, 40, 42]
    hums = [20, 30, 40, 50, 60, 70, 80, 90]
    cw, rh = grid_w / (len(temps) + 1), grid_h / (len(hums) + 1)
    c.setStrokeColor(hex_color("#222222"))
    c.setLineWidth(0.4)
    for r in range(len(hums) + 1):
        for col in range(len(temps) + 1):
            xx = grid_x + col * cw
            yy = grid_y + grid_h - (r + 1) * rh
            if r == 0 or col == 0:
                fill = "#f1f1f1"
            else:
                val = int(temps[col - 1] + (hums[r - 1] - 20) / 10 * 1.1 + max(0, temps[col - 1] - 32) * 0.35)
                fill = "#a7d9f2" if val < 31 else "#bfe47c" if val < 34 else "#ffe23b" if val < 39 else "#ff9d21" if val < 43 else "#e93027"
            c.setFillColor(hex_color(fill))
            c.rect(xx, yy, cw, rh, fill=1, stroke=1)
            if r == 0 and col > 0:
                cell_text(c, xx, yy, cw, rh, str(temps[col - 1]), 7, bold=True)
            elif col == 0 and r > 0:
                cell_text(c, xx, yy, cw, rh, str(hums[r - 1]), 7, bold=True)
            elif r > 0 and col > 0:
                val = int(temps[col - 1] + (hums[r - 1] - 20) / 10 * 1.1 + max(0, temps[col - 1] - 32) * 0.35)
                cell_text(c, xx, yy, cw, rh, str(val), 7, bold=True)
    txt(c, 282, PAGE_H - 527, "습도\n(%)", 7, "#111111", True, "center", 8)
    legend_y = PAGE_H - 663
    legend = [("관심\n(31℃ 미만)", "#168c28"), ("주의\n(31~33℃)", "#ffe000"), ("경고\n(33~35℃)", "#f17a00"), ("위험\n(35℃ 이상)", "#d71920")]
    for i, (lab, col) in enumerate(legend):
        c.setFillColor(hex_color(col))
        c.rect(303 + i * 63, legend_y, 63, 27, fill=1, stroke=1)
        cell_text(c, 303 + i * 63, legend_y, 63, 27, lab, 6.2, "#111111" if i < 3 else "#ffffff", True)
    txt(c, 273, PAGE_H - 676, "※ 체감온도(℃) = 9/5×기온(℃) + 0.55×(1-습도/100)×(기온(℃)-14.5) + 32", 6.4, "#111111")

    # Section 5
    rr(c, 23, PAGE_H - 809, PAGE_W - 46, 105, 5, "#ffffff", "#073f87", 1.2)
    rr(c, 23, PAGE_H - 729, 126, 24, 4, "#073f87", "#073f87", 0)
    txt(c, 32, PAGE_H - 722, "5. 현장 기본수칙", 13, "#ffffff", True)
    rule_x = [94, 235, 376, 516]
    rule_titles = ["물 자주 마시기", "그늘 휴식", "2인 1조 확인", "응급신고"]
    rule_desc = ["갈증을 느끼기 전에\n규칙적으로 수분 섭취", "시원한 그늘에서\n충분히 휴식", "서로 건강상태를 확인하고\n이상 시 즉시 알리기", "이상 증상 발생 시\n즉시 119 신고"]
    for i, x in enumerate(rule_x):
        if i:
            c.setStrokeColor(hex_color("#999999"))
            c.setDash(2, 3)
            c.line((rule_x[i - 1] + x) / 2, PAGE_H - 719, (rule_x[i - 1] + x) / 2, PAGE_H - 796)
            c.setDash()
        if i == 0:
            icon_drops(c, x - 10, PAGE_H - 747, 1.1)
        elif i == 1:
            c.setFillColor(hex_color("#15823b"))
            c.rect(x - 21, PAGE_H - 758, 42, 18, fill=1, stroke=0)
            c.circle(x + 25, PAGE_H - 733, 7, fill=1, stroke=0)
        elif i == 2:
            icon_person(c, x - 12, PAGE_H - 750, .8, "#0d58a6")
            icon_person(c, x + 12, PAGE_H - 750, .8, "#0d58a6")
        else:
            c.setFillColor(hex_color("#0d58a6"))
            c.roundRect(x - 24, PAGE_H - 760, 23, 42, 10, fill=1, stroke=0)
            rr(c, x + 13, PAGE_H - 746, 34, 30, 6, "#d71920", "#d71920", 0)
            txt(c, x + 30, PAGE_H - 736, "119", 12, "#ffffff", True, "center")
        txt(c, x, PAGE_H - 779, rule_titles[i], 10.5, "#073f87", True, "center")
        txt(c, x, PAGE_H - 799, rule_desc[i], 7.7, "#111111", True, "center", 10)

    # Emergency strip
    c.setFillColor(hex_color("#d71920"))
    c.roundRect(22, 31, PAGE_W - 44, 48, 6, fill=1, stroke=0)
    txt(c, 92, 50, "응급상황", 18, "#ffffff", True)
    txt(c, 192, 49, "119", 31, "#ffe018", True, "center")
    txt(c, 276, 50, "|", 22, "#ffffff", True, "center")
    txt(c, 360, 50, "현장관리자 즉시 보고", 18, "#ffe018", True, "center")
    c.setFillColor(hex_color("#002c63"))
    c.rect(6, 6, PAGE_W - 12, 20, fill=1, stroke=0)
    txt(c, PAGE_W / 2, 14, "우리의 작은 실천이 건강한 현장을 만듭니다!   |   안전은 선택이 아닌 필수입니다.", 9, "#ffffff", True, "center")
    c.save()


def build_preview_png():
    # Render a crisp preview independently; the PDF is the print source.
    scale = 300 / 72
    w, h = int(PAGE_W * scale), int(PAGE_H * scale)
    img = Image.new("RGB", (w, h), "#f4f6fb")
    d = ImageDraw.Draw(img)
    f_reg = ImageFont.truetype(REG, 28)
    f_bold = ImageFont.truetype(BOLD, 32)
    d.rounded_rectangle((25, 25, w - 25, h - 25), radius=25, fill="#ffffff", outline="#07336b", width=4)
    d.rounded_rectangle((25, 25, w - 25, 465), radius=25, fill="#002c63")
    d.text((w / 2, 175), "온열질환 현장 대응 가이드라인", font=ImageFont.truetype(BOLD, 130), fill="#ffe018", anchor="mm")
    d.text((w / 2, 310), "체감온도 단계별 작업 전 반드시 확인하세요", font=ImageFont.truetype(BOLD, 68), fill="#ffffff", anchor="mm")
    d.text((w / 2, 1760), "인쇄용 원본은 PDF 벡터 파일입니다", font=f_bold, fill="#0a3d80", anchor="mm")
    d.text((w / 2, 1830), "미리보기 PNG는 실제 PDF와 다를 수 있지만 300dpi로 저장되었습니다.", font=f_reg, fill="#111111", anchor="mm")
    img.save(PNG, dpi=(300, 300))


if __name__ == "__main__":
    build_pdf()
    build_preview_png()
    print(PDF)
    print(PNG)
