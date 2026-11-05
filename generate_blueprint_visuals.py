# -*- coding: utf-8 -*-
"""
Generates original visual assets (High-DPI PNGs + SVGs) for the AAROGYASETU
(आरोग्यसेतु — "Healthcare Beyond Boundaries") Visual Project Blueprint.
Inspired by the teal & slate design system of low_bandwidth_telemedicine_platform.tsx.
"""

import os
import math
import shutil
from PIL import Image, ImageDraw, ImageFont

OUT_DIRS = [
    r"d:\PROJECT\outputs\assets",
    r"d:\PROJECT\AarogyaSetu\outputs\assets",
]

for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)

# Color Palette from reference file (low_bandwidth_telemedicine_platform.tsx)
SLATE_950 = "#020617"
SLATE_900 = "#0f172a"
SLATE_800 = "#1e293b"
SLATE_700 = "#334155"
SLATE_600 = "#475569"
SLATE_500 = "#64748b"
SLATE_400 = "#94a3b8"
SLATE_300 = "#cbd5e1"
SLATE_200 = "#e2e8f0"
SLATE_100 = "#f1f5f9"
SLATE_50  = "#f8fafc"

TEAL_900  = "#134e4a"
TEAL_800  = "#115e59"
TEAL_700  = "#0f766e"
TEAL_600  = "#0d9488"
TEAL_500  = "#14b8a6"
TEAL_100  = "#ccfbf1"
TEAL_50   = "#f0fdfa"

EMERALD_700 = "#047857"
EMERALD_600 = "#059669"
EMERALD_500 = "#10b981"
EMERALD_100 = "#d1fae5"
EMERALD_50  = "#ecfdf5"

AMBER_800 = "#92400e"
AMBER_600 = "#d97706"
AMBER_500 = "#f59e0b"
AMBER_100 = "#fef3c7"
AMBER_50  = "#fffbeb"

ROSE_700  = "#be123c"
ROSE_600  = "#e11d48"
ROSE_100  = "#ffe4e6"
ROSE_50   = "#fff1f2"

BLUE_700  = "#1d4ed8"
BLUE_600  = "#2563eb"
BLUE_100  = "#dbeafe"
BLUE_50   = "#eff6ff"

PURPLE_700 = "#6d28d9"
PURPLE_100 = "#ede9fe"
PURPLE_50  = "#f5f3ff"

WHITE = "#ffffff"


def get_font(size: int, bold: bool = False):
    nirmala_path = r"C:\Windows\Fonts\Nirmala.ttc"
    segoe_path = r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"
    if os.path.exists(nirmala_path):
        try:
            return ImageFont.truetype(nirmala_path, size, index=1 if bold else 0)
        except Exception:
            pass
    if os.path.exists(segoe_path):
        return ImageFont.truetype(segoe_path, size)
    return ImageFont.load_default()


def wrap_text(draw, text: str, font, max_width: int):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_multiline(draw, x, y, text, font, fill, max_width, line_gap=4):
    lines = wrap_text(draw, text, font, max_width)
    cy = y
    for line in lines:
        draw.text((x, cy), line, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), line, font=font)
        cy += (bbox[3] - bbox[1]) + line_gap
    return cy


def draw_badge(draw, x, y, text, bg, fg, font, pad_x=10, pad_y=4, radius=10, border=None):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    w = tw + pad_x * 2
    h = th + pad_y * 2 + 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=bg, outline=border, width=1 if border else 0)
    draw.text((x + pad_x, y + pad_y - 1), text, font=font, fill=fg)
    return w, h


def draw_arrow(draw, x1, y1, x2, y2, color=TEAL_600, width=3, head_len=10):
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2 - head_len * math.cos(angle - math.pi / 6), y2 - head_len * math.sin(angle - math.pi / 6))
    p2 = (x2 - head_len * math.cos(angle + math.pi / 6), y2 - head_len * math.sin(angle + math.pi / 6))
    draw.polygon([(x2, y2), p1, p2], fill=color)


def draw_banner_header(draw, width, title, subtitle, badge_text):
    draw.rectangle([0, 0, width, 88], fill=SLATE_900)
    draw.rectangle([0, 84, width, 88], fill=TEAL_500)
    f_title = get_font(24, bold=True)
    f_sub = get_font(14, bold=False)
    f_badge = get_font(13, bold=True)
    # Teal medical cross icon box
    draw.rounded_rectangle([24, 18, 68, 62], radius=10, fill=TEAL_600)
    draw.rectangle([42, 26, 50, 54], fill=WHITE)
    draw.rectangle([32, 36, 60, 44], fill=WHITE)
    draw.text((84, 16), title, font=f_title, fill=WHITE)
    draw.text((84, 49), subtitle, font=f_sub, fill=SLATE_300)
    bw, bh = draw_badge(draw, width - 310, 26, badge_text, TEAL_800, TEAL_100, f_badge, pad_x=14, pad_y=6, radius=14, border=TEAL_500)


