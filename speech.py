#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成中文发言稿PDF - 使用reportlab + 中文字体"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.pdfgen import canvas

# Register Chinese font
FONT_PATH = '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'
pdfmetrics.registerFont(TTFont('DroidSans', FONT_PATH))

OUTPUT = '/home/uncleclaw/.openclaw/workspace/WM/speech.pdf'

# Colors
DARK_BLUE = '#2D5F8A'
LIGHT_GRAY = '#F5F5F5'

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.setFont('DroidSans', 9)
        self.setFillColor('#666666')
        self.drawRightString(A4[0] - 2*cm, 1.5*cm, f'{self._pageNumber} / {page_count}')

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=2.5*cm,
        rightMargin=2.5*cm,
        topMargin=2.5*cm,
        bottomMargin=2.5*cm,
        title='大模型与工作流工具的协同应用'
    )

    # Define styles
    styles = {
        'title': ParagraphStyle(
            'Title',
            fontName='DroidSans',
            fontSize=24,
            leading=30,
            textColor='#2D5F8A',
            spaceAfter=6,
            alignment=TA_CENTER,
        ),
        'subtitle': ParagraphStyle(
            'Subtitle',
            fontName='DroidSans',
            fontSize=14,
            leading=20,
            textColor='#666666',
            spaceAfter=30,
            alignment=TA_CENTER,
        ),
        'h1': ParagraphStyle(
            'H1',
            fontName='DroidSans',
            fontSize=16,
            leading=22,
            textColor='#2D5F8A',
            spaceBefore=20,
            spaceAfter=10,
        ),
        'h2': ParagraphStyle(
            'H2',
            fontName='DroidSans',
            fontSize=13,
            leading=18,
            textColor='#333333',
            spaceBefore=14,
            spaceAfter=8,
        ),
        'body': ParagraphStyle(
            'Body',
            fontName='DroidSans',
            fontSize=11,
            leading=18,
            textColor='#1A1A1A',
            spaceAfter=8,
            alignment=TA_JUSTIFY,
        ),
        'numbered': ParagraphStyle(
            'Numbered',
            fontName='DroidSans',
            fontSize=11,
            leading=18,
            textColor='#1A1A1A',
            spaceAfter=8,
            leftIndent=20,
            alignment=TA_JUSTIFY,
        ),
        'bullet': ParagraphStyle(
            'Bullet',
            fontName='DroidSans',
            fontSize=11,
            leading=18,
            textColor='#1A1A1A',
            spaceAfter=8,
            leftIndent=20,
            alignment=TA_JUSTIFY,
        ),
        'salutation': ParagraphStyle(
            'Salutation',
            fontName='DroidSans',
            fontSize=12,
            leading=18,
            textColor='#1A1A1A',
            spaceAfter=10,
        ),
    }

    story = []

    # ===== 封面页 =====
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph('大模型与工作流工具的协同应用', styles['title']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('拓展认知边界与提升部门效能', styles['subtitle']))
    story.append(Spacer(1, 1.5*cm))

    # 封面装饰线
    story.append(Paragraph(f'<font color="{DARK_BLUE}">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</font>', ParagraphStyle('line', fontName='DroidSans', fontSize=10, alignment=TA_CENTER)))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('黎 叔', ParagraphStyle('author', fontName='DroidSans', fontSize=13, textColor='#333333', alignment=TA_CENTER)))
    story.append(Paragraph('2026年4月', ParagraphStyle('date', fontName='DroidSans', fontSize=11, textColor='#888888', alignment=TA_CENTER)))
    story.append(PageBreak())

    # ===== 正文页 =====
    story.append(Paragraph('各位同事：', styles['salutation']))
    story.append(Paragraph('今天想和大家探讨一下大模型与AI工具在实际工作中如何具体使用。要理解这一点，我们首先需要把当前的AI应用在功能逻辑上做一个区分：大模型与基于大模型的工作流工具，二者在定位和用法上是截然不同的。', styles['body']))
    story.append(Paragraph('为了方便理解，我以大家比较熟悉的「元宝」和「openclaw/虾」为例做一个对比分析。', styles['body']))
    story.append(Spacer(1, 0.3*cm))

    # 第一部分
    story.append(Paragraph('<b>一、大模型的核心价值：作为「思维外脑」，拓展认知边界</b>', styles['h1']))
    story.append(Paragraph('大模型（如元宝）的核心作用不在于执行具体的动作，而在于辅助思考与创意生成。', styles['body']))
    story.append(Paragraph('我们每个人的认知范围、学习速度都是有限的，存在明确的边界。但大模型通过整合全球海量知识，能够快速打破这种局限。它的价值体现在两个维度：', styles['body']))
    story.append(Paragraph('<b>1. 辅助决策与问题探讨：</b>当我们遇到未曾涉猎过的领域，或者需要对复杂问题进行推演时，大模型可以作为一个即时的讨论对象。它能帮助我们快速了解陌生概念，拓展视野，让我们在面对技术难题或新业务时不再束手无策。', styles['numbered']))
    story.append(Paragraph('<b>2. 替代专业生产力，降低协作成本：</b>以最近推出的GPT-4o图像生成功能为例，其出图质量已非常接近高级设计师团队的水准。过去我们需要联络兄弟部门、协调设计资源才能完成的宣传画、示意图，现在可以通过大模型快速生成。这不仅提升了沟通效率，也让我们在与政府部门、周边部门对接时，拥有了更直观、更高效的沟通载体。', styles['numbered']))
    story.append(Spacer(1, 0.3*cm))

    # 第二部分
    story.append(Paragraph('<b>二、工作流工具的价值：从「单次调用」到「系统化部署」</b>', styles['h1']))
    story.append(Paragraph('如果说大模型是大脑，那么像「openclaw」这类基于大模型的工作流工具，则是我们的自动化神经传导系统。这里需要明确一个关键局限：工作流本身并不能提升大模型的智力水平，它不会让模型变得更聪明。', styles['body']))
    story.append(Paragraph('但它解决了三个大模型单打独斗时无法解决的问题：', styles['body']))
    story.append(Paragraph('<b>1. 定时触发与无人值守：</b>大模型需要人手一次次去调用，而工作流可以定时。无论是监控政府动向、行业动态，只要Token预算允许，我们可以设定每小时甚至每天定时抓取、分析。', styles['numbered']))
    story.append(Paragraph('<b>2. 批量化复制与并发监控：</b>借助工作流，我们相当于把「一个人+一个大模型」的组合，复制成了「10个甚至100个大模型助理」。它可以同时监控10个部门的动向、10个行业的报告，这种并发处理能力是人工无法比拟的。', styles['numbered']))
    story.append(Paragraph('<b>3. 自动整理与知识沉淀（落盘）：</b>这是最关键的一步。工作流具备操作硬盘、读写文件的能力。它能把每次定时抓取的结果自动生成文件，存放在指定的路径，甚至可以进一步对海量碎片信息进行归纳、提炼。', styles['numbered']))
    story.append(Spacer(1, 0.3*cm))

    # 第三部分
    story.append(Paragraph('<b>三、结合部门KPI：如何实现工作流的嵌入与落地</b>', styles['h1']))
    story.append(Paragraph('结合我们部门的实际工作，我们作为非纯技术部门，KPI的核心在于：对内服务好技术部门，对外服务好客户。', styles['body']))
    story.append(Paragraph('• <b>对内服务：</b>我们对接的技术端口多、知识更新快，个人学习速度很难跟上。有了大模型辅助，我们可以快速理解技术要点；而有了工作流工具，我们甚至可以搭建一个自动维护的部门知识库。每天收集的行业报告、政策文件，通过工作流自动清洗、归类、落盘，形成我们部门专属的、实时更新的信息资产。', styles['bullet']))
    story.append(Paragraph('• <b>对外服务：</b>我们可以将信息收集、动态报告生成等工作自动化。这就相当于我们部门聘请了一位不知疲倦的自动小秘书，它负责盯盘、收集、整理、归档，而我们则可以把精力集中在更高价值的分析判断与客户沟通上。', styles['bullet']))
    story.append(Spacer(1, 0.3*cm))

    # 总结
    story.append(Paragraph('<b>总结</b>', styles['h1']))
    story.append(Paragraph('openclaw这类工具与传统的、单一的AI助手的区别在于：它通过工作流的形式，将AI能力从「0到1的演示」变成了「1到10、10到100的自动化落地」。', styles['body']))
    story.append(Paragraph('关于具体的嵌入实施，这确实需要后续与兄弟技术部门协同配合。但我们可以构想这样一个场景：一旦Workflow或openclaw完成信息的抓取与分析，数据便自动流向我们的部门知识库完成存储。届时，我们将真正拥有一套自动感知、自动整理、自动沉淀的底层能力系统。', styles['body']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph('以上是我的一些思考，谢谢大家。', styles['body']))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f'PDF created: {OUTPUT}')

if __name__ == '__main__':
    build_pdf()
