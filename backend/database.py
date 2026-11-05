"""
SQLite Database Models & Complete Fictional Demo Seed Data for AAROGYASETU (आरोग्यसेतु).
Full Blueprint Implementation:
  1. users (patient, doctor, examiner roles)
  2. patient_profiles (demographics, allergies, conditions, landmark, blood group, sms_consent)
  3. doctor_profiles (qualifications, registration, specialty, availability slots, languages)
  4. appointments (lifecycle: requested -> confirmed / rescheduled / cancelled / completed)
  5. consultations (active/closed consultation rooms)
  6. messages (online text chat with sync state)
  7. reports (private medical report storage, browser canvas compression stats, machine-read OCR table & doctor review)
  8. consultation_notes (doctor clinical assessment, care advice, red-flag warnings, follow-up date)
  9. medicine_schedules (doctor-approved prescriptions: medicine, dose, slots, meal instructions)
  10. adherence_logs (patient dose logs: taken / skipped with adherence tracking)
  11. sms_notifications (consent-gated zero-PHI SMS log / Twilio dispatch)
  12. qr_share_tokens (temporary revocable tokenized medical sharing)
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator

from PIL import Image, ImageDraw, ImageFont

from .auth import hash_password
from .config import DB_PATH, PRIVATE_REPORTS_DIR


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'examiner', 'admin')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    date_of_birth TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    village_or_address TEXT NOT NULL DEFAULT '',
    blood_group TEXT NOT NULL DEFAULT '',
    allergies TEXT NOT NULL DEFAULT '',
    chronic_conditions TEXT NOT NULL DEFAULT '',
    emergency_contact_name TEXT NOT NULL DEFAULT '',
    emergency_contact_phone TEXT NOT NULL DEFAULT '',
    manual_location_landmark TEXT NOT NULL DEFAULT '',
    sms_consent INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL DEFAULT '',
    specialty TEXT NOT NULL DEFAULT 'General Medicine',
    qualifications TEXT NOT NULL DEFAULT 'MBBS',
    clinic_name TEXT NOT NULL DEFAULT '',
    clinic_location TEXT NOT NULL DEFAULT '',
    languages_spoken TEXT NOT NULL DEFAULT 'English, Hindi, Kannada',
    bio TEXT NOT NULL DEFAULT '',
    availability_json TEXT NOT NULL DEFAULT '[]',
    is_accepting INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_code TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    clinical_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_code TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'rescheduled', 'cancelled', 'completed')),
    chief_complaint TEXT NOT NULL DEFAULT '',
    status_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'doctor')),
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    client_message_id TEXT,
    delivery_state TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_id
    ON messages(consultation_id, sender_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_consultation ON messages(consultation_id, id);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    original_size_bytes INTEGER NOT NULL,
    uploaded_size_bytes INTEGER NOT NULL,
    was_compressed INTEGER NOT NULL DEFAULT 0,
    ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'extracted', 'failed', 'not_applicable')),
    extracted_fields_json TEXT NOT NULL DEFAULT '[]',
    doctor_reviewed INTEGER NOT NULL DEFAULT 0,
    doctor_corrected_fields_json TEXT NOT NULL DEFAULT '[]',
    doctor_review_note TEXT NOT NULL DEFAULT '',
    upload_status TEXT NOT NULL DEFAULT 'stored',
    uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_consultation ON reports(consultation_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);

CREATE TABLE IF NOT EXISTS consultation_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment TEXT NOT NULL,
    care_advice TEXT NOT NULL DEFAULT '',
    red_flag_warnings TEXT NOT NULL DEFAULT '',
    follow_up_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_consultation ON consultation_notes(consultation_id);
CREATE INDEX IF NOT EXISTS idx_notes_patient ON consultation_notes(patient_id);

CREATE TABLE IF NOT EXISTS medicine_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage_strength TEXT NOT NULL,
    schedule_times_json TEXT NOT NULL DEFAULT '["Morning", "Night"]',
    meal_instruction TEXT NOT NULL DEFAULT 'After meals',
    duration_days INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued')),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_patient ON medicine_schedules(patient_id);

CREATE TABLE IF NOT EXISTS adherence_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES medicine_schedules(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dose_date TEXT NOT NULL,
    dose_slot TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('taken', 'skipped')),
    note TEXT NOT NULL DEFAULT '',
    logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adherence_patient ON adherence_logs(patient_id, dose_date);

CREATE TABLE IF NOT EXISTS sms_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message_body TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    delivery_mode TEXT NOT NULL DEFAULT 'demo_log' CHECK (delivery_mode IN ('live_twilio', 'demo_log')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'failed')),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_patient ON sms_notifications(patient_id);

CREATE TABLE IF NOT EXISTS qr_share_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    shared_scopes_json TEXT NOT NULL DEFAULT '["demographics", "emergency_contact"]',
    consent_confirmed INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_token ON qr_share_tokens(token);
"""