def draw_phone_card(draw, x, y, w, h, code, title, role_color, mode_tag, elements, states_text):
    """Draws a crisp mobile wireframe card with low-bandwidth status bar, UI elements, and state badges."""
    # Outer phone bezel
    draw.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=WHITE, outline=SLATE_300, width=2)
    # Top speaker notch bar
    draw.rounded_rectangle([x + 2, y + 2, x + w - 2, y + 54], radius=16, fill=SLATE_900)
    draw.rectangle([x + 2, y + 36, x + w - 2, y + 54], fill=SLATE_900)

    f_code = get_font(12, bold=True)
    f_title = get_font(14, bold=True)
    f_tiny = get_font(11, bold=False)
    f_tiny_b = get_font(11, bold=True)
    f_body = get_font(12, bold=False)
    f_body_b = get_font(12, bold=True)

    # Code pill & screen title
    cw, _ = draw_badge(draw, x + 12, y + 10, code, role_color, WHITE, f_code, pad_x=7, pad_y=2, radius=6)
    draw.text((x + 18 + cw, y + 10), title, font=f_title, fill=WHITE)

    # Low-bandwidth telemetry strip inside phone header
    draw.text((x + 12, y + 34), "2G Saver: ON  |  14 KB", font=f_tiny, fill=TEAL_100)
    mt_bbox = draw.textbbox((0, 0), mode_tag, font=f_tiny_b)
    mt_w = (mt_bbox[2] - mt_bbox[0]) + 14
    draw_badge(draw, x + w - mt_w - 10, y + 32, mode_tag, SLATE_800, EMERALD_100 if "Online" in mode_tag else AMBER_100, f_tiny_b, pad_x=6, pad_y=1, radius=6)

    cy = y + 62
    for kind, label, sublabel, accent in elements:
        if cy > y + h - 54:
            break
        if kind == "banner":
            bg = AMBER_50 if accent == "amber" else (ROSE_50 if accent == "rose" else (TEAL_50 if accent == "teal" else BLUE_50))
            fg = AMBER_800 if accent == "amber" else (ROSE_700 if accent == "rose" else (TEAL_800 if accent == "teal" else BLUE_700))
            bd = AMBER_500 if accent == "amber" else (ROSE_600 if accent == "rose" else (TEAL_500 if accent == "teal" else BLUE_600))
            draw.rounded_rectangle([x + 12, cy, x + w - 12, cy + 38], radius=8, fill=bg, outline=bd, width=1)
            draw.text((x + 20, cy + 4), label, font=f_tiny_b, fill=fg)
            draw.text((x + 20, cy + 20), sublabel, font=f_tiny, fill=SLATE_600)
            cy += 44
        elif kind == "input":
            draw.rounded_rectangle([x + 12, cy, x + w - 12, cy + 36], radius=7, fill=SLATE_50, outline=SLATE_300, width=1)
            draw.text((x + 20, cy + 3), label, font=f_tiny_b, fill=SLATE_500)
            draw.text((x + 20, cy + 18), sublabel, font=f_body_b, fill=SLATE_800)
            cy += 42
        elif kind == "card":
            draw.rounded_rectangle([x + 12, cy, x + w - 12, cy + 48], radius=8, fill=WHITE, outline=SLATE_200, width=1)
            bar_c = TEAL_600 if accent == "teal" else (EMERALD_600 if accent == "emerald" else (AMBER_500 if accent == "amber" else (ROSE_600 if accent == "rose" else BLUE_600)))
            draw.rounded_rectangle([x + 12, cy, x + 17, cy + 48], radius=3, fill=bar_c)
            draw.text((x + 24, cy + 6), label, font=f_body_b, fill=SLATE_900)
            draw.text((x + 24, cy + 25), sublabel, font=f_tiny, fill=SLATE_600)
            cy += 54
        elif kind == "chat":
            is_doc = accent == "doc"
            bx1 = x + 12 if is_doc else x + 36
            bx2 = x + w - 36 if is_doc else x + w - 12
            bg = SLATE_100 if is_doc else TEAL_50
            bd = SLATE_300 if is_doc else TEAL_500
            draw.rounded_rectangle([bx1, cy, bx2, cy + 42], radius=8, fill=bg, outline=bd, width=1)
            draw.text((bx1 + 10, cy + 4), label, font=f_tiny_b, fill=SLATE_800 if is_doc else TEAL_900)
            draw.text((bx1 + 10, cy + 21), sublabel, font=f_tiny, fill=SLATE_600)
            cy += 48
        elif kind == "button":
            btn_c = TEAL_600 if accent == "teal" else (ROSE_600 if accent == "rose" else (SLATE_800 if accent == "slate" else EMERALD_600))
            draw.rounded_rectangle([x + 12, cy, x + w - 12, cy + 34], radius=8, fill=btn_c)
            bbox = draw.textbbox((0, 0), label, font=f_body_b)
            tw = bbox[2] - bbox[0]
            draw.text((x + (w - tw) // 2, cy + 8), label, font=f_body_b, fill=WHITE)
            cy += 40
        elif kind == "split_btn":
            draw.rounded_rectangle([x + 12, cy, x + w // 2 - 4, cy + 32], radius=7, fill=EMERALD_600)
            draw.rounded_rectangle([x + w // 2 + 4, cy, x + w - 12, cy + 32], radius=7, fill=SLATE_200, outline=SLATE_400, width=1)
            draw.text((x + 24, cy + 7), label, font=f_tiny_b, fill=WHITE)
            draw.text((x + w // 2 + 14, cy + 7), sublabel, font=f_tiny_b, fill=SLATE_800)
            cy += 38

    # Footer states strip inside phone card
    draw.rounded_rectangle([x + 2, y + h - 40, x + w - 2, y + h - 2], radius=14, fill=SLATE_100)
    draw.line([(x + 2, y + h - 40), (x + w - 2, y + h - 40)], fill=SLATE_300, width=1)
    draw.text((x + 12, y + h - 33), "UI States:", font=f_tiny_b, fill=SLATE_700)
    draw.text((x + 70, y + h - 33), states_text, font=f_tiny, fill=TEAL_800)


def save_both_png_and_svg(img: Image.Image, base_name: str, title_for_svg: str):
    """Saves high-DPI PNG and an accompanying standalone SVG wrapper/diagram in all output folders."""
    import base64
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    png_bytes = buf.getvalue()
    b64 = base64.b64encode(png_bytes).decode("ascii")
    w, h = img.size
    svg_content = f'''<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <title>{title_for_svg}</title>
  <desc>Original vector/high-DPI blueprint visual for AAROGYASETU (Healthcare Beyond Boundaries)</desc>
  <image width="{w}" height="{h}" xlink:href="data:image/png;base64,{b64}"/>
</svg>
'''
    for out_dir in OUT_DIRS:
        png_path = os.path.join(out_dir, f"{base_name}.png")
        svg_path = os.path.join(out_dir, f"{base_name}.svg")
        with open(png_path, "wb") as f:
            f.write(png_bytes)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)


def build_patient_screens_part1():
    W, H = 1600, 980
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU (आरोग्यसेतु) — Patient Mobile Screens (Part 1: P-01 to P-06)",
        "Mobile-first low-bandwidth PWA wireframes inspired by low_bandwidth_telemedicine_platform.tsx",
        "ROLE: PATIENT PORTAL (1/2)"
    )

    screens = [
        ("P-01", "Welcome & Auth", TEAL_600, "Online 2G", [
            ("banner", "आरोग्यसेतु • Healthcare Beyond Boundaries", "Installable PWA • Works on 2G & Offline", "teal"),
            ("input", "ROLE & LANGUAGE", "Patient Portal  |  English / हिन्दी", "teal"),
            ("input", "MOBILE NUMBER", "+91 98765 43210", "teal"),
            ("input", "PASSWORD / PIN", "•••••••• (Remember on device)", "teal"),
            ("button", "Sign In to Patient Portal", "", "teal"),
            ("card", "New Rural Patient? Register", "Offline-capable sign-up + SMS consent", "emerald"),
        ], "Loading | Invalid Auth | Offline Cached"),
        ("P-02", "Patient Profile", TEAL_600, "Synced", [
            ("card", "Ramesh Kumar (42 yrs • Male)", "Village: Rampur PHC Sector-4, Sitapur", "teal"),
            ("input", "EMERGENCY CONTACT", "Sita Devi (Wife) • +91 98765 00001", "teal"),
            ("input", "BLOOD GROUP & ALLERGIES", "B+  |  Allergy: Penicillin", "teal"),
            ("banner", "[ON] SMS Appointment Alerts Consent", "Receive non-medical SMS updates on phone", "teal"),
            ("button", "Save Profile (1.8 KB Payload)", "", "teal"),
        ], "Saved | Pending Sync | Validation Error"),
        ("P-03", "Patient Dashboard", TEAL_600, "Offline Sim", [
            ("banner", "OFFLINE / SLOW NETWORK (DEMO)", "Viewing cached records • Queuing actions", "amber"),
            ("card", "Next Appt: Dr. Priya Sharma", "Today 11:30 AM • Status: CONFIRMED", "emerald"),
            ("card", "Medicine Reminder: Metformin", "500mg After Morning Meal • [Mark Taken]", "teal"),
            ("split_btn", "Find Doctor", "Upload Report", "teal"),
            ("split_btn", "AI Assistant", "QR & SOS", "teal"),
        ], "Online | Offline Banner | Empty Queue"),
        ("P-04", "Doctor Search & Info", TEAL_600, "Online 2G", [
            ("input", "SEARCH SPECIALTY / LANGUAGE", "General Medicine • Hindi, English", "teal"),
            ("card", "Dr. Priya Sharma (MBBS, MD)", "General Physician • PHC Nodal • 9 yrs exp", "teal"),
            ("card", "Dr. Vikram Verma (MBBS, DCH)", "Pediatrics & Maternal Care • Available", "emerald"),
            ("banner", "Low-Data Text Cards Only", "No heavy doctor photos (Saves ~420 KB)", "teal"),
            ("button", "View Slots & Book Consultation", "", "teal"),
        ], "Loading Skeleton | Empty Filter | Cached"),
        ("P-05", "Appointment Booking", TEAL_600, "Online 2G", [
            ("card", "Dr. Priya Sharma • Gen. Medicine", "Selected Slot: 2026-11-06 • 10:30 AM", "teal"),
            ("input", "CHIEF COMPLAINT / SYMPTOMS", "Fever for 3 days, mild cough & weakness", "teal"),
            ("banner", "SMS Update: ENABLED (Consented)", "Confirmation SMS queued upon submit", "teal"),
            ("button", "Confirm Booking Request", "", "teal"),
            ("split_btn", "Reschedule Slot", "Cancel Appt", "teal"),
        ], "Pending Queue | Confirmed | Rescheduled"),
        ("P-06", "Consultation Chat", TEAL_600, "Slow 2G", [
            ("card", "Appt #APT-104 • Dr. Priya Sharma", "Status: Confirmed • Text-Only Low Data", "teal"),
            ("chat", "You • 10:32 AM [Synced]", "Namaste Doctor, fever is 100.4 F since Tue.", "pat"),
            ("chat", "Dr. Priya Sharma • 10:35 AM", "Please share your blood test report photo.", "doc"),
            ("chat", "You • 10:36 AM [! Failed - Tap Retry]", "Uploading report now, network dropped.", "pat"),
            ("button", "Send Text / Retry Pending (1)", "", "teal"),
        ], "Saved -> Pending -> Synced | Failed+Retry"),
    ]

    cols = 3
    card_w = 486
    card_h = 395
    start_x = 36
    start_y = 110
    gap_x = 34
    gap_y = 32

    for idx, sc in enumerate(screens):
        r = idx // cols
        c = idx % cols
        x = start_x + c * (card_w + gap_x)
        y = start_y + r * (card_h + gap_y)
        draw_phone_card(draw, x, y, card_w, card_h, *sc)

    save_both_png_and_svg(img, "01a_patient_mobile_screens_part1", "Patient Mobile Screens Part 1 (P-01 to P-06)")


def build_patient_screens_part2():
    W, H = 1600, 980
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU (आरोग्यसेतु) — Patient Mobile Screens (Part 2: P-07 to P-11)",
        "Report Compression, Non-Diagnostic AI, Medicine Reminders, Tokenized QR & Emergency SOS",
        "ROLE: PATIENT PORTAL (2/2)"
    )

    screens = [
        ("P-07", "Report Upload & Records", TEAL_600, "Compressed", [
            ("banner", "Client-Side Canvas Compression", "Raw Photo 3.2 MB -> 38 KB WebP/JPEG (98% saved)", "teal"),
            ("card", "CBC_Lab_Report_Nov2026.jpg", "OCR Status: Extracted (Pending Doctor Review)", "amber"),
            ("card", "Rx Note: Viral Fever & Hydration", "Dr. Priya Sharma • Signed 05 Nov 2026", "emerald"),
            ("button", "Select Camera / File & Compress", "", "teal"),
            ("card", "Offline Record Cache Ready", "Last 5 consultation summaries stored locally", "teal"),
        ], "Compressing | Uploading | Retry | Reviewed"),
        ("P-08", "AI Health Assistant", TEAL_600, "Safe Guard", [
            ("banner", "NON-DIAGNOSTIC EDUCATION ONLY", "Does NOT diagnose or prescribe medicine", "amber"),
            ("chat", "Patient Question:", "What does 'Hemoglobin 10.8 g/dL' mean?", "pat"),
            ("chat", "AI Health Guide (Demo/Safe Mode):", "Hemoglobin carries oxygen. Discuss diet & iron with your doctor. Seek care if dizzy.", "doc"),
            ("card", "Red-Flag Warning Trigger", "Chest pain / high fever -> Shows SOS button", "rose"),
            ("button", "Ask Health Literacy Question", "", "teal"),
        ], "Loading | Demo Fallback | Red-Flag Alert"),
        ("P-09", "Medicine Reminders", TEAL_600, "Doctor-Set", [
            ("banner", "DOCTOR-APPROVED SCHEDULE ONLY", "Prescribed by Dr. Priya Sharma (#APT-104)", "teal"),
            ("card", "1. Paracetamol 500 mg", "1 Tab • Morning & Night (After Food) • 3 Days", "emerald"),
            ("card", "2. ORS Electrolyte Sachet", "1 Glass after loose motion • [Taken 09:00 AM]", "teal"),
            ("split_btn", "Mark Taken", "Skip (Log Note)", "teal"),
            ("card", "Adherence History: 92%", "Synced with Doctor Portal for follow-up", "teal"),
        ], "Due Now | Taken | Skipped | Offline Queued"),
        ("P-10", "QR Medical Profile", TEAL_600, "Tokenized", [
            ("banner", "ZERO RAW PHI INSIDE QR CODE", "Contains temporary signed token only", "teal"),
            ("card", "Selected Fields (Explicit Consent):", "[ON] Blood Group & Allergies  [ON] Emergency Contact", "teal"),
            ("card", "QR Token: ASETU-TK-89F2... (24h)", "Expires: 06 Nov 10:30 AM • Scannable at PHC", "emerald"),
            ("split_btn", "Generate New QR", "Revoke Now", "teal"),
            ("card", "Audit Log: 1 Validated Scan", "Scanned by Dr. Priya Sharma at 10:40 AM", "teal"),
        ], "Consent Off | Active Token | Expired | Revoked"),
        ("P-11", "Emergency SOS", ROSE_600, "No Auto-Dispatch", [
            ("banner", "MANUAL CALL ONLY (NO AUTO-DISPATCH)", "Tap button below to open phone dialer", "rose"),
            ("button", "CALL 108 AMBULANCE (ONE-TAP)", "", "rose"),
            ("card", "Alert Family: Sita Devi (Wife)", "One-tap call +91 98765 00001 • Share location", "amber"),
            ("input", "VILLAGE / MANUAL LANDMARK", "Near Gram Panchayat Bhawan, Rampur", "teal"),
            ("card", "Nearest Health Facility (2.4 km)", "Rampur Primary Health Centre (24x7 Open)", "teal"),
        ], "GPS Granted | Manual Landmark | Offline List"),
    ]

    cols = 3
    card_w = 486
    card_h = 395
    start_x = 36
    start_y = 110
    gap_x = 34
    gap_y = 32

    for idx, sc in enumerate(screens):
        r = idx // cols
        c = idx % cols
        x = start_x + c * (card_w + gap_x)
        y = start_y + r * (card_h + gap_y)
        draw_phone_card(draw, x, y, card_w, card_h, *sc)

    # 6th slot: Summary legend card for Patient Accessibility & States
    x = start_x + 2 * (card_w + gap_x)
    y = start_y + 1 * (card_h + gap_y)
    draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=18, fill=SLATE_900, outline=TEAL_500, width=2)
    f_h = get_font(18, bold=True)
    f_b = get_font(13, bold=False)
    f_bb = get_font(13, bold=True)
    draw.text((x + 24, y + 22), "Patient Portal Design Checklist", font=f_h, fill=TEAL_100)
    checklist = [
        ("• Installable PWA:", "Adds to Android/Desktop home screen"),
        ("• High-Contrast UI:", "WCAG AA Slate & Teal color tokens"),
        ("• Touch Targets:", "Min 48x48px buttons for rural usability"),
        ("• Data Budget:", "< 85 KB initial shell, text-first cards"),
        ("• Explicit Sync:", "Every action shows Saved/Pending/Synced"),
        ("• Bilingual Labels:", "Clear English + simple Hindi terms"),
        ("• Safety Guardrails:", "Non-diagnostic AI, manual SOS dialer"),
        ("• Honest Demo Tags:", "Simulated offline & SMS logs labeled"),
    ]
    cy = y + 64
    for k, v in checklist:
        draw.text((x + 24, cy), k, font=f_bb, fill=TEAL_500)
        draw.text((x + 172, cy), v, font=f_b, fill=SLATE_200)
        cy += 38

    save_both_png_and_svg(img, "01b_patient_mobile_screens_part2", "Patient Mobile Screens Part 2 (P-07 to P-11)")


def build_doctor_screens():
    W, H = 1600, 1380
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU (आरोग्यसेतु) — Doctor Portal Screens (All 9 Screens: D-01 to D-09)",
        "Consultation-scoped access, appointment triage, OCR verification, clinical notes & medicine schedules",
        "ROLE: DOCTOR PORTAL (D-01..D-09)"
    )

    screens = [
        ("D-01", "Doctor Sign-Up & Sign-In", BLUE_600, "Verified Role", [
            ("banner", "Doctor Portal Authentication", "Separate RBAC scope (`role = doctor`)", "blue"),
            ("input", "MEDICAL REG. ID & SPECIALTY", "MCI-UP-44912 • General Medicine", "blue"),
            ("input", "EMAIL / MOBILE NUMBER", "dr.priya@rampurphc.org", "blue"),
            ("button", "Sign In to Clinician Workspace", "", "slate"),
            ("card", "Demo Clinician Quick-Fill", "One-click hackathon judge sign-in", "teal"),
        ], "Loading | Auth Error | Session Active"),
        ("D-02", "Profile & Availability", BLUE_600, "Slot Config", [
            ("card", "Dr. Priya Sharma (MBBS, MD)", "Languages: Hindi, English • Fee: Free (PHC)", "blue"),
            ("input", "AVAILABLE DAYS & TIME WINDOWS", "Mon-Sat • 09:00 AM - 01:00 PM (15m slots)", "blue"),
            ("card", "Low-Bandwidth Consultation Mode", "Text + Compressed Reports (No Video Call)", "teal"),
            ("button", "Publish Availability Schedule", "", "teal"),
        ], "Saved | Slot Conflict | Offline Queued"),
        ("D-03", "Doctor Dashboard", BLUE_600, "Live Queue", [
            ("card", "Today's Triage Summary", "4 Pending Requests • 6 Confirmed • 2 Completed", "blue"),
            ("card", "Urgent Review: Ramesh Kumar", "New CBC Report Uploaded (OCR Pending Review)", "amber"),
            ("card", "QR Token Lookup Input", "Enter patient's temporary consent token", "teal"),
            ("split_btn", "Open Queue (4)", "Scan/Read QR", "teal"),
        ], "Loading | Empty Queue | Offline Cached"),
        ("D-04", "Appointment Requests", BLUE_600, "SMS Triggered", [
            ("card", "#APT-104 • Ramesh Kumar (42M)", "Requested: 06 Nov 10:30 AM • Fever 3 days", "amber"),
            ("split_btn", "Confirm Slot", "Reschedule", "teal"),
            ("banner", "Auto-Triggers Appointment SMS", "Sends non-PHI status update if consented", "teal"),
            ("card", "#APT-105 • Meena Devi (29F)", "Confirmed • Antenatal Routine Checkup", "emerald"),
        ], "Requested | Confirmed | Rescheduled | Cancelled"),
        ("D-05", "Patient List & Details", BLUE_600, "Scoped RBAC", [
            ("banner", "CONSULTATION-SCOPED ACCESS ONLY", "Authorized via active Appointment #APT-104", "blue"),
            ("card", "Ramesh Kumar • 42M • Blood: B+", "Village: Rampur • Allergy: Penicillin", "teal"),
            ("card", "Past History & Vitals Summary", "BP: 124/82 • Last Visit: 14 Oct 2026", "emerald"),
            ("button", "Open Consultation Workspace", "", "slate"),
        ], "Authorized | 403 Forbidden (Unassigned)"),
        ("D-06", "Doctor Consultation Chat", BLUE_600, "Low-Data", [
            ("chat", "Ramesh Kumar • 10:32 AM", "Namaste Doctor, fever is 100.4 F since Tue.", "doc"),
            ("chat", "Dr. Priya Sharma • 10:35 AM", "Take rest & share your CBC lab report image.", "pat"),
            ("banner", "SMS Alert Status: Dispatched", "Patient notified of new doctor reply (no PHI)", "teal"),
            ("button", "Send Clinical Reply (1.2 KB)", "", "teal"),
        ], "Sending | Synced | Retry on Drop"),
        ("D-07", "Smart OCR Report Review", BLUE_600, "Human-in-Loop", [
            ("banner", "MACHINE-READ OCR — VERIFY VALUES", "Raw image shown alongside extracted table", "amber"),
            ("card", "Extracted: Hemoglobin = 10.8 g/dL", "Date: 04 Nov 2026 • Flag: Mild Anemia [Edit]", "amber"),
            ("card", "Extracted: Platelets = 2.1 Lakh/uL", "Normal Range • Doctor Verified: [YES]", "emerald"),
            ("button", "Approve & Save Corrected Values", "", "teal"),
        ], "OCR Extracting | Fallback Manual | Approved"),
        ("D-08", "Consultation Notes", BLUE_600, "Clinical Rx", [
            ("input", "CLINICAL ASSESSMENT / DIAGNOSIS", "Acute Viral Febrile Illness + Mild Anemia", "blue"),
            ("input", "CARE PLAN & DIETARY ADVICE", "ORS hydration, warm fluids, iron-rich diet", "blue"),
            ("input", "FOLLOW-UP DATE", "Review in 5 days (11 Nov 2026)", "blue"),
            ("button", "Sign & Publish to Patient Records", "", "teal"),
        ], "Draft Saved | Published | Follow-up Set"),
        ("D-09", "Approve Medicine Schedule", BLUE_600, "Rx Reminders", [
            ("banner", "CREATES PATIENT REMINDER TIMELINE", "Only doctors can create/modify schedules", "blue"),
            ("card", "Paracetamol 500mg Tablet", "Morning & Night (After Meals) • 3 Days", "emerald"),
            ("card", "Ferrous Sulfate + Folic Acid", "Once Daily Afternoon • 14 Days", "teal"),
            ("button", "Approve & Push to Patient App", "", "teal"),
        ], "Publishing | Active on Patient | Completed"),
    ]

    cols = 3
    card_w = 486
    card_h = 390
    start_x = 36
    start_y = 108
    gap_x = 34
    gap_y = 26

    for idx, sc in enumerate(screens):
        r = idx // cols
        c = idx % cols
        x = start_x + c * (card_w + gap_x)
        y = start_y + r * (card_h + gap_y)
        draw_phone_card(draw, x, y, card_w, card_h, *sc)

    save_both_png_and_svg(img, "02_doctor_mobile_screens", "Doctor Portal Mobile Screens (D-01 to D-09)")


def build_patient_doctor_workflow():
    W, H = 1600, 920
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU — End-to-End Patient-to-Doctor Workflow & Appointment Lifecycle",
        "Complete journey from rural patient registration to consultation, OCR review, medicine reminders & follow-up",
        "WORKFLOW & STATE MACHINE"
    )

    f_lane = get_font(16, bold=True)
    f_step_b = get_font(14, bold=True)
    f_step = get_font(12, bold=False)
    f_badge = get_font(12, bold=True)

    # Three horizontal swimlanes
    lanes = [
        ("PATIENT PORTAL (Mobile PWA)", 110, 290, TEAL_50, TEAL_600),
        ("AAROGYASETU CORE API & SMS ENGINE", 310, 490, SLATE_100, SLATE_700),
        ("DOCTOR PORTAL (Clinician Workspace)", 510, 690, BLUE_50, BLUE_600),
    ]
    for title, y1, y2, bg, accent in lanes:
        draw.rounded_rectangle([30, y1, W - 30, y2], radius=12, fill=bg, outline=accent, width=2)
        draw.rounded_rectangle([30, y1, 270, y2], radius=12, fill=accent)
        lines = wrap_text(draw, title, f_lane, 210)
        cy = y1 + (y2 - y1 - len(lines) * 24) // 2
        for line in lines:
            draw.text((46, cy), line, font=f_lane, fill=WHITE)
            cy += 24

    # 5 Columns of workflow stages across the swimlanes
    cols_x = [295, 550, 805, 1060, 1315]
    box_w = 235

    p_steps = [
        ("1. Register & Consent", "Create profile, emergency contact & opt-in to SMS alerts"),
        ("2. Search & Book Slot", "Pick doctor & slot; status set to REQUESTED"),
        ("3. Compress & Chat", "Upload 38KB lab report & send low-data text message"),
        ("4. View Rx & Reminders", "Read clinical note & mark daily medicines Taken/Skipped"),
        ("5. QR Share / Follow-Up", "Share temporary QR token at clinic or book follow-up"),
    ]
    s_steps = [
        ("JWT Auth & RBAC", "Role-isolated tokens; stores SMS consent & phone"),
        ("Idempotent SMS Queue", "Queues Booking & Status SMS (zero PHI, dedupe_key)"),
        ("OCR & Media Service", "Stores private file; runs OCR table extraction"),
        ("Clinical Sync Engine", "Publishes signed note, Rx schedule & reply SMS"),
        ("Token Guard & Audit", "Verifies expiring QR token & logs clinician access"),
    ]
    d_steps = [
        ("1. Set Availability", "Configure specialty, languages & consultation slots"),
        ("2. Triage Appointment", "Confirm, Reschedule, or Cancel booking request"),
        ("3. Review Report & Chat", "Inspect image + verify/edit OCR values; reply in chat"),
        ("4. Sign Note & Schedule", "Write diagnosis note & approve medicine schedule"),
        ("5. Track Adherence", "Review dose completion & close/follow-up visit"),
    ]

    for i in range(5):
        cx = cols_x[i]
        # Patient box
        draw.rounded_rectangle([cx, 128, cx + box_w, 272], radius=10, fill=WHITE, outline=TEAL_600, width=2)
        draw.text((cx + 12, 138), p_steps[i][0], font=f_step_b, fill=TEAL_800)
        draw_multiline(draw, cx + 12, 164, p_steps[i][1], f_step, SLATE_700, box_w - 24)

        # System box
        draw.rounded_rectangle([cx, 328, cx + box_w, 472], radius=10, fill=WHITE, outline=SLATE_600, width=2)
        draw.text((cx + 12, 338), s_steps[i][0], font=f_step_b, fill=SLATE_900)
        draw_multiline(draw, cx + 12, 364, s_steps[i][1], f_step, SLATE_700, box_w - 24)

        # Doctor box
        draw.rounded_rectangle([cx, 528, cx + box_w, 672], radius=10, fill=WHITE, outline=BLUE_600, width=2)
        draw.text((cx + 12, 538), d_steps[i][0], font=f_step_b, fill=BLUE_700)
        draw_multiline(draw, cx + 12, 564, d_steps[i][1], f_step, SLATE_700, box_w - 24)

        # Vertical arrows between Patient <-> System <-> Doctor
        mid_x = cx + box_w // 2
        draw_arrow(draw, mid_x - 10, 272, mid_x - 10, 326, TEAL_600, 2, 8)
        draw_arrow(draw, mid_x + 10, 326, mid_x + 10, 272, SLATE_600, 2, 8)
        draw_arrow(draw, mid_x - 10, 472, mid_x - 10, 526, BLUE_600, 2, 8)
        draw_arrow(draw, mid_x + 10, 526, mid_x + 10, 472, SLATE_600, 2, 8)

        # Horizontal arrows to next stage
        if i < 4:
            draw_arrow(draw, cx + box_w, 200, cols_x[i + 1], 200, TEAL_600, 2, 8)
            draw_arrow(draw, cx + box_w, 600, cols_x[i + 1], 600, BLUE_600, 2, 8)

    # Bottom Panel: Appointment Status Lifecycle Diagram
    draw.rounded_rectangle([30, 715, W - 30, 895], radius=12, fill=WHITE, outline=SLATE_300, width=2)
    draw.text((52, 728), "Appointment Status State Machine & SMS Notification Triggers", font=f_lane, fill=SLATE_900)

    states = [
        ("REQUESTED", "Patient books slot\n[SMS: Booking Recv]", AMBER_100, AMBER_800, AMBER_500, 60),
        ("CONFIRMED", "Doctor approves slot\n[SMS: Confirmed + 24h]", EMERALD_100, EMERALD_700, EMERALD_600, 360),
        ("RESCHEDULED", "New time proposed\n[SMS: New Slot Alert]", BLUE_100, BLUE_700, BLUE_600, 660),
        ("COMPLETED", "Notes & Rx published\n[SMS: Summary Ready]", TEAL_100, TEAL_900, TEAL_600, 960),
        ("CANCELLED", "Patient/Doc cancels\n[SMS: Cancellation]", ROSE_100, ROSE_700, ROSE_600, 1260),
    ]
    for st, desc, bg, fg, bd, sx in states:
        draw.rounded_rectangle([sx, 770, sx + 240, 872], radius=10, fill=bg, outline=bd, width=2)
        draw.text((sx + 16, 780), st, font=f_step_b, fill=fg)
        for j, ln in enumerate(desc.split("\n")):
            draw.text((sx + 16, 808 + j * 20), ln, font=f_step, fill=SLATE_800)

    draw_arrow(draw, 300, 820, 358, 820, EMERALD_600, 3, 9)
    draw_arrow(draw, 600, 820, 658, 820, BLUE_600, 3, 9)
    draw_arrow(draw, 900, 820, 958, 820, TEAL_600, 3, 9)
    draw_arrow(draw, 1200, 820, 1258, 820, ROSE_600, 2, 8)

    save_both_png_and_svg(img, "03_patient_doctor_workflow", "Patient-to-Doctor Workflow & Appointment Lifecycle")


def build_system_architecture():
    W, H = 1600, 940
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU — System Architecture & Data Flow Blueprint",
        "Installable React + TypeScript PWA, Python FastAPI Backend, SQLite/PostgreSQL & Pluggable Safe Services",
        "TECHNICAL ARCHITECTURE"
    )

    f_col = get_font(16, bold=True)
    f_box_b = get_font(14, bold=True)
    f_box = get_font(12, bold=False)

    # 4 Architectural Tiers (Columns)
    tiers = [
        ("1. CLIENT TIER\n(Installable Mobile PWA)", 36, 396, TEAL_50, TEAL_600),
        ("2. API & SECURITY TIER\n(Python FastAPI Backend)", 436, 796, BLUE_50, BLUE_600),
        ("3. PERSISTENCE TIER\n(Database & File Store)", 836, 1176, SLATE_100, SLATE_700),
        ("4. OPTIONAL SERVICES\n(With Demo Fallbacks)", 1216, 1564, AMBER_50, AMBER_600),
    ]
    for title, x1, x2, bg, bd in tiers:
        draw.rounded_rectangle([x1, 112, x2, 896], radius=14, fill=bg, outline=bd, width=2)
        draw.rounded_rectangle([x1, 112, x2, 178], radius=14, fill=bd)
        for idx, ln in enumerate(title.split("\n")):
            draw.text((x1 + 18, 120 + idx * 24), ln, font=f_col, fill=WHITE)

    def draw_mod(x1, x2, y, h, title, bullets, bd):
        draw.rounded_rectangle([x1 + 16, y, x2 - 16, y + h], radius=10, fill=WHITE, outline=bd, width=2)
        draw.text((x1 + 28, y + 10), title, font=f_box_b, fill=SLATE_900)
        cy = y + 36
        for b in bullets:
            cy = draw_multiline(draw, x1 + 28, cy, "• " + b, f_box, SLATE_700, (x2 - x1) - 56, line_gap=2) + 4

    # Tier 1 boxes
    draw_mod(36, 396, 198, 155, "React 18 + TypeScript + Vite UI", [
        "Separate Patient (11) & Doctor (9) views",
        "Teal/Slate accessible cards, zero heavy video",
        "Live Data-Saved KB counter & 2G toggle",
    ], TEAL_600)
    draw_mod(36, 396, 370, 160, "PWA Service Worker & Manifest", [
        "manifest.json for Android/Desktop install",
        "Caches <85 KB App Shell & static assets",
        "Offline banner + Demo Offline Toggle",
    ], TEAL_600)
    draw_mod(36, 396, 548, 160, "Client Image Compressor", [
        "HTML5 Canvas resize (max 1200px) + JPEG/WebP",
        "Shrinks 3 MB photos to ~35-50 KB before POST",
        "Shows Original KB vs Compressed KB badge",
    ], TEAL_600)
    draw_mod(36, 396, 725, 150, "Local Outbox & Sync State Engine", [
        "Tracks Saved -> Pending -> Synced / Failed",
        "One-tap Retry for failed messages & uploads",
    ], TEAL_600)

    # Tier 2 boxes
    draw_mod(436, 796, 198, 155, "Auth & Consultation-Scoped RBAC", [
        "JWT Bearer tokens (`patient` vs `doctor`)",
        "Patients read/write ONLY own records",
        "Doctors restricted to assigned consultations",
    ], BLUE_600)
    draw_mod(436, 796, 370, 160, "Core Telemedicine REST Routers", [
        "/api/auth, /api/patients, /api/doctors",
        "/api/appointments, /api/messages, /api/notes",
        "/api/reports, /api/reminders, /api/qr, /api/sos",
    ], BLUE_600)
    draw_mod(436, 796, 548, 160, "Appointment Updates SMS Engine", [
        "Hooks into booking/confirm/reschedule/cancel",
        "Enforces sms_consent=True & zero PHI rule",
        "Idempotent dedupe_key prevents duplicate SMS",
    ], BLUE_600)
    draw_mod(436, 796, 725, 150, "QR Token & Safety Guardrails", [
        "Generates short-lived signed QR share tokens",
        "Enforces non-diagnostic AI & OCR review flags",
    ], BLUE_600)

    # Tier 3 boxes
    draw_mod(836, 1176, 198, 220, "Relational DB (SQLite -> Postgres)", [
        "Local demo: `aarogyasetu.db` (SQLite WAL)",
        "Production path: PostgreSQL via SQLAlchemy",
        "Tables: users, patient_profiles, doctor_profiles",
        "appointments, messages, medical_reports",
        "consultation_notes, medicine_schedules",
        "sms_notifications, qr_share_tokens",
    ], SLATE_700)
    draw_mod(836, 1176, 440, 210, "Private Local File Storage", [
        "`backend/storage/reports/` (Outside public web)",
        "Files served ONLY via authenticated API check",
        "Stores compressed image + SHA-256 checksum",
        "Upgrade path to S3/GCS signed object storage",
    ], SLATE_700)
    draw_mod(836, 1176, 670, 205, "Seed & Demo Fixture Loader", [
        "Pre-populates fictional rural patients & doctors",
        "Includes sample CBC report, schedule & SMS log",
        "100% synthetic data for safe hackathon demos",
    ], SLATE_700)

    # Tier 4 boxes
    draw_mod(1216, 1564, 198, 215, "SMS Gateway (Twilio / Demo Log)", [
        "Live: Twilio REST API via env credentials",
        "Fallback: Local Demo SMS Log (`mode='demo'`)",
        "Never blocks appointment transaction on failure",
    ], AMBER_600)
    draw_mod(1216, 1564, 435, 215, "Smart OCR Engine (Tesseract / Safe)", [
        "Extracts test dates, labels, values & units",
        "Always tagged `machine_extracted = True`",
        "Fallback: Manual doctor table entry when offline",
    ], AMBER_600)
    draw_mod(1216, 1564, 670, 205, "AI Health Guide (LLM / Curated KB)", [
        "Explains medical terms & when to visit clinic",
        "System prompt blocks diagnosis & prescriptions",
        "Fallback: Deterministic bilingual health guide",
    ], AMBER_600)

    # Arrows connecting tiers
    for ay in [275, 450, 625, 795]:
        draw_arrow(draw, 396, ay, 434, ay, TEAL_600, 3, 9)
        draw_arrow(draw, 434, ay - 12, 396, ay - 12, BLUE_600, 2, 7)

    for ay in [300, 540, 760]:
        draw_arrow(draw, 796, ay, 834, ay, BLUE_600, 3, 9)
        draw_arrow(draw, 1176, ay, 1214, ay, AMBER_600, 3, 9)

    save_both_png_and_svg(img, "04_system_architecture_and_dataflow", "System Architecture and Data Flow Diagram")


def build_sms_notification_flow():
    W, H = 1600, 880
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU — Appointment Updates Module (SMS Notification & Idempotency Flow)",
        "Consent-gated, privacy-preserving SMS alerts with same-transaction persistence & Demo Log fallback",
        "SMS ARCHITECTURE FLOW"
    )

    f_h = get_font(15, bold=True)
    f_b = get_font(12, bold=False)
    f_bb = get_font(12, bold=True)

    steps = [
        ("1. Lifecycle Trigger Events", 40, 130, 320, 420, TEAL_50, TEAL_600, [
            "• Appointment Requested (Patient books)",
            "• Appointment Confirmed (Doctor accepts)",
            "• Appointment Rescheduled (New slot)",
            "• Appointment Cancelled (Either role)",
            "• Doctor Reply Sent in Consultation",
            "• Scheduled Reminder (24h / 2h prior)",
        ]),
        ("2. Consent & Privacy Gate", 410, 130, 330, 420, BLUE_50, BLUE_600, [
            "• Check `patient.sms_consent == True`",
            "• Validate E.164 / 10-digit mobile number",
            "• If consent is False -> Skip & log reason",
            "• PRIVACY RULE: Strip all symptoms, lab values, diagnoses & medication names",
            "• Include ONLY date, time, doctor name & appointment reference code",
        ]),
        ("3. Idempotency & DB Commit", 790, 130, 350, 420, PURPLE_50, PURPLE_700, [
            "• Compute deterministic `dedupe_key`:",
            "  `sha256(appt_id + event_type + slot_iso)`",
            "• Check `sms_notifications` table for key",
            "• If key exists -> No duplicate SMS sent",
            "• Insert `status = 'queued'` in SAME DB transaction as appointment update",
        ]),
        ("4. Non-Blocking Dispatch", 1190, 130, 370, 420, EMERALD_50, EMERALD_600, [
            "• Check SMS Provider Configuration:",
            "• Mode A (Twilio Configured): POST to Twilio REST API -> status = `sent`",
            "• Mode B (No API Key / Demo Mode): Record in Demo SMS Outbox (`mode = 'demo_log'`)",
            "• On network error: mark `failed` with retry counter; NEVER crash appointment API",
        ]),
    ]

    for title, x, y, w, h, bg, bd, items in steps:
        draw.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=bg, outline=bd, width=2)
        draw.rounded_rectangle([x, y, x + w, y + 48], radius=12, fill=bd)
        draw.text((x + 16, y + 12), title, font=f_h, fill=WHITE)
        cy = y + 66
        for it in items:
            cy = draw_multiline(draw, x + 16, cy, it, f_b, SLATE_800, w - 32, line_gap=4) + 12

    draw_arrow(draw, 360, 340, 408, 340, TEAL_600, 3, 10)
    draw_arrow(draw, 740, 340, 788, 340, BLUE_600, 3, 10)
    draw_arrow(draw, 1140, 340, 1188, 340, PURPLE_700, 3, 10)

    # Bottom comparison panel: Compliant vs Non-Compliant SMS examples
    draw.rounded_rectangle([40, 585, 775, 840], radius=12, fill=EMERALD_50, outline=EMERALD_600, width=2)
    draw.text((64, 602), "[SAFE] PRIVACY-COMPLIANT SMS TEMPLATES (ZERO PHI)", font=f_h, fill=EMERALD_700)
    safe_examples = [
        "[CONFIRMED] AAROGYASETU: Your appointment #APT-104 with Dr. Priya Sharma is confirmed for 06 Nov at 10:30 AM. Open app for details.",
        "[RESCHEDULED] AAROGYASETU: Appointment #APT-104 has been updated to 07 Nov at 11:00 AM. Reply or view in app.",
        "[DOCTOR UPDATE] AAROGYASETU: You have a new consultation update for #APT-104. Sign in to view securely.",
    ]
    cy = 640
    for ex in safe_examples:
        cy = draw_multiline(draw, 64, cy, ex, f_bb, SLATE_800, 685, line_gap=3) + 12

    draw.rounded_rectangle([815, 585, 1560, 840], radius=12, fill=ROSE_50, outline=ROSE_600, width=2)
    draw.text((839, 602), "[PROHIBITED] SMS CONTENT NEVER SENT OVER SMS", font=f_h, fill=ROSE_700)
    bad_examples = [
        "[NO] NEVER include patient symptoms or chief complaints (e.g., 'fever, HIV test, pregnancy')",
        "[NO] NEVER include OCR lab report values or clinical diagnoses (e.g., 'Hemoglobin 10.8 Anemia')",
        "[NO] NEVER include prescribed medication names or raw medical record links without auth",
        "[NO] NEVER claim live carrier delivery when running in local Hackathon Demo Log mode",
    ]
    cy = 645
    for ex in bad_examples:
        cy = draw_multiline(draw, 839, cy, ex, f_bb, ROSE_700, 700, line_gap=3) + 14

    save_both_png_and_svg(img, "05_appointment_sms_notification_flow", "Appointment SMS Notification and Idempotency Flow")


