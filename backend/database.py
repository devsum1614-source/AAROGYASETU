"""
SQLite Database Models & Fictional Demo Seed Data for AAROGYASETU (आरोग्यसेतु) — Milestone 1.
Includes tables for:
  1. users (Users and roles: patient, doctor + approval_status)
  2. patient_profiles (Patient profile fields)
  3. doctor_profiles (Doctor profile fields)
  4. consultations (Patient-doctor assignments)
  5. messages (Online consultation messages)
  6. reports (Uploaded medical reports stored privately)

Designed with clean foreign keys so future milestones (appointments, SMS, OCR, QR, reminders, SOS)
can be added without breaking existing tables.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
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
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'examiner')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    date_of_birth TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    village_or_address TEXT NOT NULL DEFAULT '',
    emergency_contact_name TEXT NOT NULL DEFAULT '',
    emergency_contact_phone TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    specialty TEXT NOT NULL DEFAULT 'General Medicine',
    clinic_name TEXT NOT NULL DEFAULT '',
    clinic_location TEXT NOT NULL DEFAULT '',
    languages_spoken TEXT NOT NULL DEFAULT 'English, Hindi, Kannada',
    bio TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
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
    upload_status TEXT NOT NULL DEFAULT 'stored',
    uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_consultation ON reports(consultation_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
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
    """Initializes SQLite tables and seeds fictional demo accounts, consultation, messages, and report."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(SCHEMA_SQL)

    cur = conn.cursor()

    # Ensure the seeded Examiner account exists even if users table was already created
    now = utc_now_iso()
    cur.execute("SELECT id FROM users WHERE role = 'examiner'")
    if not cur.fetchone():
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
        conn.commit()

    cur.execute("SELECT COUNT(*) AS cnt FROM users")
    if cur.fetchone()["cnt"] > 1:
        conn.close()
        return

    now = utc_now_iso()

    # 1. Seed Primary Demo Doctor (Dr. Priya Sharma)
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
        INSERT INTO doctor_profiles (user_id, specialty, clinic_name, clinic_location, languages_spoken, bio, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            doctor_id,
            "General Medicine & Rural Primary Care",
            "Karavali Rural Tele-Health Centre",
            "Mangaluru, Dakshina Kannada, Karnataka",
            "English, Hindi, Kannada, Tulu",
            "MBBS, MD (General Medicine). 9+ years supporting rural Primary Health Centres with low-bandwidth tele-consultations.",
            now,
        ),
    )

    # 2. Seed Secondary Demo Doctor (Dr. Vikram Rao) to demonstrate consultation isolation
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
        INSERT INTO doctor_profiles (user_id, specialty, clinic_name, clinic_location, languages_spoken, bio, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            other_doctor_id,
            "Pediatrics & Family Care",
            "Udupi Community Clinic",
            "Udupi, Karnataka",
            "English, Kannada, Hindi",
            "Rural family care specialist.",
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
            user_id, age, date_of_birth, gender, village_or_address,
            emergency_contact_name, emergency_contact_phone, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            46,
            "1980-04-12",
            "Male",
            "Ward 4, Belthangady Village, Dakshina Kannada, Karnataka",
            "Sita Devi (Wife)",
            "9876500001",
            now,
        ),
    )

    # 4. Seed Unassigned Fictional Patient (Sunita Devi — assigned to Dr. Vikram Rao, NOT Dr. Priya Sharma)
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
    unassigned_patient_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO patient_profiles (
            user_id, age, date_of_birth, gender, village_or_address,
            emergency_contact_name, emergency_contact_phone, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            unassigned_patient_id,
            34,
            "1992-08-19",
            "Female",
            "Karkala Town, Udupi District, Karnataka",
            "Mohan Kumar (Husband)",
            "9876500099",
            now,
        ),
    )

    # 5. Seed Read-Only Fictional Examiner Demo Account (for AIORA Hackathon Evaluation)
    cur.execute("SELECT id FROM users WHERE role = 'examiner'")
    if not cur.fetchone():
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

    # 5. Seed Assigned Consultation between Ramesh Kumar & Dr. Priya Sharma
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

    # Seed Consultation for Sunita Devi with Dr. Vikram Rao (NOT Dr. Priya Sharma)
    cur.execute(
        """
        INSERT INTO consultations (
            reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
        """,
        (
            "CONS-102",
            unassigned_patient_id,
            other_doctor_id,
            "Routine Seasonal Checkup",
            "Assigned to Dr. Vikram Rao.",
            "2026-11-05T09:15:00Z",
            now,
        ),
    )

    # 6. Seed Sample Consultation Messages for CONS-101
    sample_messages = [
        (
            consultation_id,
            patient_id,
            "patient",
            "Ramesh Kumar",
            "Namaste Doctor, I have had mild fever (around 100.8 F) and dry cough for the last 3 days in Belthangady village.",
            "seed-msg-1",
            "2026-11-05T09:10:00Z",
        ),
        (
            consultation_id,
            doctor_id,
            "doctor",
            "Dr. Priya Sharma",
            "Namaste Ramesh. Are you having any shortness of breath, chest pain, or difficulty swallowing? Please also upload your CBC blood report photo using the compressed upload tool.",
            "seed-msg-2",
            "2026-11-05T09:16:00Z",
        ),
        (
            consultation_id,
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
            consultation_id, sender_id, sender_role, sender_name, content, client_message_id, delivery_state, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)
        """,
        sample_messages,
    )

    # 7. Seed Sample Compressed Medical Report Image in Private Storage
    stored_fname = "demo_cons101_cbc_report.jpg"
    sample_path = PRIVATE_REPORTS_DIR / stored_fname
    compressed_bytes = _generate_sample_report_image(sample_path)
    original_bytes = 1_485_760  # 1.45 MB original camera size before browser compression

    cur.execute(
        """
        INSERT INTO reports (
            consultation_id, patient_id, title, original_filename, stored_filename,
            mime_type, original_size_bytes, uploaded_size_bytes, was_compressed, upload_status, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, 'image/jpeg', ?, ?, 1, 'stored', ?)
        """,
        (
            consultation_id,
            patient_id,
            "CBC Blood Test Report (Belthangady Lab)",
            "IMG_20261105_CBC_Report.jpg",
            stored_fname,
            original_bytes,
            compressed_bytes,
            "2026-11-05T09:21:00Z",
        ),
    )

    conn.commit()
    conn.close()
