#!/usr/bin/env python3
"""Builds assets/resume/Ammaar_Rehman_Resume.pdf — single source of truth.

Usage:  python3 tools/resume.py
Requires: reportlab
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
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


doc = SimpleDocTemplate("assets/resume/Ammaar_Rehman_Resume.pdf", pagesize=letter,
                        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
                        title="Ammaar Rehman — Resume", author="Ammaar Rehman")
e = []
e.append(Paragraph("AMMAAR REHMAN", S["name"]))
e.append(Paragraph(
    "Ellicott City, Maryland &nbsp;|&nbsp; (301) 768-5445 &nbsp;|&nbsp; ammaarrehmanf@gmail.com &nbsp;|&nbsp; "
    "linkedin.com/in/ammaarrehman &nbsp;|&nbsp; ammaarrehman.github.io", S["contact"]))

e.append(Paragraph("SUMMARY", S["h"])); e.append(rule())
e.append(Paragraph(
    "Howard Community College student (3.648 GPA, Dean's List) transferring to the University of Maryland "
    "for a B.S. in Information Systems. <b>AWS Certified Cloud Practitioner</b> with hands-on experience in IT "
    "support, operations, and inventory systems. Seeking internships in IT, cloud, or information systems.",
    S["body"]))

e.append(Paragraph("CERTIFICATIONS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>AWS Certified Cloud Practitioner</b> — Amazon Web Services, 2026",
    "<b>CompTIA Network+</b> — in progress (expected 2026)",
]))

e.append(Paragraph("EDUCATION", S["h"])); e.append(rule())
e.append(job("Howard Community College, Columbia, MD", "Expected 2026"))
e.append(Paragraph("A.A. General Studies &nbsp;|&nbsp; GPA: 3.648 &nbsp;|&nbsp; Dean's List", S["body"]))
e.append(Paragraph(
    "Relevant Coursework: Python, Accounting I &amp; II, Economics (Macro &amp; Micro), Business Calculus, "
    "Statistics, Marketing, Intro to Business, Computer Concepts", S["body"]))
e.append(job("Glenelg High School, Glenelg, MD — High School Diploma", "2024"))
e.append(Paragraph("Honors: FBLA 2023 National Qualifier, National Honor Society", S["body"]))

e.append(Paragraph("TECHNICAL SKILLS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>Cloud:</b> AWS (S3, CloudFront, Route 53, IAM, EC2 fundamentals)",
    "<b>Programming:</b> Python (data structures, file I/O, control flow), JavaScript, HTML/CSS, Java (basic)",
    "<b>Tools &amp; Platforms:</b> Git/GitHub, Microsoft Excel, WordPress, Shopify, inventory &amp; POS systems",
    "<b>Core:</b> IT support &amp; troubleshooting, hardware &amp; networking fundamentals, security basics, data analysis",
]))

e.append(Paragraph("PROFESSIONAL EXPERIENCE", S["h"])); e.append(rule())
e.append(job("NextGen Consulting Inc. — IT &amp; Operations Intern", "Jun 2022 – Aug 2023"))
e.extend(bullets([
    "Resolved 200+ technical support issues for users, documenting solutions to improve future issue resolution",
    "Supported mobile application development through testing, troubleshooting, and feedback",
    "Assisted with IT systems setup, account configuration, and basic troubleshooting",
]))
e.append(job("The UPS Store, Clarksville, MD — Associate", "Sep 2025 – Present"))
e.extend(bullets([
    "Assist customers with shipping, packaging, printing, and mailbox services in a high-volume environment",
    "Process transactions accurately while resolving customer issues and maintaining service quality",
]))
e.append(job("Howard CC Campus Store (Slingshot), Columbia, MD — Operations Associate", "Aug 2024 – Present"))
e.extend(bullets([
    "Manage order fulfillment, receiving, and inventory operations for textbooks and merchandise",
    "Maintain accurate inventory using store systems; handle high-volume semester rushes",
]))
e.append(job("Roots Market, Clarksville, MD — Associate", "Aug 2024 – Mar 2025"))
e.extend(bullets([
    "Managed cash deposits, register balancing, and end-of-day procedures",
    "Trained new employees on procedures and customer service expectations",
]))

e.append(Paragraph("PROJECTS", S["h"])); e.append(rule())
e.extend(bullets([
    "<b>Personal ePortfolio</b> — designed, built, and deployed ammaarrehman.github.io (HTML, CSS, JavaScript, "
    "Python tooling, GitHub Pages); migrating to AWS S3 + CloudFront + Route 53",
    "<b>NIGHTFALL / Nightstar Solutions</b> — founder of a one-person web &amp; IT delivery operation; "
    "shipped and maintain the company site and brand system",
]))

e.append(Paragraph("LEADERSHIP &amp; HONORS", S["h"])); e.append(rule())
e.append(Paragraph(
    "Maryland House of Delegates — Volunteer Staff &nbsp;|&nbsp; National Honor Society &nbsp;|&nbsp; "
    "Key Club &nbsp;|&nbsp; Dean's List &nbsp;|&nbsp; FBLA National Qualifier", S["body"]))

doc.build(e)
print("wrote assets/resume/Ammaar_Rehman_Resume.pdf")