def _generate_sample_report_image(target_path: Path) -> int:
    """Generates a realistic fictional medical report image in private storage for the seeded consultation."""
    PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (820, 560), "#ffffff")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # Header bar (Navy Blue)
    draw.rectangle([0, 0, 820, 72], fill="#0b1f3a")
    draw.text((24, 18), "GRAMIN DIAGNOSTIC LAB — FICTIONAL DEMO REPORT", fill="#ffffff", font=font)
    draw.text((24, 40), "AAROGYASETU (Healthcare Beyond Boundaries) — Sample Compressed Upload", fill="#cbd5e1", font=font)

    # Patient & Doctor details box
    draw.rectangle([24, 90, 796, 175], outline="#cbd5e1", width=2, fill="#f8fafc")
    draw.text((40, 104), "Patient Name : Ramesh Kumar (46 Yrs / Male)      Date : 2026-11-05", fill="#0f172a", font=font)
    draw.text((40, 126), "Village      : Ward 4, Belthangady, Dakshina Kannada", fill="#334155", font=font)
    draw.text((40, 148), "Referred By  : Dr. Priya Sharma (Karavali Rural Tele-Health Centre)", fill="#0b1f3a", font=font)

    # Table header
    draw.rectangle([24, 195, 796, 230], fill="#1e3a8a")
    draw.text((40, 207), "PARAMETER                          RESULT          UNIT          REFERENCE INTERVAL", fill="#ffffff", font=font)

    rows = [
        ("Hemoglobin (Hb)", "12.8", "g/dL", "13.0 - 17.0"),
        ("Total Leukocyte Count (WBC)", "9,800", "/cumm", "4,000 - 11,000"),
        ("Platelet Count", "2.35", "Lakh/uL", "1.50 - 4.50"),
        ("Fasting Blood Sugar (FBS)", "98", "mg/dL", "70 - 110"),
        ("C-Reactive Protein (CRP)", "6.4 (Mild)", "mg/L", "< 5.0"),
    ]
    y = 242
    for param, res, unit, ref in rows:
        draw.rectangle([24, y, 796, y + 36], outline="#e2e8f0", width=1, fill="#ffffff")
        line = f"{param:<34} {res:<15} {unit:<13} {ref}"
        draw.text((40, y + 11), line, fill="#0f172a", font=font)
        y += 40

    draw.rectangle([24, 465, 796, 530], outline="#94a3b8", width=1, fill="#f1f5f9")
    draw.text(
        (40, 480),
        "NOTE: FICTIONAL PROTOTYPE DATA ONLY. Not a real clinical diagnostic document.",
        fill="#475569",
        font=font,
    )
    draw.text(
        (40, 502),
        "Compressed in browser via HTML5 Canvas before upload for low-bandwidth rural connectivity.",
        fill="#1e3a8a",
        font=font,
    )

    img.save(str(target_path), format="JPEG", quality=72, optimize=True)
    return target_path.stat().st_size