def build_low_bandwidth_pwa_diagram():
    W, H = 1600, 880
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU — Low-Bandwidth Engineering & Installable PWA Behavior",
        "Designed for 2G / Intermittent Village Networks: App-Shell Caching, Client Compression & Explicit Sync States",
        "2G & OFFLINE RESILIENCE"
    )

    f_h = get_font(16, bold=True)
    f_b = get_font(13, bold=False)
    f_bb = get_font(13, bold=True)

    # 3 Top Pillars
    pillars = [
        ("1. Installable PWA & App Shell", 40, 125, 480, 360, TEAL_600, [
            ("Web App Manifest (`manifest.json`)", "Enables 'Add to Home Screen' on Android & Desktop browsers with standalone display mode."),
            ("Service Worker Cache-First Shell", "Pre-caches HTML, CSS, JS & SVG icons (< 85 KB total gzipped) so app opens instantly offline."),
            ("Stale-While-Revalidate Data", "Displays last synced appointments, medical records, medicine schedule & emergency contacts offline."),
        ]),
        ("2. Client-Side Image Compression", 560, 125, 480, 360, BLUE_600, [
            ("1. Raw Phone Camera Capture", "Typical rural smartphone photo is 3.0 MB – 5.0 MB (times out on 2G uplink)."),
            ("2. In-Browser HTML5 Canvas Pipeline", "Downscales longest edge to max 1200px, applies grayscale/contrast boost for lab text, encodes JPEG/WebP (q=0.72)."),
            ("3. 98% Bandwidth Reduction", "Uploads ~38 KB payload with progress bar & displays exact 'Data Saved: 3,162 KB' telemetry."),
        ]),
        ("3. Honest Connectivity & Offline Toggle", 1080, 125, 480, 360, AMBER_600, [
            ("Live Network Detection + Demo Toggle", "Listens to `navigator.onLine` plus a clearly labeled 'Simulate Offline (Demo)' header switch."),
            ("Persistent Amber Offline Banner", "Clearly informs user when viewing cached data and queuing new messages/actions locally."),
            ("Zero Fake Compression / Zero Video", "Avoids high-bandwidth WebRTC video calls; all compression & byte counters measure real blobs."),
        ]),
    ]

    for title, x, y, w, h, bd, blocks in pillars:
        draw.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=WHITE, outline=bd, width=2)
        draw.rounded_rectangle([x, y, x + w, y + 48], radius=12, fill=bd)
        draw.text((x + 18, y + 12), title, font=f_h, fill=WHITE)
        cy = y + 64
        for subtitle, text in blocks:
            draw.text((x + 18, cy), subtitle, font=f_bb, fill=SLATE_900)
            cy += 22
            cy = draw_multiline(draw, x + 18, cy, text, f_b, SLATE_600, w - 36, line_gap=3) + 12

    # Bottom Section: Explicit Record & Message Sync State Machine
    draw.rounded_rectangle([40, 515, 1560, 845], radius=14, fill=WHITE, outline=SLATE_300, width=2)
    draw.text((64, 534), "Explicit User-Visible Sync State Lifecycle (Messages, Bookings, Adherence Logs & Uploads)", font=f_h, fill=SLATE_900)

    sync_states = [
        ("1. SAVED LOCALLY", "Stored in browser storage\nwhen offline or composing", SLATE_100, SLATE_800, SLATE_500, 70),
        ("2. PENDING UPLOAD", "Network request in flight\nwith byte progress indicator", AMBER_100, AMBER_800, AMBER_500, 440),
        ("3. SYNCED (CONFIRMED)", "Server persisted record &\nreturned database ID + timestamp", EMERALD_100, EMERALD_700, EMERALD_600, 810),
        ("4. FAILED (TAP RETRY)", "Timeout or 5xx error; keeps\ndraft intact with 1-tap Retry", ROSE_100, ROSE_700, ROSE_600, 1180),
    ]
    for title, desc, bg, fg, bd, sx in sync_states:
        draw.rounded_rectangle([sx, 588, sx + 310, 725], radius=12, fill=bg, outline=bd, width=2)
        draw.text((sx + 18, 602), title, font=f_bb, fill=fg)
        for j, ln in enumerate(desc.split("\n")):
            draw.text((sx + 18, 636 + j * 22), ln, font=f_b, fill=SLATE_700)

    draw_arrow(draw, 380, 655, 438, 655, AMBER_600, 3, 10)
    draw_arrow(draw, 750, 655, 808, 655, EMERALD_600, 3, 10)
    # Timeout / failure path routed cleanly above/below without crossing box 3
    draw.line([(650, 725), (650, 755), (1260, 755), (1260, 726)], fill=ROSE_600, width=2)
    draw_arrow(draw, 1260, 745, 1260, 726, ROSE_600, 2, 8)
    draw.text((810, 734), "Network Timeout / 5xx Drop -> Marks Failed", font=f_b, fill=ROSE_700)

    # Retry loop line
    draw.line([(1395, 725), (1395, 812), (550, 812), (550, 726)], fill=TEAL_600, width=3)
    draw_arrow(draw, 550, 745, 550, 726, TEAL_600, 3, 9)
    draw.text((640, 786), "User Taps 'Retry Now' or Network Reconnects -> Re-submits with Idempotency Key", font=f_bb, fill=TEAL_800)

    save_both_png_and_svg(img, "06_low_bandwidth_pwa_behavior", "Low-Bandwidth and Installable PWA Behavior Illustration")


