#!/usr/bin/env python3
# Hangzhou April Spring Trip Plan PDF Generator

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

OUTPUT_PATH = "/home/uncleclaw/.openclaw/workspace/WM/hangzhou-trip/hangzhou_trip_plan.pdf"

COLOR_TITLE   = HexColor("#1a5f2a")
COLOR_ACCENT  = HexColor("#4a9c3d")
COLOR_DARK    = HexColor("#2d2d2d")
COLOR_GRAY    = HexColor("#666666")
COLOR_LIGHT_BG = HexColor("#f0f7ee")
COLOR_BORDER  = HexColor("#c8e6c9")

def p(text):
    return text  # helper marker

def create_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()

    s_cover_title = ParagraphStyle('CoverTitle', parent=styles['Title'],
        fontSize=26, textColor=COLOR_TITLE, spaceAfter=6,
        alignment=TA_CENTER, fontName='Helvetica-Bold', leading=32)
    s_cover_sub = ParagraphStyle('CoverSub', parent=styles['Normal'],
        fontSize=14, textColor=COLOR_ACCENT, spaceAfter=4,
        alignment=TA_CENTER, fontName='Helvetica')
    s_cover_info = ParagraphStyle('CoverInfo', parent=styles['Normal'],
        fontSize=10, textColor=COLOR_GRAY, alignment=TA_CENTER, spaceAfter=2)
    s_section = ParagraphStyle('Section', parent=styles['Heading1'],
        fontSize=15, textColor=COLOR_TITLE, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold', borderPad=4)
    s_sub_section = ParagraphStyle('SubSection', parent=styles['Heading2'],
        fontSize=12, textColor=COLOR_ACCENT, spaceBefore=10, spaceAfter=4,
        fontName='Helvetica-Bold')
    s_body = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=COLOR_DARK, spaceAfter=4, leading=15,
        alignment=TA_JUSTIFY, fontName='Helvetica')
    s_bullet = ParagraphStyle('Bullet', parent=styles['Normal'],
        fontSize=10, textColor=COLOR_DARK, spaceAfter=3, leading=14,
        leftIndent=12, bulletIndent=0, fontName='Helvetica')
    s_note = ParagraphStyle('Note', parent=styles['Normal'],
        fontSize=9, textColor=COLOR_GRAY, spaceAfter=3, leading=13,
        fontName='Helvetica-Oblique')
    s_footer = ParagraphStyle('Footer', parent=styles['Normal'],
        fontSize=8, textColor=COLOR_GRAY, alignment=TA_CENTER,
        fontName='Helvetica-Oblique')

    story = []

    # ---- COVER ----
    story += [
        Spacer(1, 1.5*cm),
        Paragraph("Hangzhou", ParagraphStyle('emoji', parent=styles['Normal'],
            fontSize=36, alignment=TA_CENTER)),
        Spacer(1, 0.3*cm),
        Paragraph("Hangzhou April Spring Trip Plan", s_cover_title),
        Paragraph("2 Days 1 Night  |  Classic Route  |  Under 500 RMB Budget", s_cover_sub),
        Spacer(1, 0.5*cm),
        HRFlowable(width="80%", thickness=2, color=COLOR_ACCENT,
                   spaceAfter=6, spaceBefore=6, hAlign='CENTER'),
        Spacer(1, 0.3*cm),
        Paragraph("Li Shu Special Travel Guide", s_cover_info),
        Paragraph("Travel Date: April (mid-to-late April recommended, avoid Qingming peak)", s_cover_info),
        Paragraph("Prepared by: Xia KangKang  |  March 2026", s_cover_info),
        Spacer(1, 0.5*cm),
    ]

    hl_table = Table([["West Lake Spring", "Dragon Well Tea", "Lingyin Temple", "Su Causeway"]],
                     colWidths=[3.6*cm]*4)
    hl_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), COLOR_LIGHT_BG),
        ('TEXTCOLOR',(0,0),(-1,-1), COLOR_TITLE),
        ('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('FONTSIZE',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('BOX',(0,0),(-1,-1),1,COLOR_BORDER),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
    ]))
    story += [hl_table, Spacer(1, 0.5*cm)]

    # ---- OVERVIEW ----
    story += [
        Paragraph("Trip Overview", s_section),
        HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
    ]
    ov = [
        ["", "Day 1 (Sat)", "Day 2 (Sun)"],
        ["Morning", "Arrive - West Lake Stroll", "Dragon Well Tea - Tea Plantation Ride"],
        ["Noon", "Waipojia Lunch", "Tea Village Farm Lunch"],
        ["Afternoon", "Lingyin Temple - Feilai Peak", "Manjuelong - Return"],
        ["Evening", "Hefang Street Night Market - Hotel", "---"],
    ]
    ov_table = Table(ov, colWidths=[2.2*cm, 5.9*cm, 5.9*cm])
    ov_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_TITLE),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('BACKGROUND',(0,1),(0,-1), COLOR_LIGHT_BG),
        ('TEXTCOLOR',(0,1),(0,-1), COLOR_TITLE),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(0,-1),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(1,1),(-1,-1),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
    ]))
    story += [ov_table, Spacer(1, 0.4*cm)]

    # ---- BUDGET ----
    story += [
        Paragraph("Budget Breakdown (Total: 500 RMB)", s_section),
        HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
    ]
    bd = [
        ["Category", "Item", "Amount"],
        ["Transport", "To Hangzhou (HSR) + City Metro/Bus", "50 RMB"],
        ["Hotel", "Economy Hotel/B&B (1 night, twin room)", "150 RMB"],
        ["Dining", "Day1 Lunch (Waipojia) + Dinner (Hefang St)", "120 RMB"],
        ["", "Day2 Breakfast + Lunch (Tea Village)", "80 RMB"],
        ["Tickets", "Lingyin Temple (30) + Feilai Peak (45) + Yongfu Temple (35)", "110 RMB"],
        ["", "West Lake Boat - Broken Bridge to Three Pools (55)", "55 RMB"],
        ["Experience", "Dragon Well Tea Picking/Tea Tasting", "30 RMB"],
        ["Misc", "Phone, Souvenirs, Contingency", "20 RMB"],
        ["TOTAL", "", "500 RMB"],
    ]
    bd_table = Table(bd, colWidths=[3.0*cm, 7.5*cm, 3.5*cm])
    bd_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_TITLE),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(-1,-2),'Helvetica'),
        ('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(2,0),(2,-1),'CENTER'),
        ('ALIGN',(0,0),(1,-1),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(0,1),(-1,-2),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
        ('BACKGROUND',(0,-1),(-1,-1), COLOR_LIGHT_BG),
        ('TEXTCOLOR',(2,-1),(2,-1), COLOR_TITLE),
    ]))
    story += [bd_table, Spacer(1, 0.3*cm)]
    story.append(Paragraph(
        "Note: Above budget is per person. Two travelers can split hotel cost, bringing per-person total to ~400 RMB. "
        "Tickets can be discounted via OTA platforms (e.g., Meituan, Fliggy).",
        s_note))

    # ---- DAY 1 ----
    story += [
        KeepTogether([
            Paragraph("Day 1 (Saturday): West Lake + Lingyin Temple", s_section),
            HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
        ])
    ]
    d1 = [
        ["Time", "Location", "Plan"],
        ["08:30-09:00", "Hangzhou East / Cheng Station", "Arrive Hangzhou, Metro Line 1 to West Lake (Longxiang Bridge)"],
        ["09:00-10:30", "Broken Bridge", "Stroll Baidi Causeway, enjoy April peach blossoms & willows (free)"],
        ["10:30-11:30", "West Lake Boat", "Board at Broken Bridge, visit Three Pools and Misty Island (55 RMB)"],
        ["12:00-13:30", "Waipojia (Hubin Branch)", "Lunch: Tea Fragrant Chicken, Dongpo Pork, West Lake Vinegar Fish (~60 RMB)"],
        ["14:00-15:30", "Lingyin Temple", "Visit thousand-year-old temple, pray for blessings (30 RMB)"],
        ["15:30-17:00", "Feilai Peak + Yongfu Temple", "Climb Feilai Peak for stone carvings, tea at Yongfu Temple (45+35 RMB)"],
        ["18:00-19:30", "Hefang Street", "Explore ancient street, try Ding Sheng Gao, buy Dragon Well snacks (dinner ~30 RMB)"],
        ["20:00", "Hotel (Near Wu Shan Plaza)", "Check in, rest"],
    ]
    d1_table = Table(d1, colWidths=[2.8*cm, 3.5*cm, 7.7*cm])
    d1_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_ACCENT),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(0,-1),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(0,0),(1,-1),'CENTER'),
        ('ALIGN',(2,0),(2,-1),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
    ]))
    story += [d1_table, Spacer(1, 0.3*cm)]

    story.append(Paragraph("Day 1 Highlights", s_sub_section))
    for h in [
        "- Broken Bridge (Duanqiao): Iconic West Lake scene. April brings peach blossoms and weeping willows - a photographer's dream.",
        "- Three Pools and Misty Island (Sanyi Yinyue): The central island of West Lake, featured on RMB 1 banknote. The lake-view from the island is extraordinary.",
        "- Lingyin Temple: Hangzhou's most famous temple with flourishing incense. Emperor Kangxi's calligraphy 'Yunlin Chan Si' (Cloud Forest Temple) hangs here.",
        "- Feilai Peak: A limestone hill opposite Lingyin, covered with cave sculptures from the 5th-14th centuries.",
        "- Hefang Street: A historic cultural block. April nights are beautifully lit, with local snacks everywhere.",
    ]:
        story.append(Paragraph(h, s_bullet))

    # ---- DAY 2 ----
    story += [
        KeepTogether([
            Paragraph("Day 2 (Sunday): Dragon Well Tea + Manjuelong", s_section),
            HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
        ])
    ]
    d2 = [
        ["Time", "Location", "Plan"],
        ["08:00-08:30", "Hotel Area", "Breakfast (hotel included or nearby Hangzhou steamed buns)"],
        ["09:00-10:30", "Longjing Village", "Hike the 'Ask Tea of Dragon Well' ancient path, visit Emperor Qianlong's 18 Tea Trees (~30 RMB tea tasting)"],
        ["10:30-12:00", "Meijiawu", "Tea plantation cycling/strolling, taste farm tea snacks, soak in tea culture"],
        ["12:30-14:00", "Tea People's Village", "Lunch: Dragon Well Shrimp, Tea-Fragrant Ribs, Qingming Rice Cakes (~60 RMB)"],
        ["14:00-15:30", "Manjuelong", "Stroll the OSMANTHUS path (quieter in April), visit Spirited Away bathhouse"],
        ["15:30-16:00", "Return", "Taxi/Bus to Hangzhou East Station for departure"],
    ]
    d2_table = Table(d2, colWidths=[2.8*cm, 3.5*cm, 7.7*cm])
    d2_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_ACCENT),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(0,-1),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(0,0),(1,-1),'CENTER'),
        ('ALIGN',(2,0),(2,-1),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
    ]))
    story += [d2_table, Spacer(1, 0.3*cm)]

    story.append(Paragraph("Day 2 Highlights", s_sub_section))
    for h in [
        "- Longjing Village: Home of China's King of Green Tea. The 18 tea trees here were sealed by Emperor Qianlong. April is peak picking season with fragrant tea everywhere.",
        "- Meijiawu: Hangzhou's most famous tea culture leisure village. Tens of thousands of mu of tea gardens - perfect for cycling or hiking.",
        "- Tea People's Village (Charen Cun): A hidden farm-to-table restaurant deep in Longjing Road, beloved by locals for its tranquil setting.",
        "- Manjuelong: A mountain path southwest of West Lake. Quieter in April, perfect for enjoying serene mountain views alone.",
    ]:
        story.append(Paragraph(h, s_bullet))

    # ---- APRIL FEATURES ----
    story += [
        Paragraph("April Hangzhou Special Guide", s_section),
        HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
    ]
    ft = [
        ["Feature", "Recommendation", "Notes"],
        ["Flowers", "Prince Bay Park (Taizi Wan)", "April: tulips & cherry blossoms in full bloom. Hangzhou's most beautiful flower sea (free)"],
        ["Tea Season", "Longjing Village, Meijiawu", "April is precisely when pre-Qingming Longjing is harvested - richest aroma, best price"],
        ["Weather", "15-25 C", "Warm and humid with increasing rain. Bring light jacket and rain gear."],
        ["Photo Spots", "Su Causeway, Baidi Causeway", "April: weeping willows + peach blossoms = prime photography season"],
        ["Transport", "Metro Lines 1 & 2", "West Lake core: Longxiang Bridge Station; Lingyin: by bus"],
    ]
    ft_table = Table(ft, colWidths=[2.5*cm, 3.5*cm, 8.0*cm])
    ft_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_TITLE),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(0,0),(-1,-1),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
    ]))
    story.append(ft_table)

    # ---- NOTES ----
    story += [
        KeepTogether([
            Paragraph("Important Notes", s_section),
            HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
        ])
    ]
    for n in [
        "- AVOID Qingming holiday (Apr 4-6): Choose mid-to-late April weekends. Qingming period sees 3-5x normal crowds and hotel prices surge significantly.",
        "- Book tickets in advance: Lingyin Temple and Yongfu Temple can be reserved via 'Hangzhou West Lake Scenic Area' WeChat official account to skip queues.",
        "- Transit card: Use Hangzhou Metro Alipay/WeChat QR codes, or purchase Hangzhou Tong card for seamless metro + bus travel.",
        "- Clothing: April Hangzhou has occasional showers. Wear anti-slip shoes, bring a foldable umbrella, and light spring outfits for great photos.",
        "- Dragon Well Tea: Buy authentic tea from Longjing Village or Meijiawu legitimate tea farm households. Avoid being overcharged at tourist spots.",
        "- Restaurant reservations: Popular spots like Waipojia and Tea People's Village may have long queues on weekends - book via Dianping (大众点评) in advance.",
        "- Hotel recommendation: Economy hotels near Wu Shan Plaza / Hefang Street (Hanting, Home Inn) - walking distance to both West Lake and the ancient street.",
        "- Health essentials: Pack motion sickness meds, Band-Aids, and mosquito repellent (tea plantations have many mosquitoes).",
    ]:
        story.append(Paragraph(n, s_bullet))

    # ---- PACKING LIST ----
    story += [
        Spacer(1, 0.3*cm),
        KeepTogether([
            Paragraph("Recommended Packing List", s_section),
            HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
        ])
    ]
    pk = [
        ["Category", "Items"],
        ["Documents", "ID Card, Health Insurance Card (just in case)"],
        ["Clothing", "Light jacket x1, Pants x2, Light sweater x2, Underwear & socks"],
        ["Shoes/Bag", "Sports shoes/flat shoes (for walking), Light backpack"],
        ["Daily Use", "Sunscreen, Umbrella/foldable raincoat, Toiletries, Power bank"],
        ["Medicine", "Gastrointestinal meds, Band-Aids, Mosquito repellent (lots of bugs in tea farms)"],
        ["Digital", "Phone + charger + power bank, Camera (optional)"],
        ["Other", "Thermos (for tea), Cash (small amount), Snacks (for long journeys)"],
    ]
    pk_table = Table(pk, colWidths=[2.5*cm, 11.5*cm])
    pk_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), COLOR_TITLE),
        ('TEXTCOLOR',(0,0),(-1,0), HexColor("#ffffff")),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(0,-1),'Helvetica-Bold'),
        ('TEXTCOLOR',(0,1),(0,-1), COLOR_TITLE),
        ('FONTSIZE',(0,0),(-1,-1),9),
        ('ALIGN',(0,0),(0,-1),'CENTER'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('BOX',(0,0),(-1,-1),1,COLOR_ACCENT),
        ('INNERGRID',(0,0),(-1,-1),0.5,COLOR_BORDER),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor("#ffffff"),HexColor("#f9f9f9")]),
    ]))
    story += [pk_table]

    # ---- FOOTER ----
    story += [
        Spacer(1, 0.5*cm),
        HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceAfter=6),
        Paragraph("This guide was carefully planned by Xia KangKang. Have a wonderful Hangzhou trip!",
                  s_footer),
        Paragraph("For itinerary adjustments or more details, feel free to reach out.",
                  s_footer),
    ]

    doc.build(story)
    print(f"PDF generated: {OUTPUT_PATH}")
    return OUTPUT_PATH

if __name__ == "__main__":
    create_pdf()
