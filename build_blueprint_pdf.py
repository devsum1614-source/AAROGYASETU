# -*- coding: utf-8 -*-
"""
Builds the polished, presentation-ready PDF deliverable:
  d:\PROJECT\outputs\AAROGYASETU_Project_Blueprint.pdf
  d:\PROJECT\AarogyaSetu\outputs\AAROGYASETU_Project_Blueprint.pdf
Includes all required sections, tables, and embedded original high-DPI diagrams.
"""

import os
import shutil
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image as RLImage,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)

# Register Devanagari + Latin capable Nirmala UI font family
NIRMALA_TTC = r"C:\Windows\Fonts\Nirmala.ttc"
pdfmetrics.registerFont(TTFont("Nirmala", NIRMALA_TTC, subfontIndex=0))
pdfmetrics.registerFont(TTFont("NirmalaB", NIRMALA_TTC, subfontIndex=1))
pdfmetrics.registerFontFamily(
    "Nirmala",
    normal="Nirmala",
    bold="NirmalaB",
    italic="Nirmala",
    boldItalic="NirmalaB",
)

# Brand Palette (from low_bandwidth_telemedicine_platform.tsx)
C_SLATE_900 = colors.HexColor("#0f172a")
C_SLATE_800 = colors.HexColor("#1e293b")
C_SLATE_700 = colors.HexColor("#334155")
C_SLATE_600 = colors.HexColor("#475569")
C_SLATE_500 = colors.HexColor("#64748b")
C_SLATE_300 = colors.HexColor("#cbd5e1")
C_SLATE_200 = colors.HexColor("#e2e8f0")
C_SLATE_100 = colors.HexColor("#f1f5f9")
C_SLATE_50  = colors.HexColor("#f8fafc")

C_TEAL_900  = colors.HexColor("#134e4a")
C_TEAL_800  = colors.HexColor("#115e59")
C_TEAL_700  = colors.HexColor("#0f766e")
C_TEAL_600  = colors.HexColor("#0d9488")
C_TEAL_500  = colors.HexColor("#14b8a6")
C_TEAL_100  = colors.HexColor("#ccfbf1")
C_TEAL_50   = colors.HexColor("#f0fdfa")

C_BLUE_700  = colors.HexColor("#1d4ed8")
C_BLUE_600  = colors.HexColor("#2563eb")
C_BLUE_50   = colors.HexColor("#eff6ff")

C_AMBER_800 = colors.HexColor("#92400e")
C_AMBER_500 = colors.HexColor("#f59e0b")
C_AMBER_50  = colors.HexColor("#fffbeb")

C_ROSE_700  = colors.HexColor("#be123c")
C_ROSE_600  = colors.HexColor("#e11d48")
C_ROSE_50   = colors.HexColor("#fff1f2")

C_EMERALD_700 = colors.HexColor("#047857")
C_EMERALD_50  = colors.HexColor("#ecfdf5")

PAGE_W, PAGE_H = A4
MARGIN_X = 34
CONTENT_W = PAGE_W - 2 * MARGIN_X  # ~527.27 pt

ASSET_DIR = r"d:\PROJECT\outputs\assets"
PDF_OUT_1 = r"d:\PROJECT\outputs\AAROGYASETU_Project_Blueprint.pdf"
PDF_OUT_2 = r"d:\PROJECT\AarogyaSetu\outputs\AAROGYASETU_Project_Blueprint.pdf"


def draw_page_chrome(canvas, doc):
    """Draws the consistent Slate & Teal low-bandwidth header and footer on every page."""
    canvas.saveState()
    # Top Banner Bar
    canvas.setFillColor(C_SLATE_900)
    canvas.rect(0, PAGE_H - 38, PAGE_W, 38, fill=1, stroke=0)
    canvas.setFillColor(C_TEAL_500)
    canvas.rect(0, PAGE_H - 40, PAGE_W, 2, fill=1, stroke=0)

    canvas.setFont("NirmalaB", 8.8)
    canvas.setFillColor(colors.white)
    canvas.drawString(MARGIN_X, PAGE_H - 24, "AAROGYASETU (आरोग्यसेतु) — “Healthcare Beyond Boundaries”")

    canvas.setFont("Nirmala", 8.2)
    canvas.setFillColor(C_TEAL_100)
    canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 24, "Visual Project Blueprint (Installable PWA)")

    # Bottom Footer Bar
    canvas.setStrokeColor(C_SLATE_200)
    canvas.setLineWidth(0.8)
    canvas.line(MARGIN_X, 32, PAGE_W - MARGIN_X, 32)

    canvas.setFont("Nirmala", 8)
    canvas.setFillColor(C_SLATE_500)
    canvas.drawString(
        MARGIN_X, 18,
        "AAROGYASETU Rural Telemedicine Blueprint • Patient & Doctor Portals • Low-Bandwidth 2G & Offline PWA"
    )
    canvas.setFont("NirmalaB", 8.5)
    canvas.setFillColor(C_TEAL_700)
    canvas.drawRightString(PAGE_W - MARGIN_X, 18, f"Page {doc.page}")
    canvas.restoreState()


def make_styles():
    styles = {}
    styles["TitleHero"] = ParagraphStyle(
        "TitleHero", fontName="NirmalaB", fontSize=24, leading=30, textColor=colors.white, alignment=TA_LEFT
    )
    styles["SubtitleHero"] = ParagraphStyle(
        "SubtitleHero", fontName="NirmalaB", fontSize=13, leading=18, textColor=C_TEAL_100, alignment=TA_LEFT
    )
    styles["HeroBody"] = ParagraphStyle(
        "HeroBody", fontName="Nirmala", fontSize=9.5, leading=14, textColor=C_SLATE_200, alignment=TA_LEFT
    )
    styles["H1"] = ParagraphStyle(
        "H1", fontName="NirmalaB", fontSize=15, leading=20, textColor=C_SLATE_900, spaceBefore=12, spaceAfter=6, keepWithNext=True
    )
    styles["H2"] = ParagraphStyle(
        "H2", fontName="NirmalaB", fontSize=11.5, leading=16, textColor=C_TEAL_800, spaceBefore=9, spaceAfter=4, keepWithNext=True
    )
    styles["H3"] = ParagraphStyle(
        "H3", fontName="NirmalaB", fontSize=10, leading=14, textColor=C_SLATE_800, spaceBefore=6, spaceAfter=2, keepWithNext=True
    )
    styles["Body"] = ParagraphStyle(
        "Body", fontName="Nirmala", fontSize=9, leading=13.2, textColor=C_SLATE_800, spaceAfter=4
    )
    styles["Bullet"] = ParagraphStyle(
        "Bullet", fontName="Nirmala", fontSize=8.8, leading=12.8, leftIndent=12, firstLineIndent=-8, textColor=C_SLATE_800, spaceAfter=2.5
    )
    styles["Caption"] = ParagraphStyle(
        "Caption", fontName="NirmalaB", fontSize=8.2, leading=11.5, textColor=C_SLATE_600, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8
    )
    styles["TblHeader"] = ParagraphStyle(
        "TblHeader", fontName="NirmalaB", fontSize=8.0, leading=10.5, textColor=colors.white, alignment=TA_LEFT
    )
    styles["TblCell"] = ParagraphStyle(
        "TblCell", fontName="Nirmala", fontSize=7.4, leading=9.8, textColor=C_SLATE_800, alignment=TA_LEFT
    )
    styles["TblCellBold"] = ParagraphStyle(
        "TblCellBold", fontName="NirmalaB", fontSize=7.4, leading=9.8, textColor=C_SLATE_900, alignment=TA_LEFT
    )
    styles["CalloutTitle"] = ParagraphStyle(
        "CalloutTitle", fontName="NirmalaB", fontSize=9.5, leading=13, textColor=C_TEAL_900, spaceAfter=2
    )
    styles["CalloutBody"] = ParagraphStyle(
        "CalloutBody", fontName="Nirmala", fontSize=8.6, leading=12.4, textColor=C_SLATE_800
    )
    styles["OutcomeQuote"] = ParagraphStyle(
        "OutcomeQuote", fontName="NirmalaB", fontSize=12, leading=17, textColor=C_TEAL_900, alignment=TA_CENTER
    )
    return styles