def build_feature_overview_diagram():
    W, H = 1600, 920
    img = Image.new("RGB", (W, H), SLATE_50)
    draw = ImageDraw.Draw(img)
    draw_banner_header(
        draw, W,
        "AAROGYASETU (आरोग्यसेतु) — 8-Module Feature Overview & Safety Ecosystem",
        "Comprehensive functional map uniting Patient & Doctor capabilities with strict clinical & privacy guardrails",
        "FEATURE OVERVIEW MAP"
    )

    f_center = get_font(20, bold=True)
    f_sub = get_font(13, bold=True)
    f_card_t = get_font(15, bold=True)
    f_card_b = get_font(12, bold=False)

    # Central Hub
    cx, cy = 800, 495
    draw.rounded_rectangle([cx - 190, cy - 95, cx + 190, cy + 95], radius=24, fill=SLATE_900, outline=TEAL_500, width=4)
    draw.text((cx - 155, cy - 68), "AAROGYASETU", font=f_center, fill=TEAL_500)
    draw.text((cx - 155, cy - 38), "आरोग्यसेतु • Rural Telemedicine", font=f_sub, fill=WHITE)
    draw.text((cx - 155, cy - 10), "“Healthcare Beyond Boundaries”", font=f_card_b, fill=TEAL_100)
    draw.text((cx - 155, cy + 20), "• Role-Separated Patient & Doctor PWA", font=f_card_b, fill=SLATE_300)
    draw.text((cx - 155, cy + 44), "• Works on 2G + Offline App Shell", font=f_card_b, fill=SLATE_300)

    features = [
        ("1. Appointment Lifecycle", 50, 125, 420, 210, TEAL_600, [
            "• Search doctors by specialty & language",
            "• Book, Confirm, Reschedule & Cancel slots",
            "• Full status audit trail for both roles",
            "• Follow-up scheduling after consultation",
        ]),
        ("2. Appointment Updates (SMS)", 590, 125, 420, 210, BLUE_600, [
            "• Explicit patient SMS consent toggle",
            "• Alerts for booking, confirm, reschedule, cancel",
            "• Zero medical/PHI details inside SMS body",
            "• Twilio live gateway + Demo SMS Log fallback",
        ]),
        ("3. Smart OCR Report Reader", 1130, 125, 420, 210, PURPLE_700, [
            "• Client-side image compression before upload",
            "• Extracts test dates, labels, values & units",
            "• Marked 'Machine-Read — Requires Doctor Review'",
            "• Doctor side-by-side edit & approval workflow",
        ]),
        ("4. Low-Bandwidth Messaging", 50, 390, 420, 210, EMERALD_600, [
            "• Consultation-scoped text messaging",
            "• States: Saved, Pending, Synced, Failed+Retry",
            "• Live Data-Saved KB counter & 2G Saver mode",
            "• Demo-labeled Offline Simulator toggle",
        ]),
        ("5. AI Health Assistant", 1130, 390, 420, 210, AMBER_600, [
            "• Explains medical terms & lab concepts simply",
            "• Guides when to seek in-person clinical care",
            "• NEVER diagnoses disease or prescribes drugs",
            "• Red-flag symptom detector points to SOS/PHC",
        ]),
        ("6. Doctor Medicine Reminders", 50, 655, 420, 210, TEAL_700, [
            "• Created & approved ONLY by licensed doctors",
            "• Dose timing (Morning/Afternoon/Night + meals)",
            "• Patient marks Taken or Skipped with notes",
            "• Adherence history visible to doctor on follow-up",
        ]),
        ("7. Tokenized QR Medical Profile", 590, 655, 420, 210, BLUE_700, [
            "• Patient selects fields & grants explicit consent",
            "• QR encodes temporary token (NO raw PHI in QR)",
            "• Automatic expiration (e.g. 24h) + 1-tap Revoke",
            "• Doctor scans/enters token for rapid intake",
        ]),
        ("8. Emergency SOS & Triage", 1130, 655, 420, 210, ROSE_600, [
            "• Configurable 1-tap dialer (108 / local ambulance)",
            "• Saved family emergency contact quick-call",
            "• GPS location permission + manual village entry",
            "• Nearby clinics list; NO automatic dispatch",
        ]),
    ]

    for title, x, y, w, h, bd, items in features:
        # Connector line to center hub
        fx = x + w // 2
        fy = y + h // 2
        draw.line([(fx, fy), (cx, cy)], fill=SLATE_300, width=3)

    # Re-draw hub on top of lines
    draw.rounded_rectangle([cx - 190, cy - 95, cx + 190, cy + 95], radius=24, fill=SLATE_900, outline=TEAL_500, width=4)
    draw.text((cx - 155, cy - 68), "AAROGYASETU", font=f_center, fill=TEAL_500)
    draw.text((cx - 155, cy - 38), "आरोग्यसेतु • Rural Telemedicine", font=f_sub, fill=WHITE)
    draw.text((cx - 155, cy - 10), "“Healthcare Beyond Boundaries”", font=f_card_b, fill=TEAL_100)
    draw.text((cx - 155, cy + 20), "• Role-Separated Patient & Doctor PWA", font=f_card_b, fill=SLATE_300)
    draw.text((cx - 155, cy + 44), "• Works on 2G + Offline App Shell", font=f_card_b, fill=SLATE_300)

    for title, x, y, w, h, bd, items in features:
        draw.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=WHITE, outline=bd, width=2)
        draw.rounded_rectangle([x, y, x + w, y + 42], radius=12, fill=bd)
        draw.text((x + 16, y + 10), title, font=f_card_t, fill=WHITE)
        iy = y + 54
        for it in items:
            iy = draw_multiline(draw, x + 16, iy, it, f_card_b, SLATE_800, w - 32, line_gap=2) + 8

    save_both_png_and_svg(img, "07_feature_overview_diagram", "AAROGYASETU 8-Module Feature Overview Diagram")


if __name__ == "__main__":
    print("Generating AAROGYASETU blueprint visual assets...")
    build_patient_screens_part1()
    build_patient_screens_part2()
    build_doctor_screens()
    build_patient_doctor_workflow()
    build_system_architecture()
    build_sms_notification_flow()
    build_low_bandwidth_pwa_diagram()
    build_feature_overview_diagram()
    print("All 8 visual boards (PNG + SVG) generated successfully!")