def init_db() -> None:
    """Initializes SQLite tables and seeds fictional demo accounts, consultations, notes, reminders, and reports."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(SCHEMA_SQL)

    cur = conn.cursor()

    # Check if primary demo doctor exists; if so, skip full seeding
    cur.execute("SELECT id FROM users WHERE phone = '9123456780'")
    if cur.fetchone():
        conn.close()
        return

    now = utc_now_iso()
    tomorrow_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

    # 1. Seed Primary Demo Doctor (Dr. Priya Sharma)
    doc_availability = ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('doctor', ?, ?, ?, ?, 'approved', 1, ?)
        """,
        (
            "Dr. Priya Sharma",
            "9123456780",
            "dr.priya@aarogyasetu.local",
            hash_password("doctor123"),
            now,
        ),
    )
    doctor_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO doctor_profiles (
            user_id, registration_number, specialty, qualifications, clinic_name,
            clinic_location, languages_spoken, bio, availability_json, is_accepting, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            doctor_id,
            "KMC-74892",
            "General Medicine & Rural Primary Care",
            "MBBS, MD (General Medicine)",
            "Karavali Rural Tele-Health Centre",
            "Mangaluru, Dakshina Kannada, Karnataka",
            "English, Hindi, Kannada, Tulu",
            "9+ years clinical experience supporting rural Primary Health Centres (PHCs) with low-bandwidth tele-consultations.",
            json.dumps(doc_availability),
            now,
        ),
    )

    # 2. Seed Secondary Demo Doctor (Dr. Vikram Rao)
    other_availability = ["09:30 AM", "11:00 AM", "03:00 PM"]
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('doctor', ?, ?, ?, ?, 'approved', 1, ?)
        """,
        (
            "Dr. Vikram Rao",
            "9123456799",
            "dr.vikram@aarogyasetu.local",
            hash_password("doctor123"),
            now,
        ),
    )
    other_doctor_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO doctor_profiles (
            user_id, registration_number, specialty, qualifications, clinic_name,
            clinic_location, languages_spoken, bio, availability_json, is_accepting, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            other_doctor_id,
            "KMC-81230",
            "Pediatrics & Family Care",
            "MBBS, DCH (Pediatrics)",
            "Udupi Community Health Centre",
            "Udupi District, Karnataka",
            "English, Kannada, Hindi",
            "Rural pediatrician specializing in child nutrition and seasonal preventative care.",
            json.dumps(other_availability),
            now,
        ),
    )

    # 3. Seed Primary Fictional Demo Patient (Ramesh Kumar)
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('patient', ?, ?, ?, ?, 'approved', 1, ?)
        """,
        (
            "Ramesh Kumar",
            "9876543210",
            "ramesh.demo@aarogyasetu.local",
            hash_password("patient123"),
            now,
        ),
    )
    patient_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO patient_profiles (
            user_id, age, date_of_birth, gender, village_or_address, blood_group,
            allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone,
            manual_location_landmark, sms_consent, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            patient_id,
            46,
            "1980-04-12",
            "Male",
            "Ward 4, Belthangady Village, Dakshina Kannada, Karnataka",
            "O+",
            "Penicillin (mild rash)",
            "Mild Hypertension",
            "Sita Devi (Wife)",
            "9876500001",
            "Near Belthangady Gram Panchayat Office",
            now,
        ),
    )

    # 4. Seed Secondary Fictional Patient (Sunita Devi — assigned to Dr. Vikram Rao)
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('patient', ?, ?, ?, ?, 'approved', 1, ?)
        """,
        (
            "Sunita Devi",
            "9876543299",
            "sunita.demo@aarogyasetu.local",
            hash_password("patient123"),
            now,
        ),
    )
    other_patient_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO patient_profiles (
            user_id, age, date_of_birth, gender, village_or_address, blood_group,
            allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone,
            manual_location_landmark, sms_consent, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            other_patient_id,
            34,
            "1992-08-19",
            "Female",
            "Karkala Town, Udupi District, Karnataka",
            "B+",
            "None reported",
            "None",
            "Mohan Kumar (Husband)",
            "9876500099",
            "Near Karkala Bus Stand",
            now,
        ),
    )

    # 5. Seed Read-Only Fictional Examiner Demo Account
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('examiner', ?, ?, ?, ?, 'approved', 1, ?)
        """,
        (
            "AIORA Hackathon Examiner",
            "9900112233",
            "examiner@aiora.karavali.edu",
            hash_password("examiner123"),
            now,
        ),
    )

    # 6. Seed Consultation for Ramesh Kumar & Dr. Priya Sharma
    cur.execute(
        """
        INSERT INTO consultations (
            reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
        """,
        (
            "CONS-101",
            patient_id,
            doctor_id,
            "Persistent Fever & Seasonal Cough Consultation",
            "Patient reported 3 days of intermittent fever (100.8 F) and dry cough. CBC blood test report uploaded for review.",
            "2026-11-05T09:00:00Z",
            now,
        ),
    )
    consultation_id = cur.lastrowid

    # Seed Consultation for Sunita Devi with Dr. Vikram Rao
    cur.execute(
        """
        INSERT INTO consultations (
            reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
        """,
        (
            "CONS-102",
            other_patient_id,
            other_doctor_id,
            "Routine Seasonal Checkup",
            "Assigned to Dr. Vikram Rao.",
            "2026-11-05T09:15:00Z",
            now,
        ),
    )
    other_cons_id = cur.lastrowid

    # 7. Seed Appointments
    cur.execute(
        """
        INSERT INTO appointments (
            reference_code, patient_id, doctor_id, consultation_id, scheduled_date, scheduled_time,
            status, chief_complaint, status_reason, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, 'Approved by Dr. Priya Sharma for tele-review', ?, ?)
        """,
        (
            "APT-101",
            patient_id,
            doctor_id,
            consultation_id,
            tomorrow_date,
            "10:00 AM",
            "Fever (100.8 F) and dry cough for 3 days; CBC report uploaded",
            "2026-11-05T09:00:00Z",
            now,
        ),
    )
    apt_id = cur.lastrowid

    # 8. Seed Consultation Messages for CONS-101
    sample_messages = [
        (
            consultation_id,
            apt_id,
            patient_id,
            "patient",
            "Ramesh Kumar",
            "Namaste Doctor, I have had mild fever (around 100.8 F) and dry cough for the last 3 days in Belthangady village.",
            "seed-msg-1",
            "2026-11-05T09:10:00Z",
        ),
        (
            consultation_id,
            apt_id,
            doctor_id,
            "doctor",
            "Dr. Priya Sharma",
            "Namaste Ramesh. Are you having any shortness of breath, chest pain, or difficulty swallowing? Please also upload your CBC blood report photo using the compressed upload tool.",
            "seed-msg-2",
            "2026-11-05T09:16:00Z",
        ),
        (
            consultation_id,
            apt_id,
            patient_id,
            "patient",
            "Ramesh Kumar",
            "Breathing is normal and no chest pain. I have uploaded the compressed photo of my CBC lab report from the local diagnostic centre.",
            "seed-msg-3",
            "2026-11-05T09:22:00Z",
        ),
    ]
    cur.executemany(
        """
        INSERT INTO messages (
            consultation_id, appointment_id, sender_id, sender_role, sender_name,
            content, client_message_id, delivery_state, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)
        """,
        sample_messages,
    )

    # 9. Seed Sample Compressed Medical Report with Machine-Read OCR Data in Private Storage
    stored_fname = "demo_cons101_cbc_report.jpg"
    sample_path = PRIVATE_REPORTS_DIR / stored_fname
    compressed_bytes = _generate_sample_report_image(sample_path)
    original_bytes = 1_485_760  # 1.45 MB camera photo compressed to ~38 KB

    ocr_extracted_fields = [
        {"parameter": "Hemoglobin (Hb)", "value": "12.8", "unit": "g/dL", "reference": "13.0 - 17.0", "flag": "normal"},
        {"parameter": "Total Leukocyte Count (WBC)", "value": "9,800", "unit": "/cumm", "reference": "4,000 - 11,000", "flag": "normal"},
        {"parameter": "Platelet Count", "value": "2.35", "unit": "Lakh/uL", "reference": "1.50 - 4.50", "flag": "normal"},
        {"parameter": "Fasting Blood Sugar (FBS)", "value": "98", "unit": "mg/dL", "reference": "70 - 110", "flag": "normal"},
        {"parameter": "C-Reactive Protein (CRP)", "value": "6.4", "unit": "mg/L", "reference": "< 5.0", "flag": "elevated"},
    ]

    cur.execute(
        """
        INSERT INTO reports (
            consultation_id, patient_id, title, original_filename, stored_filename,
            mime_type, original_size_bytes, uploaded_size_bytes, was_compressed,
            ocr_status, extracted_fields_json, doctor_reviewed, doctor_corrected_fields_json,
            doctor_review_note, upload_status, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, 'image/jpeg', ?, ?, 1, 'extracted', ?, 1, ?, ?, 'stored', ?)
        """,
        (
            consultation_id,
            patient_id,
            "CBC Blood Test Report (Belthangady Lab)",
            "IMG_20261105_CBC_Report.jpg",
            stored_fname,
            original_bytes,
            compressed_bytes,
            json.dumps(ocr_extracted_fields),
            json.dumps(ocr_extracted_fields),
            "Verified by Dr. Priya Sharma. Mild CRP elevation consistent with viral illness. Platelets and WBC within normal limits.",
            "2026-11-05T09:21:00Z",
        ),
    )

    # 10. Seed Consultation Notes (Signed by Doctor)
    cur.execute(
        """
        INSERT INTO consultation_notes (
            consultation_id, appointment_id, patient_id, doctor_id, assessment,
            care_advice, red_flag_warnings, follow_up_date, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            consultation_id,
            apt_id,
            patient_id,
            doctor_id,
            "Viral Upper Respiratory Tract Infection with Mild Fever. CBC shows normal platelets and WBC with slight inflammatory elevation.",
            "1. Take prescribed Paracetamol 500mg if temperature exceeds 99.5 F. 2. Continue ORS hydration throughout the day. 3. Warm steam inhalation twice daily. 4. Avoid heavy exertion.",
            "RED FLAGS: Seek immediate care at Belthangady Community Hospital or call 108 if you experience chest tightness, breathing difficulty, or persistent high fever > 102 F.",
            (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"),
            "2026-11-05T09:30:00Z",
        ),
    )

    # 11. Seed Doctor-Approved Medicine Schedules
    cur.execute(
        """
        INSERT INTO medicine_schedules (
            consultation_id, patient_id, doctor_id, medicine_name, dosage_strength,
            schedule_times_json, meal_instruction, duration_days, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 5, 'active', ?)
        """,
        (
            consultation_id,
            patient_id,
            doctor_id,
            "Paracetamol 500mg",
            "1 Tablet (SOS)",
            json.dumps(["Morning", "Night"]),
            "After meals when fever is present",
            now,
        ),
    )
    med1_id = cur.lastrowid

    cur.execute(
        """
        INSERT INTO medicine_schedules (
            consultation_id, patient_id, doctor_id, medicine_name, dosage_strength,
            schedule_times_json, meal_instruction, duration_days, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 3, 'active', ?)
        """,
        (
            consultation_id,
            patient_id,
            doctor_id,
            "ORS Electrolyte Sachet",
            "1 Sachet in 1 Litre Water",
            json.dumps(["Morning", "Afternoon"]),
            "Sip throughout the day for hydration",
            now,
        ),
    )
    med2_id = cur.lastrowid

    # 12. Seed Adherence Logs
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cur.execute(
        """
        INSERT INTO adherence_logs (schedule_id, patient_id, dose_date, dose_slot, status, note, logged_at)
        VALUES (?, ?, ?, 'Morning', 'taken', 'Taken with breakfast', ?)
        """,
        (med1_id, patient_id, today_date, "2026-11-05T09:45:00Z"),
    )

    # 13. Seed Consent-Gated Zero-PHI SMS Notifications (Demo Outbox)
    sample_sms = [
        (
            apt_id,
            patient_id,
            "9876543210",
            "booking_request",
            "AAROGYASETU: Your appointment request APT-101 with Dr. Priya Sharma is submitted for tomorrow at 10:00 AM.",
            "sms-seed-req-101",
            "demo_log",
            "sent",
            "2026-11-05T09:01:00Z",
        ),
        (
            apt_id,
            patient_id,
            "9876543210",
            "booking_confirmed",
            "AAROGYASETU: Your appointment APT-101 with Dr. Priya Sharma is CONFIRMED for tomorrow at 10:00 AM. Please sign in to the app for tele-consultation.",
            "sms-seed-conf-101",
            "demo_log",
            "sent",
            "2026-11-05T09:05:00Z",
        ),
    ]
    cur.executemany(
        """
        INSERT INTO sms_notifications (
            appointment_id, patient_id, recipient_phone, event_type, message_body,
            dedupe_key, delivery_mode, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        sample_sms,
    )

    # 14. Seed QR Medical Sharing Token (24 hours expiry)
    expiry_24h = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cur.execute(
        """
        INSERT INTO qr_share_tokens (
            patient_id, token, shared_scopes_json, consent_confirmed, expires_at, is_revoked, access_count, created_at
        )
        VALUES (?, 'ASETU-TK-101-9F3B', ?, 1, ?, 0, 0, ?)
        """,
        (
            patient_id,
            json.dumps(["demographics", "allergies", "chronic_conditions", "emergency_contact", "blood_group"]),
            expiry_24h,
            now,
        ),
    )

    conn.commit()
    conn.close()