def section_banner(num_str, title_str, styles):
    """Creates a full-width teal-accented section header bar."""
    p = Paragraph(f"<font color='#14b8a6'>SECTION {num_str}</font>  |  {title_str}", ParagraphStyle(
        "SecBar", fontName="NirmalaB", fontSize=12, leading=16, textColor=colors.white
    ))
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_SLATE_900),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 2, C_TEAL_500),
    ]))
    return t


def callout_box(title, body_html, bg_color, border_color, styles):
    p1 = Paragraph(title, styles["CalloutTitle"])
    p2 = Paragraph(body_html, styles["CalloutBody"])
    t = Table([[p1], [p2]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
        ("BOX", (0, 0), (-1, -1), 1, border_color),
        ("LINEBEFORE", (0, 0), (0, -1), 4, border_color),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (0, 0), 6),
        ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, 1), (0, 1), 1),
        ("BOTTOMPADDING", (0, 1), (0, 1), 6),
    ]))
    return t


def embed_figure(filename, caption_text, styles, max_w=CONTENT_W, max_h=300):
    """Embeds a PNG asset preserving exact aspect ratio without stretching, paired with its caption."""
    path = os.path.join(ASSET_DIR, filename)
    with PILImage.open(path) as im:
        iw, ih = im.size
    scale = min(max_w / float(iw), max_h / float(ih))
    draw_w = iw * scale
    draw_h = ih * scale
    img_flow = RLImage(path, width=draw_w, height=draw_h)
    img_flow.hAlign = "CENTER"
    cap = Paragraph(caption_text, styles["Caption"])
    return KeepTogether([Spacer(1, 4), img_flow, cap])


def make_styled_table(headers, rows, col_widths, styles, header_bg=C_SLATE_900):
    data = [[Paragraph(h.replace("\n", "<br/>"), styles["TblHeader"]) for h in headers]]
    for r in rows:
        row_cells = []
        for idx, cell_text in enumerate(r):
            st = styles["TblCellBold"] if idx == 0 else styles["TblCell"]
            row_cells.append(Paragraph(cell_text.replace("\n", "<br/>"), st))
        data.append(row_cells)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, C_TEAL_500),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_SLATE_50]),
        ("GRID", (0, 0), (-1, -1), 0.5, C_SLATE_300),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
    ]))
    return tbl


