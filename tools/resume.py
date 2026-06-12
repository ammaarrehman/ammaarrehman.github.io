#!/usr/bin/env python3
"""Regenerates a resume PDF matching resume v2.

Note: the deployed assets/resume/Ammaar_Rehman_Resume.pdf is Ammaar's own
v2 export — this script is a backup that rebuilds equivalent content.
Run with an output path to avoid overwriting the deployed file.

Usage:  python3 tools/resume.py [out.pdf]
Requires: reportlab
"""
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Table,
                                TableStyle, HRFlowable)

INK = HexColor("#111111")
GREY = HexColor("#444444")

S = {
    "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=17,
                           leading=20, textColor=INK, spaceAfter=2),
    "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=8.5,
                              leading=11, textColor=GREY, spaceAfter=6),
    "h": ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=10,
                        leading=12, textColor=INK, spaceBefore=8, spaceAfter=2),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9,
                           leading=11.5, textColor=INK),
    "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9,
                             leading=11.5, textColor=INK, leftIndent=12,
                             bulletIndent=2, spaceAfter=1),
    "job": ParagraphStyle("job", fontName="Helvetica-Bold", fontSize=9.5,
                          leading=12, textColor=INK, spaceBefore=4),
    "date": ParagraphStyle("date", fontName="Helvetica", fontSize=9,
                           leading=12, textColor=GREY, alignment=2),
}


def rule():
    return HRFlowable(width="100%", thickness=0.7, color=INK, spaceBefore=1, spaceAfter=3)


def job(title_left, date_right):
    return Table([[Paragraph(title_left, S["job"]), Paragraph(date_right, S["date"])]],
                 colWidths=[5.3 * inch, 2.0 * inch],
                 style=TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                   ("TOPPADDING", (0, 0), (-1, -1), 0),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))


def bullets(items):
    return [Paragraph(t, S["bullet"], bulletText="•") for t in items]


out = sys.argv[1] if len(sys.argv) > 1 else "resume_v2_regen.pdf"
doc = SimpleDocTemplate(out, pagesize=letter,
                        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
                        title="Ammaar Rehman — Resume", author="Ammaar Rehman")
e = []
e.append(Paragraph("AMMAAR REHMAN", S["name"]))
e.append(Paragraph(
    "Ellicott City, Maryland &nbsp;|&nbsp; (301) 768-5445 &nbsp;|&nbsp; ammaarrehmanf@gmail.com &nbsp;|&nbsp; "
    "linkedin.com/in/ammaarrehman &nbsp;|&nbsp; ammaarrehman.github.io", S["contact"]))

e.append(Paragraph("CERTIFICATIONS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>AWS Certified Cloud Practitioner</b> — Amazon Web Services (CLF-C02), June 2026",
    "<b>CompTIA Network+</b> (N10-009) — in progress, expected July 2026",
]))

e.append(Paragraph("EDUCATION", S["h"])); e.append(rule())
e.append(job("Howard Community College, Columbia, MD", "Expected 2026"))
e.append(Paragraph("A.A. General Studies &nbsp;|&nbsp; GPA: 3.648 &nbsp;|&nbsp; Dean's List", S["body"]))
e.append(Paragraph(
    "Relevant Coursework: Accounting I &amp; II, Economics (Macro &amp; Micro), Business Calculus, Statistics, "
    "Marketing, Intro to Business, Computer Concepts, Python", S["body"]))
e.append(job("Glenelg High School, Glenelg, MD — High School Diploma", "2024"))
e.append(Paragraph("Honors: FBLA 2023 National Qualifier, National Honor Society", S["body"]))

e.append(Paragraph("TECHNICAL SKILLS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>Cloud:</b> AWS, S3, CloudFront, Route 53, IAM, EC2 fundamentals",
    "<b>Programming/Web:</b> Python, JavaScript, HTML/CSS, Java basics",
    "<b>Tools &amp; Platforms:</b> Git/GitHub, Microsoft Excel, WordPress, Shopify, inventory/POS systems",
    "<b>IT Foundations:</b> Troubleshooting, hardware fundamentals, networking basics, security basics, data analysis",
]))

e.append(Paragraph("PROFESSIONAL EXPERIENCE", S["h"])); e.append(rule())
e.append(job("NextGen Consulting Inc., Washington DC–Baltimore Area — IT &amp; Operations Intern", "Jun 2022 – Aug 2023"))
e.extend(bullets([
    "Resolved 200+ technical support issues for users, documenting solutions to improve future issue resolution",
    "Supported mobile application development through testing, troubleshooting, and feedback",
    "Assisted with IT systems setup, account configuration, and basic troubleshooting",
]))
e.append(job("NightStar Solutions, Ellicott City, MD — Founder", "May 2026 – Present"))
e.extend(bullets([
    "Built and maintain a small web and technology project brand focused on websites, digital setup, and IT-focused learning projects",
    "Develop project documentation, service pages, and client-facing materials for future small business website work",
    "Use the brand as a portfolio platform for web development, cloud, cybersecurity, and IT infrastructure projects",
]))
e.append(job("Howard CC Campus Store / Slingshot, Columbia, MD — Operations Associate", "Aug 2024 – Present"))
e.extend(bullets([
    "Use Juniper and store operations software to receive merchandise, fulfill orders, update inventory records, and support back-end store operations",
    "Manage order fulfillment, receiving, stocking, and inventory accuracy for textbooks, merchandise, and course materials",
    "Assist students, faculty, and staff with purchases, course material support, and issue resolution during high-volume semester rush periods",
]))
e.append(job("The UPS Store, Clarksville, MD — Associate", "Sep 2025 – Present"))
e.extend(bullets([
    "Process domestic and international shipments using shipping/logistics software, including package details, customs information, labels, and service options",
    "Assist customers with shipping, packaging, printing, mailbox services, and issue resolution in a high-volume retail environment",
    "Handle transactions accurately while maintaining attention to detail, service quality, and delivery requirements",
]))

e.append(Paragraph("PROJECTS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>Home Network DNS Filtering Project</b> — Raspberry Pi, AdGuard Home, DNS filtering, router/DHCP configuration",
    "<b>AWS Cloud Portfolio Deployment</b> — Amazon S3, CloudFront, Route 53, IAM, custom domain hosting",
]))

e.append(Paragraph("LEADERSHIP &amp; HONORS", S["h"])); e.append(rule())
e.append(Paragraph(
    "Maryland House of Delegates — Volunteer Staff &nbsp;|&nbsp; Dean's List &nbsp;|&nbsp; FBLA National Qualifier",
    S["body"]))

doc.build(e)
print("wrote", out)