def build_pdf():
    story = []
    st = make_styles()

    # =========================================================================
    # COVER / HERO HEADER + HOW TO USE THIS BLUEPRINT + SECTION 1
    # =========================================================================
    hero_rows = [
        [Paragraph("AAROGYASETU  •  आरोग्यसेतु", st["TitleHero"])],
        [Paragraph("“Healthcare Beyond Boundaries” — Visual Project & Technical Development Blueprint", st["SubtitleHero"])],
        [Paragraph(
            "An installable, mobile-first Progressive Web App (PWA) designed for rural and remote communities with slow "
            "or intermittent 2G internet. Unites a role-separated <b>Patient Portal (11 screens)</b> and <b>Doctor Portal (9 screens)</b> "
            "with client-side image compression, explicit offline/retry states, consent-gated non-PHI SMS appointment updates, "
            "Smart OCR report verification, doctor-approved medicine reminders, tokenized QR profiles, non-diagnostic AI education, and Emergency SOS.",
            st["HeroBody"]
        )],
    ]
    hero_tbl = Table(hero_rows, colWidths=[CONTENT_W])
    hero_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_SLATE_900),
        ("LINEBELOW", (0, -1), (-1, -1), 3, C_TEAL_500),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (0, 0), 12),
        ("BOTTOMPADDING", (0, -1), (0, -1), 12),
    ]))
    story.append(hero_tbl)
    story.append(Spacer(1, 8))

    # HOW TO USE THIS BLUEPRINT (Recommended Build Order)
    story.append(callout_box(
        "How to Use This Blueprint — Recommended 6-Stage Build Order for Beginners & Hackathon Teams",
        "<b>Stage 1 (Foundation & RBAC):</b> Set up Python FastAPI + SQLite (`users`, `patient_profiles`, `doctor_profiles`) and JWT auth for `patient` vs `doctor` roles.<br/>"
        "<b>Stage 2 (Installable PWA Shell & Teal/Slate UI):</b> Build the React + TypeScript app shell (`manifest.json` + `sw.js` &lt; 85 KB) with the persistent 2G Data Saver bar, KB saved counter, and Demo Offline toggle.<br/>"
        "<b>Stage 3 (Appointments & SMS Updates Module):</b> Implement doctor search, slot booking, status transitions (`requested` -&gt; `confirmed` / `rescheduled` / `cancelled`), and the idempotent, zero-PHI SMS queue with Demo Log fallback.<br/>"
        "<b>Stage 4 (Low-Bandwidth Chat, Canvas Compression & Smart OCR):</b> Add consultation messaging (`Saved/Pending/Synced/Failed+Retry`), client-side image compression (`3.2 MB -&gt; 38 KB`), and OCR report extraction with mandatory Doctor Review.<br/>"
        "<b>Stage 5 (Clinical Notes, Medicine Reminders, QR & SOS):</b> Add doctor clinical notes, doctor-approved medicine schedules, tokenized QR sharing, non-diagnostic AI Health Assistant, and manual-dialer Emergency SOS.<br/>"
        "<b>Stage 6 (Demo Verification):</b> Seed fictional rural personas (`Ramesh Kumar` & `Dr. Priya Sharma`) and verify the 3-minute dual-portal walkthrough.",
        C_TEAL_50, C_TEAL_600, st
    ))
    story.append(Spacer(1, 8))

    # SECTION 1: PROJECT OVERVIEW
    story.append(section_banner("1", "PROJECT OVERVIEW", st))
    story.append(Spacer(1, 5))

    id_rows = [
        ["Project Name & Script", "<b>AAROGYASETU</b>  |  Hindi Name: <b>आरोग्यसेतु</b>  |  Tagline: <b>“Healthcare Beyond Boundaries”</b>"],
        ["Target Platform", "Installable Mobile-First Progressive Web App (PWA) for Android/iOS phones & desktop browsers (Chrome/Edge)."],
        ["Design Reference", "Inspired by <i>low_bandwidth_telemedicine_platform.tsx</i>: Slate-900 header, Teal-600 cards, Data-Saved KB counter, 2G toggle & Amber offline banner."],
        ["Distinct User Roles", "<b>1. Patient Portal</b> (Rural citizens & families)  |  <b>2. Doctor Portal</b> (PHC doctors & remote tele-clinicians)."],
    ]
    story.append(make_styled_table(["Attribute", "Specification"], id_rows, [130, CONTENT_W - 130], st))
    story.append(Spacer(1, 5))

    story.append(Paragraph("1.1 The Rural Healthcare Access Problem & Proposed Solution", st["H2"]))
    story.append(Paragraph(
        "<b>The Problem:</b> Families in rural villages often travel 15–50 km to reach a Primary Health Centre (PHC) or specialist doctor, "
        "losing daily wages for simple consultations or lab report follow-ups. Existing telemedicine apps rely on high-bandwidth video calls "
        "and heavy uncompressed image uploads that fail on intermittent 2G/Edge village networks.",
        st["Body"]
    ))
    story.append(Paragraph(
        "<b>Proposed Solution:</b> <b>AAROGYASETU (आरोग्यसेतु)</b> replaces fragile video streaming with an installable, offline-capable PWA "
        "that compresses medical report photos by ~98% in the browser before upload, queues messages and logs with explicit retry states, "
        "keeps patients updated via consent-gated non-PHI SMS notifications, and equips doctors with consultation-scoped triage, "
        "human-verified OCR report reading, and structured medicine schedule tools.",
        st["Body"]
    ))

    user_rows = [
        [
            "1. Rural Patients & Families",
            "Entry-level smartphones, slow/unreliable 2G connectivity, limited data packs, bilingual (English/Hindi) literacy needs.",
            "• Book doctor consultations without long travel.\n• Upload compressed lab reports (~38 KB instead of 3.2 MB).\n• Receive SMS updates for confirmations & reschedules.\n• Access past records, doctor-approved medicine reminders & Emergency SOS offline."
        ],
        [
            "2. PHC & Remote Doctors",
            "High patient volume across village clinics; need rapid triage, structured lab review, and clear follow-up tracking.",
            "• Manage appointment requests (`Confirm`, `Reschedule`, `Cancel`) with automated patient SMS alerts.\n• Review OCR-extracted lab values side-by-side with the image.\n• Publish clinical notes & medicine schedules; scan temporary consented QR tokens."
        ],
    ]
    story.append(make_styled_table(
        ["Intended User Group", "Real-World Context & Constraints", "Expected Benefits"],
        user_rows, [115, 165, CONTENT_W - 280], st
    ))

    story.append(embed_figure(
        "07_feature_overview_diagram.png",
        "Figure 1: AAROGYASETU (आरोग्यसेतु) — 8-Module Feature Overview & Clinical Safety Ecosystem.",
        st, max_h=230
    ))

    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 2: SCOPE AND USER JOURNEYS
    # =========================================================================
    story.append(KeepTogether([
        section_banner("2", "SCOPE AND USER JOURNEYS (PATIENT & DOCTOR WORKFLOWS)", st),
        Spacer(1, 4),
        Paragraph("2.1 Patient Journey (Registration to Follow-Up)", st["H2"]),
    ]))
    p_journey = [
        "<b>1. Registration, Profile & Consent:</b> Patient installs or opens the PWA, registers (`role = patient`), records village, allergies, chronic conditions, and emergency contact (`P-02`), and explicitly opts into <b>SMS Appointment Alerts</b>.",
        "<b>2. Doctor Search & Appointment Booking:</b> Patient filters verified doctors by specialty and language (`P-04`), picks an available time slot (`P-05`), and submits a booking (`status = requested`). An idempotent, zero-PHI booking confirmation SMS is queued immediately.",
        "<b>3. Consultation Messaging & Compressed Report Upload:</b> Inside the appointment consultation (`P-06`, `P-07`), the patient exchanges low-data text messages (`Saved -> Pending -> Synced`) and selects a camera photo of a medical report. The browser compresses the image (`3.2 MB -> 38 KB`) before uploading for OCR extraction.",
        "<b>4. Records, Medicine Reminders, QR & SOS:</b> After the doctor reviews the report and signs the consultation note, the patient views their verified record (`P-07`), marks daily doctor-approved medicine doses `Taken` or `Skipped` (`P-09`), asks educational questions in the <b>AI Health Assistant (`P-08`)</b>, shares a temporary <b>Tokenized QR Code (`P-10`)</b> at a clinic, or uses <b>Emergency SOS (`P-11`)</b>.",
    ]
    for b in p_journey:
        story.append(Paragraph("• " + b, st["Bullet"]))

    story.append(Paragraph("2.2 Doctor Journey (Triage to Clinical Sign-Off)", st["H2"]))
    d_journey = [
        "<b>1. Clinician Sign-In & Availability Setup:</b> Doctor signs into the dedicated Doctor Portal (`D-01`), sets specialty, registration number, spoken languages, and weekly consultation time windows (`D-02`).",
        "<b>2. Appointment Request Management & Status Updates:</b> From the dashboard (`D-03`) and queue (`D-04`), the doctor reviews `requested` appointments and clicks <b>Confirm</b>, <b>Reschedule</b> (proposing a new slot), or <b>Cancel</b>. Each status update triggers a consent-gated, non-PHI SMS notification to the patient.",
        "<b>3. Consultation-Scoped Patient Review & Messaging:</b> Doctor opens the assigned patient's profile (`D-05` — strictly restricted by RBAC to assigned consultations) and replies to the patient's messages (`D-06`).",
        "<b>4. Smart OCR Report Verification, Notes & Medicine Schedule:</b> Doctor inspects the uploaded report alongside machine-extracted OCR values (`D-07`), corrects any misread numbers, marks the report <b>Doctor Reviewed</b>, signs the clinical consultation note (`D-08`), and approves a <b>Medicine Reminder Schedule (`D-09`)</b> for follow-up tracking.",
    ]
    for b in d_journey:
        story.append(Paragraph("• " + b, st["Bullet"]))

    story.append(embed_figure(
        "03_patient_doctor_workflow.png",
        "Figure 2: Complete Patient-to-Doctor Swimlane Journey & Appointment Status Lifecycle (`Requested -> Confirmed / Rescheduled / Cancelled -> Completed`).",
        st, max_h=285
    ))

    story.append(PageBreak())

    # =========================================================================
    # SECTION 3: APP INTERFACES (11 PATIENT SCREENS + 9 DOCTOR SCREENS)
    # =========================================================================
    story.append(section_banner("3", "APP INTERFACES — MOBILE-FIRST WIREFRAMES & SCREEN SPECIFICATIONS", st))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Every screen uses a consistent low-bandwidth visual language inspired by <i>low_bandwidth_telemedicine_platform.tsx</i>: "
        "a Slate-900 telemetry header (`2G Saver: ON | Transferred KB | Data Saved KB`), high-contrast Teal-600/Blue-600 action cards, "
        "accessible labels, and explicit UI state handling (`Loading`, `Empty`, `Offline`, `Pending`, `Success`, `Error`).",
        st["Body"]
    ))

    story.append(embed_figure(
        "01a_patient_mobile_screens_part1.png",
        "Figure 3A: Patient Portal Mobile Wireframes (Part 1: Screens P-01 to P-06).",
        st, max_h=290
    ))
    story.append(embed_figure(
        "01b_patient_mobile_screens_part2.png",
        "Figure 3B: Patient Portal Mobile Wireframes (Part 2: Screens P-07 to P-11 & Accessibility Checklist).",
        st, max_h=290
    ))

    story.append(PageBreak())

    story.append(Paragraph("3.1 Complete Patient Portal Screen Specifications (11 Screens: P-01 to P-11)", st["H2"]))
    patient_screen_rows = [
        [
            "P-01\nWelcome, Sign-Up & Sign-In",
            "Role-aware entry point with PWA install prompt & fast login/registration.",
            "• Brand banner (`AAROGYASETU / आरोग्यसेतु`)\n• Patient/Doctor role tabs\n• Phone/Email & Password inputs\n• `Install App` banner & Demo Quick-Fill",
            "• Sign in or register as Patient\n• Install PWA to home screen\n• Fill demo credentials",
            "• <b>Loading:</b> `Signing in...` spinner\n• <b>Empty:</b> Field required cues\n• <b>Offline:</b> Allows SOS access; notes auth requires connection\n• <b>Pending:</b> Token exchange\n• <b>Success:</b> Routes to `P-03`\n• <b>Error:</b> Invalid credentials retry"
        ],
        [
            "P-02\nPatient Profile & Consent",
            "Manage rural demographics, allergies, emergency contact & SMS consent.",
            "• Name, Age/DOB, Gender, Village\n• Blood Group, Allergies, Conditions\n• Emergency Contact Name & Phone\n• <b>SMS Appointment Alerts Consent Toggle</b>",
            "• Edit profile fields\n• Toggle SMS consent `ON`/`OFF`\n• Save (`1.8 KB` JSON)",
            "• <b>Loading:</b> Input placeholders\n• <b>Empty:</b> Prompts emergency contact setup\n• <b>Offline:</b> `Saved Locally — Pending Sync`\n• <b>Pending:</b> `Saving 1.8 KB...`\n• <b>Success:</b> `Profile Synced` badge\n• <b>Error:</b> Phone format / Retry"
        ],
        [
            "P-03\nPatient Dashboard",
            "Low-bandwidth hub showing network banner, data saved, next visit & due meds.",
            "• Amber <b>Offline Banner</b> (when offline)\n• `Data Saved KB` telemetry pill\n• Next Appointment status card\n• Due Medicine card + 2x2 action grid",
            "• Open active consultation\n• Mark due dose `Taken`\n• Toggle `Simulate Offline (Demo)`\n• Launch any module",
            "• <b>Loading:</b> Text-line skeleton\n• <b>Empty:</b> `Book First Consultation` CTA\n• <b>Offline:</b> Amber banner (`Viewing cached data`)\n• <b>Pending:</b> `1 Queued Item`\n• <b>Success:</b> `All Records Synced`\n• <b>Error:</b> `Tap to Retry Sync`"
        ],
        [
            "P-04\nDoctor Search & Details",
            "Browse doctors by specialty, language & schedule without heavy portraits.",
            "• Specialty & Language filter chips\n• Text-first Doctor Cards (Name, Quals, PHC, Languages, Open Slots)\n• Expandable Doctor Details sheet",
            "• Filter by specialty/language\n• View doctor qualifications & slots\n• Tap `Select Slot & Book`",
            "• <b>Loading:</b> Card outlines\n• <b>Empty:</b> `No doctors match filter`\n• <b>Offline:</b> Displays cached directory\n• <b>Pending:</b> Refreshing slots\n• <b>Success:</b> Verified list rendered\n• <b>Error:</b> Uses cached list + Retry"
        ],
        [
            "P-05\nAppointment Booking & Details",
            "Book new slot or view, reschedule, or cancel an appointment.",
            "• Doctor summary & 15m slot chips\n• Chief complaint input\n• SMS consent indicator\n• Status timeline + `Reschedule`/`Cancel`",
            "• Submit booking (`requested`)\n• Reschedule to a new slot\n• Cancel appointment\n• View SMS alert log",
            "• <b>Loading:</b> Fetching open slots\n• <b>Empty:</b> `No slots on selected date`\n• <b>Offline:</b> Saves booking draft locally\n• <b>Pending:</b> `Submitting request...`\n• <b>Success:</b> `#APT-104 Requested + SMS Queued`\n• <b>Error:</b> Slot conflict / Retry"
        ],
        [
            "P-06\nConsultation Messaging",
            "Low-bandwidth text chat between patient and assigned doctor.",
            "• Appointment header (`#APT-104`)\n• Message bubbles + sync badges\n• Symptom quick-chips\n• Input bar + `Send` + `Retry` button",
            "• Send text message\n• Tap `Retry` on failed messages\n• Open linked report or Rx note",
            "• <b>Loading:</b> Loading chat thread\n• <b>Empty:</b> `Describe your symptoms`\n• <b>Offline:</b> `Saved Locally` in outbox\n• <b>Pending:</b> `Sending 0.6 KB...`\n• <b>Success:</b> `Synced 10:32 AM`\n• <b>Error:</b> `! Failed — Tap Retry`"
        ],
        [
            "P-07\nReport Upload & Records",
            "Compress report photos in browser, view OCR table & read doctor notes.",
            "• Camera/file picker\n• <b>Canvas Compression Badge (`3.2MB -> 38KB`)</b>\n• OCR table (`Pending Doctor Review` / `Verified`)\n• Signed Consultation Notes list",
            "• Select & compress report image\n• Upload compressed file\n• Read OCR values & signed clinical notes",
            "• <b>Loading:</b> `Compressing on device...`\n• <b>Empty:</b> `No reports uploaded yet`\n• <b>Offline:</b> Reads cached records offline\n• <b>Pending:</b> `Uploading 38 KB...`\n• <b>Success:</b> `Uploaded & OCR Extracted`\n• <b>Error:</b> `Upload dropped — Tap Retry`"
        ],
        [
            "P-08\nAI Health Assistant",
            "Non-diagnostic health literacy, medical term explanations & triage guide.",
            "• <b>Amber Non-Diagnostic Disclaimer Banner</b>\n• Question box + rural topic chips\n• Structured plain-language explanation\n• Red-flag alert linking to `P-11 SOS`",
            "• Ask about lab terms or general care\n• Read when to seek clinic care\n• Jump to Booking or SOS on red flags",
            "• <b>Loading:</b> `Fetching health guide...`\n• <b>Empty:</b> Starter literacy cards\n• <b>Offline:</b> Uses built-in Curated Offline Health Guide\n• <b>Pending:</b> Generating response\n• <b>Success:</b> Explanation + safety notice\n• <b>Error:</b> Local glossary fallback"
        ],
        [
            "P-09\nMedicine Reminders",
            "View doctor-approved medicine schedule and log Taken/Skipped doses.",
            "• <b>`Doctor-Approved Only`</b> header\n• Morning / Afternoon / Night cards\n• Dose, meal instruction & duration\n• `Mark Taken` & `Skip` buttons + log",
            "• Tap `Mark Taken` after dose\n• Tap `Skip` with optional note\n• Review 7-day adherence %",
            "• <b>Loading:</b> Loading schedule\n• <b>Empty:</b> `Appears after doctor approval`\n• <b>Offline:</b> Queues dose logs locally\n• <b>Pending:</b> `Syncing dose log...`\n• <b>Success:</b> `Taken 09:05 AM [Synced]`\n• <b>Error:</b> `Stored locally — Tap Retry`"
        ],
        [
            "P-10\nQR Medical Profile & Consent",
            "Share patient-selected profile fields via a temporary, revocable QR token.",
            "• <b>`Zero Raw PHI in QR`</b> notice\n• Field-category checkboxes + Consent\n• Expiry selector (`1h`, `24h`, `7d`)\n• QR SVG + shortcode + `Revoke` button",
            "• Select fields & grant consent\n• Generate temporary QR token\n• Show QR at clinic or revoke early",
            "• <b>Loading:</b> `Generating signed token...`\n• <b>Empty:</b> `No active QR token`\n• <b>Offline:</b> Shows cached unexpired QR\n• <b>Pending:</b> Issuing/revoking token\n• <b>Success:</b> Active QR + expiry timer\n• <b>Error:</b> `Expired/Revoked — regenerate`"
        ],
        [
            "P-11\nEmergency SOS",
            "One-tap emergency dialer, family contact, manual location & nearby PHCs.",
            "• <b>`No Auto-Dispatch`</b> rose banner\n• 1-tap `CALL 108` (`tel:108`) button\n• Family Emergency Contact dial card\n• GPS button + <b>Manual Village Landmark</b>\n• Nearby 24x7 PHC directory",
            "• Tap to open phone dialer (`108`)\n• Call family emergency contact\n• Enter village landmark or request GPS\n• View nearest PHC phone/distance",
            "• <b>Loading:</b> `Checking GPS...`\n• <b>Empty:</b> Prompts landmark entry\n• <b>Offline:</b> <b>Works 100% offline</b> (`tel:` dialer + cached PHCs)\n• <b>Pending:</b> Geolocation prompt\n• <b>Success:</b> Displays landmark + coords\n• <b>Error:</b> GPS denied -> Manual input"
        ],
    ]
    story.append(make_styled_table(
        ["Screen", "Purpose", "Main UI Elements", "User Actions", "States (Loading / Empty / Offline / Pending / Success / Error)"],
        patient_screen_rows, [68, 78, 122, 92, CONTENT_W - 360], st, header_bg=C_TEAL_800
    ))

    story.append(Spacer(1, 8))

    story.append(KeepTogether([
        Paragraph("3.2 Doctor Portal Wireframes & Screen Specifications (9 Screens: D-01 to D-09)", st["H2"]),
        embed_figure(
            "02_doctor_mobile_screens.png",
            "Figure 4: Doctor Portal Mobile & Responsive Wireframes (All 9 Screens: D-01 to D-09).",
            st, max_h=295
        )
    ]))

    doctor_screen_rows = [
        [
            "D-01\nDoctor Sign-Up & Sign-In",
            "Clinician authentication enforcing `role = doctor` separation.",
            "• Clinician Portal header\n• Reg. ID, Specialty, Email/Phone\n• Demo Doctor 1-click sign-in",
            "• Sign in or register as Doctor\n• Use demo doctor account",
            "• <b>Loading:</b> Verifying credentials\n• <b>Empty:</b> Required Reg. ID check\n• <b>Offline:</b> Resumes cached session\n• <b>Pending:</b> Issuing doctor JWT\n• <b>Success:</b> Opens `D-03` Dashboard\n• <b>Error:</b> Auth/role mismatch banner"
        ],
        [
            "D-02\nProfile & Availability",
            "Configure specialty, spoken languages & consultation slots.",
            "• Quals, Reg. No. & PHC name\n• Language checkboxes\n• Weekly day/time slot editor",
            "• Update specialty & languages\n• Publish open consultation windows",
            "• <b>Loading:</b> Loading schedule\n• <b>Empty:</b> Add first time window\n• <b>Offline:</b> Saves draft locally\n• <b>Pending:</b> `Saving schedule...`\n• <b>Success:</b> `Published to directory`\n• <b>Error:</b> Slot overlap warning"
        ],
        [
            "D-03\nDoctor Dashboard",
            "Daily clinical triage metrics, priority queue & QR token lookup.",
            "• Requested / Confirmed / Done counters\n• Unreviewed OCR report alerts\n• <b>QR Token Lookup input box</b>",
            "• Open pending requests\n• Jump to unreviewed reports\n• Resolve patient QR share token",
            "• <b>Loading:</b> Loading queue metrics\n• <b>Empty:</b> `No visits today`\n• <b>Offline:</b> Cached queue + Amber banner\n• <b>Pending:</b> Refreshing queue\n• <b>Success:</b> Live counts updated\n• <b>Error:</b> `Expired/Revoked QR token`"
        ],
        [
            "D-04\nAppointment Management",
            "Confirm, reschedule, or cancel bookings & trigger patient SMS.",
            "• Status filter tabs\n• Patient complaint & slot cards\n• `Confirm`, `Reschedule`, `Cancel` buttons\n• SMS consent indicator",
            "• Confirm requested slot\n• Propose rescheduled slot\n• Cancel with reason",
            "• <b>Loading:</b> Loading appointments\n• <b>Empty:</b> `No requests in tab`\n• <b>Offline:</b> Queues status change\n• <b>Pending:</b> `Updating & queuing SMS`\n• <b>Success:</b> `Confirmed + SMS Logged`\n• <b>Error:</b> Update failed — Retry"
        ],
        [
            "D-05\nPatient List & Details",
            "View assigned patients & consultation-scoped clinical history.",
            "• <b>`Consultation-Scoped Access`</b> banner\n• Assigned patient list\n• Allergies, conditions, vitals & history",
            "• Select assigned patient\n• Inspect allergies & past notes\n• Open consultation workspace",
            "• <b>Loading:</b> Loading patient record\n• <b>Empty:</b> `No assigned patients`\n• <b>Offline:</b> Shows cached patient summary\n• <b>Pending:</b> Syncing records\n• <b>Success:</b> Scoped record displayed\n• <b>Error:</b> `403 Forbidden (Unassigned)`"
        ],
        [
            "D-06\nDoctor Consultation Chat",
            "Low-bandwidth clinical messaging with patient SMS reply alert.",
            "• Patient summary strip\n• Message timeline + sync state\n• Quick clinical phrase chips",
            "• Send clinical reply\n• Insert bilingual care phrases\n• Retry failed messages",
            "• <b>Loading:</b> Loading chat thread\n• <b>Empty:</b> `Send first message`\n• <b>Offline:</b> `Saved — Pending Sync`\n• <b>Pending:</b> `Sending 0.9 KB...`\n• <b>Success:</b> `Synced + Reply SMS Queued`\n• <b>Error:</b> `Send failed — Tap Retry`"
        ],
        [
            "D-07\nSmart OCR Report Review",
            "Verify & edit machine-extracted OCR values side-by-side with image.",
            "• <b>`Machine-Read — Verify`</b> banner\n• Compressed report image viewer\n• Editable OCR table (Date/Test/Value/Unit)\n• `Approve & Mark Reviewed` button",
            "• Compare image vs OCR rows\n• Edit misread values or add rows\n• Mark report `Doctor Reviewed`",
            "• <b>Loading:</b> Running OCR parser\n• <b>Empty:</b> Manual table fallback\n• <b>Offline:</b> Saves review draft locally\n• <b>Pending:</b> `Saving verified table...`\n• <b>Success:</b> `Verified by Doctor` badge\n• <b>Error:</b> Save failed — Retry"
        ],
        [
            "D-08\nConsultation Notes",
            "Author & sign clinical assessment, care advice & follow-up date.",
            "• Assessment / Diagnosis input\n• Care & dietary advice box\n• Follow-up date picker\n• `Sign & Publish Note` button",
            "• Write structured clinical note\n• Set follow-up date\n• Publish to patient records",
            "• <b>Loading:</b> Loading note history\n• <b>Empty:</b> Blank clinical template\n• <b>Offline:</b> Auto-saves local draft\n• <b>Pending:</b> `Signing & publishing...`\n• <b>Success:</b> `Published to Patient Record`\n• <b>Error:</b> Draft preserved — Retry"
        ],
        [
            "D-09\nApprove Medicine Schedule",
            "Doctor-only builder for patient medication reminder schedules.",
            "• <b>`Doctor-Only Creation`</b> banner\n• Drug name, dose, slot & meal inputs\n• Patient adherence log viewer\n• `Approve & Push Schedule` button",
            "• Add prescribed medicines & slots\n• Approve schedule for `P-09`\n• Review patient adherence %",
            "• <b>Loading:</b> Loading schedules\n• <b>Empty:</b> `No active schedule`\n• <b>Offline:</b> Queues draft schedule\n• <b>Pending:</b> `Publishing schedule...`\n• <b>Success:</b> `Active on Patient App`\n• <b>Error:</b> Validation / network retry"
        ],
    ]
    story.append(make_styled_table(
        ["Screen", "Purpose", "Main UI Elements", "User Actions", "States (Loading / Empty / Offline / Pending / Success / Error)"],
        doctor_screen_rows, [68, 78, 122, 92, CONTENT_W - 360], st, header_bg=C_BLUE_700
    ))

    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 4: FEATURE SPECIFICATIONS
    # =========================================================================
    story.append(KeepTogether([
        section_banner("4", "DETAILED FEATURE SPECIFICATIONS", st),
        Spacer(1, 5),
        Paragraph("4.1 Appointment Lifecycle & Appointment Updates Module (SMS Notifications)", st["H2"]),
    ]))
    story.append(Paragraph(
        "• <b>Booking, Confirmation, Rescheduling & Cancellation:</b> Patients book open slots (`requested`), reschedule, or cancel. "
        "Doctors confirm, reschedule (proposing a new date/time), cancel, or complete consultations. Every change is persisted with an audit timestamp.<br/>"
        "• <b>Appointment Updates Module (SMS):</b> Automatically handles 6 lifecycle triggers: <b>Booking Confirmations</b>, <b>Scheduled Reminders</b>, "
        "<b>Doctor Replies</b>, <b>Doctor Confirmations</b>, <b>Rescheduling</b>, and <b>Cancellations</b>.<br/>"
        "• <b>Consent, Zero-PHI Privacy & Demo Fallback:</b> Requires `patient.sms_consent == True`. SMS bodies never contain medical details, symptoms, "
        "lab results, or drug names—only appointment reference `#APT-xxx`, doctor name, and date/time. Uses a deterministic `dedupe_key` stored in the "
        "same database transaction to prevent duplicates, dispatching via Twilio when configured or logging to the clearly labeled <b>Demo SMS Outbox</b>.",
        st["Body"]
    ))

    story.append(embed_figure(
        "05_appointment_sms_notification_flow.png",
        "Figure 5: Appointment Updates Module — Consent Gate, Zero-PHI Filter, Idempotent Queue & Demo Fallback Flow.",
        st, max_h=240
    ))

    story.append(Paragraph("4.2 Clinical Support, Patient Safety & Low-Bandwidth Modules", st["H2"]))
    feat_rows = [
        [
            "AI Health Assistant\n(Non-Diagnostic)",
            "• Explains common medical terms (e.g., Hemoglobin, Platelets, ORS) and general health literacy in plain English/Hindi, plus guidance on when to visit a doctor.\n"
            "• <b>Hard Guardrail:</b> Never diagnoses conditions or prescribes medicines. Detects red-flag symptoms (chest pain, breathing distress) and surfaces a direct link to Emergency SOS (`P-11`). Includes an offline curated fallback."
        ],
        [
            "Emergency SOS\n(No Auto-Dispatch)",
            "• Provides configurable 1-tap phone calling (`tel:108` / local ambulance), saved family emergency contact dialer, optional browser GPS permission prompt, a <b>Manual Village / Landmark entry box</b>, and a cached directory of nearby PHCs.\n"
            "• <b>Hard Guardrail:</b> Explicitly states that the app does <b>not</b> automatically dispatch emergency services; calls are initiated by the user via the device dialer."
        ],
        [
            "QR Medical Profile\n(Tokenized Sharing)",
            "• Patient selects specific profile categories to share, checks an explicit consent box, and picks an expiration time (`1h`, `24h`, `7d`).\n"
            "• <b>Hard Guardrail:</b> The QR code encodes <b>only a temporary signed token</b> (`ASETU-TK-...`), never raw medical information. Tokens expire automatically and can be revoked by the patient with one tap."
        ],
        [
            "Doctor-Approved Medicine Reminders",
            "• <b>Doctor-Only Creation:</b> Only authenticated doctors (`D-09`) can create or approve a medication schedule (drug name, dosage, Morning/Afternoon/Night timing, meal relation, duration).\n"
            "• Patients view active reminders (`P-09`), mark each dose `Taken` or `Skipped (with note)`, and build an adherence log visible to the doctor during follow-up."
        ],
        [
            "Smart Medical Report Reader (OCR)",
            "• Extracts test dates, parameter labels, numeric values, and units from uploaded lab report photos.\n"
            "• <b>Hard Guardrail:</b> All OCR output is labeled <b>“Machine-Read — May Be Incomplete — Requires Doctor Review”</b>. Doctors verify and edit extracted values side-by-side with the image (`D-07`) or enter values manually if OCR is unavailable."
        ],
        [
            "Low-Bandwidth & Sync State Engine",
            "• <b>Client-Side Image Compression:</b> HTML5 Canvas resizes and compresses `3.2 MB` photos to `~38 KB` JPEG/WebP before upload, displaying real KB saved.\n"
            "• <b>Explicit Connectivity & Item States:</b> Header includes a demo-labeled `Simulate Offline` switch and Amber Offline Banner. Every action shows `Saved` -&gt; `Pending` -&gt; `Synced` or `Failed (Tap to Retry)`."
        ],
    ]
    story.append(make_styled_table(["Feature Module", "Functional & Safety Specification"], feat_rows, [120, CONTENT_W - 120], st))

    story.append(embed_figure(
        "06_low_bandwidth_pwa_behavior.png",
        "Figure 6: Low-Bandwidth Engineering — Installable PWA App Shell, Client Canvas Compression & Sync Lifecycle.",
        st, max_h=225
    ))

    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 5: TECHNICAL DEVELOPMENT BLUEPRINT
    # =========================================================================
    story.append(KeepTogether([
        section_banner("5", "TECHNICAL DEVELOPMENT BLUEPRINT", st),
        Spacer(1, 5),
        Paragraph("5.1 Recommended Architecture & System Data Flow", st["H2"]),
    ]))
    story.append(Paragraph(
        "• <b>Frontend:</b> React 18 + TypeScript + Vite as an installable Progressive Web App (`manifest.json` + Service Worker `sw.js`).<br/>"
        "• <b>Backend:</b> Python FastAPI REST API with Pydantic v2 validation and JWT Bearer role authentication.<br/>"
        "• <b>Database & Storage:</b> SQLite (`aarogyasetu.db`) for zero-config local hackathon demos with a drop-in SQLAlchemy migration path to PostgreSQL; private local file storage (`backend/storage/reports/`) gated by RBAC.<br/>"
        "• <b>Optional Integrations with Demo Fallbacks:</b> Twilio SMS (`Demo SMS Log` fallback), Gemini/OpenAI (`Offline Curated Health Guide` fallback), and Tesseract OCR (`Structured Parser / Manual Doctor Review` fallback) configured strictly via backend environment variables.",
        st["Body"]
    ))

    story.append(embed_figure(
        "04_system_architecture_and_dataflow.png",
        "Figure 7: AAROGYASETU 4-Tier System Architecture & Data Flow Diagram.",
        st, max_h=265
    ))

    story.append(Paragraph("5.2 Database Entities & Relationships", st["H2"]))
    db_rows = [
        ["users", "id (PK), phone (Unique), email, password_hash, role ('patient'|'doctor'), full_name, created_at", "1:1 with `patient_profiles` or `doctor_profiles`"],
        ["patient_profiles", "id (PK), user_id (FK), age, dob, gender, village_or_town, blood_group, allergies, chronic_conditions, emergency_contact_name/phone, manual_location_landmark, sms_consent (Bool)", "1:N with `appointments`, `medical_reports`, `sms_notifications`, `qr_share_tokens`"],
        ["doctor_profiles", "id (PK), user_id (FK), registration_number, specialty, qualifications, languages_json, clinic_name, availability_json, is_accepting", "1:N with `appointments`, `consultation_notes`, `medicine_schedules`"],
        ["appointments", "id (PK), reference_code ('APT-104'), patient_id (FK), doctor_id (FK), scheduled_date, scheduled_time, status ('requested'|'confirmed'|'rescheduled'|'cancelled'|'completed'), chief_complaint, status_reason", "1:N with `messages`, `medical_reports`, `consultation_notes`, `medicine_schedules`, `sms_notifications`"],
        ["messages", "id (PK), appointment_id (FK), sender_id (FK), sender_role, content, client_msg_id (Unique idempotency key), byte_size, created_at", "Belongs to `appointments`"],
        ["medical_reports", "id (PK), appointment_id (FK), patient_id (FK), title, file_path (Private), original_size_bytes, compressed_size_bytes, ocr_status, extracted_fields_json, doctor_reviewed (Bool), doctor_corrected_fields_json, doctor_review_note", "Belongs to `appointments` & `patient_profiles`; reviewed by `doctor_profiles`"],
        ["consultation_notes", "id (PK), appointment_id (FK), patient_id (FK), doctor_id (FK), assessment, care_advice, red_flag_warnings, follow_up_date, created_at", "Authored by assigned Doctor for Patient"],
        ["medicine_schedules & adherence_logs", "schedule: id, appointment_id, patient_id, doctor_id, medicine_name, dosage_strength, schedule_times_json, meal_instruction, duration_days\nlog: id, schedule_id (FK), dose_date, dose_slot, status ('taken'|'skipped'), note", "Created only by Doctor; adherence logged by Patient"],
        ["sms_notifications", "id (PK), appointment_id (FK), patient_id (FK), recipient_phone, event_type, message_body (Zero PHI), dedupe_key (Unique), delivery_mode ('live_twilio'|'demo_log'), status", "Created in same transaction as appointment/message event"],
        ["qr_share_tokens", "id (PK), patient_id (FK), token (Unique random string), shared_scopes_json, consent_confirmed (Bool), expires_at, is_revoked (Bool), access_count", "Generated/revoked by Patient; resolved by Doctor"],
    ]
    story.append(make_styled_table(
        ["Table / Entity", "Key Columns & Types", "Relationships & Access Scope"],
        db_rows, [95, 275, CONTENT_W - 370], st
    ))

    story.append(Spacer(1, 6))

    story.append(Paragraph("5.3 REST API Endpoint Plan & Role-Based Access Control (RBAC)", st["H2"]))
    api_rows = [
        ["POST /api/auth/register\nPOST /api/auth/login\nGET /api/auth/me", "Public / Authenticated", "Register patient or doctor account, issue role-scoped JWT (`patient` vs `doctor`), and fetch current session profile."],
        ["GET, PUT /api/patients/me/profile", "Patient Only (Own ID)", "Read or update the patient's own demographics, allergies, emergency contact, manual landmark, and `sms_consent` toggle."],
        ["GET /api/doctors\nPUT /api/doctors/me/profile", "Patient & Doctor /\nDoctor Only", "Search doctors by specialty & language (`GET`); update doctor qualifications and availability slots (`PUT`)."],
        ["POST /api/appointments\nGET /api/appointments\nPATCH /api/appointments/{id}/status", "Patient (Book) /\nScoped Patient & Doctor", "Create booking (`requested`), list own/assigned appointments, and transition status (`confirmed`, `rescheduled`, `cancelled`, `completed`) with automatic SMS queueing."],
        ["GET /api/appointments/{id}/sms-logs", "Scoped Patient & Doctor", "View consent-gated, zero-PHI SMS notification audit trail (`live_twilio` vs `demo_log`)."],
        ["GET, POST /api/appointments/{id}/messages", "Scoped Patient & Doctor", "Fetch consultation thread or send low-bandwidth text message (idempotent via `client_msg_id`; doctor reply queues SMS)."],
        ["POST /api/reports/upload\nGET /api/reports/{id}/file\nPUT /api/reports/{id}/review", "Patient (Upload) /\nScoped Patient & Doc /\nScoped Doctor (Review)", "Upload client-compressed lab image & run OCR; stream private file after RBAC check; doctor verifies/edits OCR table and sets `doctor_reviewed = True`."],
        ["POST /api/appointments/{id}/notes\nGET /api/records", "Scoped Doctor (Create) /\nScoped Patient & Doctor", "Doctor signs & publishes clinical consultation note; patient and assigned doctor view chronological medical records."],
        ["POST /api/reminders/schedules\nGET /api/reminders/schedules\nPOST /api/reminders/schedules/{id}/log", "Scoped Doctor (Create) /\nScoped Patient & Doc /\nPatient (Log Dose)", "Doctor-only creation of approved medicine schedules; patient marks daily doses `taken` or `skipped`."],
        ["POST /api/qr/generate\nPOST /api/qr/{token}/revoke\nGET /api/qr/resolve/{token}", "Patient (Gen/Revoke) /\nDoctor (Resolve)", "Generate or revoke temporary tokenized QR profile; resolve consented fields if token is unexpired and unrevoked."],
        ["POST /api/assistant/ask\nGET /api/sos/info", "Patient", "Non-diagnostic health literacy Q&A with red-flag triage alert; retrieve emergency contact, `108` helpline & nearby PHCs."],
    ]
    story.append(make_styled_table(
        ["REST Endpoints", "RBAC Enforcement", "Functional Summary"],
        api_rows, [145, 105, CONTENT_W - 250], st
    ))

    story.append(Paragraph("5.4 PWA Installation, Offline Behavior & Hackathon Demo Plan", st["H2"]))
    story.append(Paragraph(
        "• <b>Installable PWA Architecture:</b> `public/manifest.json` declares standalone display, theme color `#0f172a`, and home-screen icons. "
        "Service Worker `public/sw.js` pre-caches the `&lt; 85 KB` App Shell (`index.html`, CSS/JS, icons) on first visit and caches read-only GET responses (`doctors`, `records`, `reminders`, `sos`) for offline viewing.<br/>"
        "• <b>3-Minute Hackathon Demo Plan:</b> (1) Sign in as rural patient <i>Ramesh Kumar</i>, show PWA installability, enable SMS consent, book <i>Dr. Priya Sharma</i>, and upload a `3.2 MB` report compressed client-side to `38 KB`. "
        "(2) Toggle `Simulate Offline (Demo)` to show the Amber Offline Banner and queued message state (`Saved -> Pending -> Synced`), then ask the AI Health Assistant about Hemoglobin. "
        "(3) Sign into the Doctor Portal as <i>Dr. Priya Sharma</i>, confirm the appointment (triggering the zero-PHI SMS log), verify the OCR report values, sign a clinical note, and approve a Medicine Schedule. "
        "(4) Return to Patient Portal to mark a medicine dose `Taken`, generate a 24h Tokenized QR code, and preview Emergency SOS.",
        st["Body"]
    ))

    # =========================================================================
    # SECTION 6: PRIVACY AND SAFETY & SECTION 7: EXPECTED OUTCOME
    # =========================================================================
    story.append(Spacer(1, 4))
    story.append(section_banner("6", "PRIVACY, SECURITY AND CLINICAL SAFETY COMMITMENTS", st))
    story.append(Spacer(1, 5))

    safety_rows = [
        ["1. Strict Patient Data Isolation", "Patients can access only their own profile, appointments, messages, reports, medicine reminders, and QR tokens."],
        ["2. Consultation-Scoped Doctor Access", "Doctors can access patient data only for patients assigned to their consultations (or via an active, unexpired patient-consented QR token)."],
        ["3. Consent-Gated, Zero-PHI SMS", "SMS notifications require explicit patient consent (`sms_consent = True`) and never contain medical details, symptoms, diagnoses, or drug names."],
        ["4. Tokenized QR Codes Only", "QR codes encode a secure temporary token (`ASETU-TK-...`) with expiration and 1-tap revocation—never raw medical information directly."],
        ["5. Non-Diagnostic AI Assistant", "The AI Health Assistant provides basic health education, medical term definitions, and guidance on when to seek care; it never diagnoses or prescribes."],
        ["6. Mandatory Doctor Review of OCR", "Machine-extracted OCR lab values may be incomplete or inaccurate and are prominently labeled as requiring doctor verification before clinical use."],
        ["7. No Automatic Emergency Dispatch", "Emergency SOS provides 1-tap phone dialer links (`tel:108`), emergency contacts, manual/GPS location notes, and nearby clinics; it never auto-dispatches."],
        ["8. Prototype & Fictional Data Notice", "This blueprint and prototype are not production-ready certified medical software and must be demonstrated exclusively using fictional demo data."],
    ]
    story.append(make_styled_table(
        ["Safety & Privacy Pillar", "Mandatory Implementation Rule"],
        safety_rows, [155, CONTENT_W - 155], st, header_bg=C_ROSE_700
    ))

    story.append(Spacer(1, 8))
    story.append(section_banner("7", "EXPECTED OUTCOME", st))
    story.append(Spacer(1, 6))

    outcome_box = Table(
        [[Paragraph(
            "“A working prototype that demonstrates how technology can make basic healthcare services "
            "more accessible to people in rural and remote areas.”",
            st["OutcomeQuote"]
        )]],
        colWidths=[CONTENT_W]
    )
    outcome_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_TEAL_50),
        ("BOX", (0, 0), (-1, -1), 1.5, C_TEAL_600),
        ("LEFTPADDING", (0, 0), (-1, -1), 18),
        ("RIGHTPADDING", (0, 0), (-1, -1), 18),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(outcome_box)

    os.makedirs(os.path.dirname(PDF_OUT_1), exist_ok=True)
    os.makedirs(os.path.dirname(PDF_OUT_2), exist_ok=True)

    doc = SimpleDocTemplate(
        PDF_OUT_1,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=50,
        bottomMargin=42,
        title="AAROGYASETU (आरोग्यसेतु) — Visual Project Blueprint",
        author="AAROGYASETU Architecture Team",
    )
    doc.build(story, onFirstPage=draw_page_chrome, onLaterPages=draw_page_chrome)
    shutil.copyfile(PDF_OUT_1, PDF_OUT_2)
    print(f"PDF generated successfully at:\n  1) {PDF_OUT_1}\n  2) {PDF_OUT_2}")


if __name__ == "__main__":
    build_pdf()
