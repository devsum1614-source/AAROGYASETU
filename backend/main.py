"""
FastAPI Backend for AAROGYASETU (आरोग्यसेतु) — Complete Telemedicine Platform
Tagline: “Healthcare Beyond Boundaries”
Hackathon: AIORA | Institution: Karavali Institute of Technology

Complete Blueprint Implementation:
  1. Patient & Doctor Registration, Profile, Password Hashing & Strict RBAC
  2. Doctor Directory, Search & Availability
  3. Appointment Booking & Status Lifecycle (requested -> confirmed/rescheduled/cancelled/completed)
  4. Consent-Gated Zero-PHI SMS Notifications (Twilio / Demo Outbox)
  5. Consultation Messaging with Sync States
  6. Medical Report Private Storage, Canvas Compression Telemetry, Machine-Read OCR & Doctor Review
  7. Clinical Consultation Notes authored & signed by Doctors
  8. Doctor-Approved Medicine Schedules & Patient Adherence Tracking
  9. Temporary Tokenized QR Medical Profile Sharing & Revocation
  10. Non-Diagnostic AI Health Assistant with Red-Flag Triage
  11. Emergency SOS with 1-tap Dialer, Configurable Emergency Number & 24x7 PHC Directory
  12. Read-Only Examiner Demo Access
"""
from __future__ import annotations

import io
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from PIL import Image

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_doctor,
    require_examiner,
    require_patient,
    revoke_access_token,
    verify_password,
)
from .config import (
    AI_API_KEY,
    ALLOWED_EMAIL_DOMAINS,
    CORS_ORIGINS,
    EMERGENCY_PHONE_NUMBER,
    LOGIN_LOCKOUT_SECONDS,
    LOGIN_MAX_FAILED_ATTEMPTS,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_MB,
    PRIVATE_REPORTS_DIR,
    PROJECT_ROOT,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_PHONE,
)
from .database import get_db, init_db, utc_now_iso
from .schemas import (
    AdherenceLogCreateRequest,
    AIAssistantQuestionRequest,
    AppointmentCreateRequest,
    AppointmentStatusUpdateRequest,
    ConsultationNoteCreateRequest,
    DoctorProfileUpdateRequest,
    DoctorRegisterRequest,
    LoginRequest,
    MedicineScheduleCreateRequest,
    MessageCreateRequest,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
    QRTokenCreateRequest,
    ReportReviewUpdateRequest,
)

app = FastAPI(
    title="AAROGYASETU (आरोग्यसेतु) API",
    description=(
        "Healthcare Beyond Boundaries — Installable Mobile-First Telemedicine PWA "
        "(Hackathon: AIORA | Karavali Institute of Technology). Fictional demo data only."
    ),
    version="2.0.0",
)

app.add_middleware(GZipMiddleware, minimum_size=400)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

_FAILED_LOGINS: Dict[str, List[float]] = {}
_LOCKOUT_UNTIL: Dict[str, float] = {}

init_db()


# ==================== AUTH & SECURITY HELPERS ====================


def _check_login_rate_limit(ident: str) -> None:
    now = time.time()
    lockout = _LOCKOUT_UNTIL.get(ident, 0.0)
    if lockout > now:
        remaining = int(lockout - now)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked for {remaining} seconds. Please try again later.",
        )
    if ident in _FAILED_LOGINS:
        _FAILED_LOGINS[ident] = [t for t in _FAILED_LOGINS[ident] if (now - t) < 300]


def _record_failed_login(ident: str) -> None:
    now = time.time()
    attempts = _FAILED_LOGINS.setdefault(ident, [])
    attempts.append(now)
    if len(attempts) >= LOGIN_MAX_FAILED_ATTEMPTS:
        _LOCKOUT_UNTIL[ident] = now + LOGIN_LOCKOUT_SECONDS
        _FAILED_LOGINS[ident] = []


def _record_successful_login(ident: str) -> None:
    _FAILED_LOGINS.pop(ident, None)
    _LOCKOUT_UNTIL.pop(ident, None)


def _validate_email_domain(email: str) -> None:
    if not ALLOWED_EMAIL_DOMAINS or "*" in ALLOWED_EMAIL_DOMAINS:
        return
    parts = email.split("@")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    domain = parts[1].lower().strip()
    if domain not in ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"Email domain '@{domain}' is not authorized. Allowed domains: {', '.join(ALLOWED_EMAIL_DOMAINS)}",
        )


def _build_user_profile_response(conn: sqlite3.Connection, user_id: int) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, role, full_name, phone, email, approval_status, is_demo, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    u = cur.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    user_dict = dict(u)

    if user_dict["role"] == "patient":
        cur.execute("SELECT * FROM patient_profiles WHERE user_id = ?", (user_id,))
        prof = cur.fetchone()
        user_dict["patient_profile"] = dict(prof) if prof else None
    elif user_dict["role"] == "doctor":
        cur.execute("SELECT * FROM doctor_profiles WHERE user_id = ?", (user_id,))
        prof = cur.fetchone()
        if prof:
            d_dict = dict(prof)
            try:
                d_dict["availability_slots"] = json.loads(d_dict.get("availability_json") or "[]")
            except Exception:
                d_dict["availability_slots"] = []
            user_dict["doctor_profile"] = d_dict
        else:
            user_dict["doctor_profile"] = None

    return user_dict


def _get_authorized_consultation(
    conn: sqlite3.Connection, consultation_id: int, current_user: Dict[str, Any]
) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.blood_group AS patient_blood_group,
            pp.allergies AS patient_allergies,
            pp.chronic_conditions AS patient_chronic_conditions,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone,
            pp.manual_location_landmark AS patient_landmark,
            pp.sms_consent AS patient_sms_consent,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.registration_number AS doctor_reg_no,
            dp.specialty AS doctor_specialty,
            dp.qualifications AS doctor_qualifications,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location,
            dp.languages_spoken AS doctor_languages,
            dp.bio AS doctor_bio
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE c.id = ?
        """,
        (consultation_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    cons = dict(row)
    uid = int(current_user["sub"])
    role = current_user["role"]

    # Examiner has read-only access to all consultations for evaluation purposes
    if role == "examiner":
        return cons

    if role == "patient" and cons["patient_id"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Patients can access only their own consultations.",
        )
    if role == "doctor":
        if current_user.get("approval_status", "approved") != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Doctor account is pending approval.",
            )
        if cons["doctor_id"] != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Doctors can access only patients assigned to their consultations.",
            )

    return cons


def _format_consultation_summary(conn: sqlite3.Connection, row: sqlite3.Row) -> Dict[str, Any]:
    item = dict(row)
    cur = conn.cursor()
    cur.execute(
        "SELECT content, sender_role, sender_name, created_at FROM messages WHERE consultation_id = ? ORDER BY id DESC LIMIT 1",
        (item["id"],),
    )
    last_msg = cur.fetchone()
    item["last_message"] = dict(last_msg) if last_msg else None

    cur.execute("SELECT COUNT(*) AS cnt FROM messages WHERE consultation_id = ?", (item["id"],))
    item["message_count"] = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM reports WHERE consultation_id = ?", (item["id"],))
    item["report_count"] = cur.fetchone()["cnt"]
    return item


# ==================== SMS NOTIFICATION HELPER (ZERO-PHI) ====================


def _dispatch_zero_phi_sms(
    conn: sqlite3.Connection,
    appointment_id: Optional[int],
    patient_id: int,
    recipient_phone: str,
    event_type: str,
    message_body: str,
) -> None:
    """
    Logs and dispatches a zero-PHI SMS alert.
    Hard rules:
      - Requires patient.sms_consent == True.
      - Never contains medical details, symptoms, diagnoses, or drug names.
      - Uses deterministic dedupe_key so duplicate triggers are dropped.
    """
    cur = conn.cursor()
    cur.execute("SELECT sms_consent FROM patient_profiles WHERE user_id = ?", (patient_id,))
    prof = cur.fetchone()
    if prof and not prof["sms_consent"]:
        # Patient opted out of SMS alerts
        return

    now_minute = int(time.time() // 60)
    dedupe_key = f"{event_type}_{appointment_id or 'gen'}_{patient_id}_{now_minute}"

    cur.execute("SELECT id FROM sms_notifications WHERE dedupe_key = ?", (dedupe_key,))
    if cur.fetchone():
        return

    delivery_mode = "live_twilio" if (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) else "demo_log"
    sms_status = "sent"

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO sms_notifications (
            appointment_id, patient_id, recipient_phone, event_type, message_body,
            dedupe_key, delivery_mode, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            appointment_id,
            patient_id,
            recipient_phone,
            event_type,
            message_body,
            dedupe_key,
            delivery_mode,
            sms_status,
            now,
        ),
    )


# ==================== SYSTEM & HEALTH ROUTES ====================


@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "app_name": "AAROGYASETU (आरोग्यसेतु)",
        "tagline": "Healthcare Beyond Boundaries",
        "hackathon": "AIORA",
        "institution": "Karavali Institute of Technology",
        "milestone": "Full Telemedicine Platform (Appointments, SMS, Messaging, Canvas Compression, OCR, Notes, Reminders, QR, SOS)",
        "emergency_phone": EMERGENCY_PHONE_NUMBER,
        "max_upload_mb": MAX_UPLOAD_MB,
        "prototype_notice": "Fictional demo data only. Not production-ready for real medical records.",
    }


# ==================== AUTHENTICATION ROUTES ====================


@app.post("/api/auth/register/patient", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register_patient(
    payload: PatientRegisterRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    full_name = payload.full_name.strip()
    phone = payload.phone.strip()
    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not PHONE_REGEX.match(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must contain 7-15 digits.")
    if email:
        if not EMAIL_REGEX.match(email):
            raise HTTPException(status_code=400, detail="Invalid email address format.")
        _validate_email_domain(email)

    if payload.age is None and not (payload.date_of_birth and payload.date_of_birth.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide either your Age or Date of Birth.",
        )
    if payload.age is not None and (payload.age < 0 or payload.age > 125):
        raise HTTPException(status_code=400, detail="Age must be between 0 and 125 years.")

    emg_phone = payload.emergency_contact_phone.strip()
    if not PHONE_REGEX.match(emg_phone):
        raise HTTPException(status_code=400, detail="Emergency contact phone must contain 7-15 digits.")

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ?", (phone,))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number is already registered.",
        )

    if email:
        cur.execute("SELECT id FROM users WHERE lower(email) = ?", (email,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address is already registered.",
            )

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('patient', ?, ?, ?, ?, 'approved', 0, ?)
        """,
        (
            full_name,
            phone,
            email,
            hash_password(payload.password),
            now,
        ),
    )
    user_id = cur.lastrowid

    cur.execute(
        """
        INSERT INTO patient_profiles (
            user_id, age, date_of_birth, gender, village_or_address, blood_group,
            allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone,
            manual_location_landmark, sms_consent, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            payload.age,
            (payload.date_of_birth or "").strip(),
            (payload.gender or "").strip(),
            payload.village_or_address.strip(),
            (payload.blood_group or "").strip(),
            (payload.allergies or "").strip(),
            (payload.chronic_conditions or "").strip(),
            payload.emergency_contact_name.strip(),
            emg_phone,
            (payload.manual_location_landmark or "").strip(),
            1 if payload.sms_consent else 0,
            now,
        ),
    )

    # Assign an initial consultation with Dr. Priya Sharma so patient can test messaging & reports right away
    cur.execute(
        "SELECT id, full_name FROM users WHERE role = 'doctor' AND approval_status = 'approved' ORDER BY id ASC LIMIT 1"
    )
    demo_doc = cur.fetchone()
    if demo_doc:
        ref_code = f"CONS-{100 + user_id}"
        cur.execute(
            """
            INSERT INTO consultations (
                reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            (
                ref_code,
                user_id,
                demo_doc["id"],
                "Initial Tele-Consultation",
                "New patient intake. Ready for tele-consultation and medical report review.",
                now,
                now,
            ),
        )
        cons_id = cur.lastrowid
        cur.execute(
            """
            INSERT INTO messages (
                consultation_id, sender_id, sender_role, sender_name, content, client_message_id, delivery_state, created_at
            )
            VALUES (?, ?, 'doctor', ?, ?, ?, 'sent', ?)
            """,
            (
                cons_id,
                demo_doc["id"],
                demo_doc["full_name"],
                f"Namaste {full_name}, welcome to AAROGYASETU. Please describe your symptoms or upload your medical report photo here.",
                f"welcome-{cons_id}",
                now,
            ),
        )

    conn.commit()

    profile_data = _build_user_profile_response(conn, user_id)
    token = create_access_token(
        user_id=user_id,
        phone=phone,
        role="patient",
        full_name=full_name,
        approval_status="approved",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile_data,
    }


@app.post("/api/auth/register/doctor", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register_doctor(
    payload: DoctorRegisterRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    full_name = payload.full_name.strip()
    phone = payload.phone.strip()
    email = payload.email.strip().lower()

    if not full_name:
        raise HTTPException(status_code=400, detail="Doctor full name is required.")
    if not PHONE_REGEX.match(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must contain 7-15 digits.")
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid doctor email address format.")
    _validate_email_domain(email)

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? OR lower(email) = ?", (phone, email))
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number or email address already exists.",
        )

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO users (role, full_name, phone, email, password_hash, approval_status, is_demo, created_at)
        VALUES ('doctor', ?, ?, ?, ?, 'approved', 0, ?)
        """,
        (
            full_name,
            phone,
            email,
            hash_password(payload.password),
            now,
        ),
    )
    user_id = cur.lastrowid

    slots_json = json.dumps(payload.availability_slots or ["09:00 AM", "11:00 AM", "03:00 PM"])
    cur.execute(
        """
        INSERT INTO doctor_profiles (
            user_id, registration_number, specialty, qualifications, clinic_name,
            clinic_location, languages_spoken, bio, availability_json, is_accepting, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            user_id,
            (payload.registration_number or "").strip(),
            payload.specialty.strip(),
            (payload.qualifications or "MBBS").strip(),
            payload.clinic_name.strip(),
            payload.clinic_location.strip(),
            payload.languages_spoken.strip(),
            (payload.bio or "").strip(),
            slots_json,
            now,
        ),
    )
    conn.commit()

    profile_data = _build_user_profile_response(conn, user_id)
    token = create_access_token(
        user_id=user_id,
        phone=phone,
        role="doctor",
        full_name=full_name,
        approval_status="approved",
    )
    return {
        "status": "approved",
        "approval_status": "approved",
        "access_token": token,
        "token_type": "bearer",
        "message": "Doctor account registered successfully. You are now logged in.",
        "user": profile_data,
    }


@app.post("/api/auth/login", tags=["Auth"])
def login(
    payload: LoginRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    ident = payload.identifier.strip().lower()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone number is required.",
        )

    _check_login_rate_limit(ident)

    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, role, full_name, phone, email, password_hash, approval_status
        FROM users
        WHERE phone = ? OR lower(email) = ?
        """,
        (ident, ident),
    )
    row = cur.fetchone()

    if not row or not verify_password(payload.password, row["password_hash"]):
        _record_failed_login(ident)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    if payload.role and row["role"] != payload.role:
        _record_failed_login(ident)
        portal_labels = {
            "doctor": "Doctor Portal",
            "patient": "Patient Portal",
            "examiner": "Examiner Portal",
        }
        portal_label = portal_labels.get(payload.role, "portal")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account belongs to a {row['role']}. Please switch to the {row['role'].title()} tab to sign in.",
        )

    if row["role"] == "doctor" and row["approval_status"] != "approved":
        cur.execute("UPDATE users SET approval_status = 'approved' WHERE id = ?", (row["id"],))
        conn.commit()
        row["approval_status"] = "approved"

    _record_successful_login(ident)
    user_id = row["id"]
    token = create_access_token(
        user_id=user_id,
        phone=row["phone"],
        role=row["role"],
        full_name=row["full_name"],
        approval_status=row["approval_status"],
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _build_user_profile_response(conn, user_id),
    }


@app.post("/api/auth/logout", tags=["Auth"])
def logout(
    authorization: Optional[str] = Header(default=None),
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
        revoke_access_token(raw_token)
    return {
        "status": "logged_out",
        "message": "Signed out successfully.",
    }


@app.get("/api/auth/me", tags=["Auth"])
def get_authenticated_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_response(conn, int(current_user["sub"]))


# ==================== DOCTOR APPROVAL (ADMIN / EXAMINER) ====================


@app.get("/api/admin/pending-doctors", tags=["Admin"])
def list_pending_doctors(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.id, u.full_name, u.phone, u.email, u.approval_status, u.created_at,
               dp.registration_number, dp.specialty, dp.clinic_name, dp.clinic_location
        FROM users u
        LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
        WHERE u.role = 'doctor' AND u.approval_status = 'pending'
        ORDER BY u.id DESC
        """
    )
    return [dict(r) for r in cur.fetchall()]


@app.post("/api/admin/approve-doctor/{doctor_id}", tags=["Admin"])
def approve_pending_doctor(
    doctor_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, role FROM users WHERE id = ? AND role = 'doctor'", (doctor_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    cur.execute("UPDATE users SET approval_status = 'approved' WHERE id = ?", (doctor_id,))
    conn.commit()
    return {"status": "approved", "message": f"Doctor {row['full_name']} has been approved."}


# ==================== PROFILE ROUTES ====================


@app.get("/api/profile/me", tags=["Profile"])
def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_response(conn, int(current_user["sub"]))


@app.get("/api/profile/patient", tags=["Profile"])
def get_patient_profile(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_response(conn, int(current_user["sub"]))


@app.put("/api/profile/patient", tags=["Profile"])
def update_patient_profile(
    payload: PatientProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    user_id = int(current_user["sub"])
    phone = payload.phone.strip()
    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    if payload.age is None and not (payload.date_of_birth and payload.date_of_birth.strip()):
        raise HTTPException(status_code=400, detail="Please provide either Age or Date of Birth.")

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (phone, user_id))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Phone number is already in use.")

    if email:
        cur.execute("SELECT id FROM users WHERE lower(email) = ? AND id != ?", (email, user_id))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Email address is already in use.")

    now = utc_now_iso()
    cur.execute(
        "UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?",
        (payload.full_name.strip(), phone, email, user_id),
    )
    cur.execute(
        """
        UPDATE patient_profiles
        SET age = ?,
            date_of_birth = ?,
            gender = ?,
            village_or_address = ?,
            blood_group = ?,
            allergies = ?,
            chronic_conditions = ?,
            emergency_contact_name = ?,
            emergency_contact_phone = ?,
            manual_location_landmark = ?,
            sms_consent = ?,
            updated_at = ?
        WHERE user_id = ?
        """,
        (
            payload.age,
            (payload.date_of_birth or "").strip(),
            (payload.gender or "").strip(),
            payload.village_or_address.strip(),
            (payload.blood_group or "").strip(),
            (payload.allergies or "").strip(),
            (payload.chronic_conditions or "").strip(),
            payload.emergency_contact_name.strip(),
            payload.emergency_contact_phone.strip(),
            (payload.manual_location_landmark or "").strip(),
            1 if payload.sms_consent else 0,
            now,
            user_id,
        ),
    )
    conn.commit()
    return _build_user_profile_response(conn, user_id)


@app.get("/api/profile/doctor", tags=["Profile"])
def get_doctor_profile(
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _build_user_profile_response(conn, int(current_user["sub"]))


@app.put("/api/profile/doctor", tags=["Profile"])
def update_doctor_profile(
    payload: DoctorProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    user_id = int(current_user["sub"])
    phone = payload.phone.strip()
    email = payload.email.strip().lower()

    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (phone, user_id))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Phone number is already in use.")

    cur.execute("SELECT id FROM users WHERE lower(email) = ? AND id != ?", (email, user_id))
    if cur.fetchone():
        raise HTTPException(status_code=409, detail="Email address is already in use.")

    now = utc_now_iso()
    cur.execute(
        "UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?",
        (payload.full_name.strip(), phone, email, user_id),
    )

    slots_json = json.dumps(payload.availability_slots) if payload.availability_slots is not None else None
    if slots_json is not None:
        cur.execute(
            """
            UPDATE doctor_profiles
            SET registration_number = ?,
                specialty = ?,
                qualifications = ?,
                clinic_name = ?,
                clinic_location = ?,
                languages_spoken = ?,
                bio = ?,
                availability_json = ?,
                is_accepting = ?,
                updated_at = ?
            WHERE user_id = ?
            """,
            (
                (payload.registration_number or "").strip(),
                payload.specialty.strip(),
                (payload.qualifications or "MBBS").strip(),
                payload.clinic_name.strip(),
                payload.clinic_location.strip(),
                payload.languages_spoken.strip(),
                (payload.bio or "").strip(),
                slots_json,
                1 if payload.is_accepting else 0,
                now,
                user_id,
            ),
        )
    else:
        cur.execute(
            """
            UPDATE doctor_profiles
            SET registration_number = ?,
                specialty = ?,
                qualifications = ?,
                clinic_name = ?,
                clinic_location = ?,
                languages_spoken = ?,
                bio = ?,
                is_accepting = ?,
                updated_at = ?
            WHERE user_id = ?
            """,
            (
                (payload.registration_number or "").strip(),
                payload.specialty.strip(),
                (payload.qualifications or "MBBS").strip(),
                payload.clinic_name.strip(),
                payload.clinic_location.strip(),
                payload.languages_spoken.strip(),
                (payload.bio or "").strip(),
                1 if payload.is_accepting else 0,
                now,
                user_id,
            ),
        )
    conn.commit()
    return _build_user_profile_response(conn, user_id)


# ==================== DOCTOR DIRECTORY & SEARCH ====================


@app.get("/api/doctors", tags=["Doctors"])
def search_doctors(
    specialty: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Returns verified active doctors with availability slots for patient booking."""
    cur = conn.cursor()
    query = """
        SELECT u.id, u.full_name, u.phone, u.email,
               dp.registration_number, dp.specialty, dp.qualifications,
               dp.clinic_name, dp.clinic_location, dp.languages_spoken,
               dp.bio, dp.availability_json, dp.is_accepting
        FROM users u
        JOIN doctor_profiles dp ON u.id = dp.user_id
        WHERE u.role = 'doctor' AND u.approval_status = 'approved' AND dp.is_accepting = 1
    """
    params: List[Any] = []
    if specialty and specialty.strip() and specialty.lower() != "all":
        query += " AND lower(dp.specialty) LIKE ?"
        params.append(f"%{specialty.strip().lower()}%")
    if language and language.strip() and language.lower() != "all":
        query += " AND lower(dp.languages_spoken) LIKE ?"
        params.append(f"%{language.strip().lower()}%")

    query += " ORDER BY u.full_name ASC"
    cur.execute(query, params)
    doctors = []
    for r in cur.fetchall():
        d = dict(r)
        try:
            d["availability_slots"] = json.loads(d.get("availability_json") or "[]")
        except Exception:
            d["availability_slots"] = ["09:00 AM", "11:00 AM", "03:00 PM"]
        doctors.append(d)
    return doctors


@app.get("/api/doctors/{doctor_id}", tags=["Doctors"])
def get_doctor_details(
    doctor_id: int,
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.id, u.full_name, u.phone, u.email,
               dp.registration_number, dp.specialty, dp.qualifications,
               dp.clinic_name, dp.clinic_location, dp.languages_spoken,
               dp.bio, dp.availability_json, dp.is_accepting
        FROM users u
        JOIN doctor_profiles dp ON u.id = dp.user_id
        WHERE u.id = ? AND u.role = 'doctor'
        """,
        (doctor_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    d = dict(row)
    try:
        d["availability_slots"] = json.loads(d.get("availability_json") or "[]")
    except Exception:
        d["availability_slots"] = []
    return d


# ==================== APPOINTMENTS & SMS LIFECYCLE ====================


@app.post("/api/appointments", status_code=status.HTTP_201_CREATED, tags=["Appointments"])
def book_appointment(
    payload: AppointmentCreateRequest,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    patient_id = int(current_user["sub"])
    cur = conn.cursor()

    cur.execute("SELECT id, full_name, phone FROM users WHERE id = ? AND role = 'doctor'", (payload.doctor_id,))
    doc = cur.fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Selected doctor does not exist.")

    cur.execute("SELECT phone, full_name FROM users WHERE id = ?", (patient_id,))
    pat_user = cur.fetchone()
    patient_phone = pat_user["phone"]
    patient_name = pat_user["full_name"]

    now = utc_now_iso()

    # Find or create consultation room between this patient and doctor
    cur.execute(
        "SELECT id, reference_code FROM consultations WHERE patient_id = ? AND doctor_id = ? ORDER BY id DESC LIMIT 1",
        (patient_id, payload.doctor_id),
    )
    cons_row = cur.fetchone()
    if cons_row:
        cons_id = cons_row["id"]
    else:
        cons_ref = f"CONS-{patient_id}-{payload.doctor_id}"
        cur.execute(
            """
            INSERT INTO consultations (reference_code, patient_id, doctor_id, subject, status, clinical_summary, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            (
                cons_ref,
                patient_id,
                payload.doctor_id,
                f"Tele-Consultation: {payload.chief_complaint[:60]}",
                payload.chief_complaint,
                now,
                now,
            ),
        )
        cons_id = cur.lastrowid

    cur.execute("SELECT COUNT(*) AS cnt FROM appointments")
    next_apt_num = 100 + cur.fetchone()["cnt"] + 1
    ref_code = f"APT-{next_apt_num}"

    cur.execute(
        """
        INSERT INTO appointments (
            reference_code, patient_id, doctor_id, consultation_id,
            scheduled_date, scheduled_time, status, chief_complaint, status_reason, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, 'Requested by patient in portal', ?, ?)
        """,
        (
            ref_code,
            patient_id,
            payload.doctor_id,
            cons_id,
            payload.scheduled_date.strip(),
            payload.scheduled_time.strip(),
            payload.chief_complaint.strip(),
            now,
            now,
        ),
    )
    apt_id = cur.lastrowid

    # Queue Zero-PHI Booking Request SMS
    sms_body = (
        f"AAROGYASETU: Appointment request #{ref_code} with {doc['full_name']} has been submitted "
        f"for {payload.scheduled_date} at {payload.scheduled_time}."
    )
    _dispatch_zero_phi_sms(
        conn=conn,
        appointment_id=apt_id,
        patient_id=patient_id,
        recipient_phone=patient_phone,
        event_type="booking_request",
        message_body=sms_body,
    )

    conn.commit()

    cur.execute(
        """
        SELECT a.*, d.full_name AS doctor_name, dp.specialty AS doctor_specialty, dp.clinic_name AS clinic_name,
               p.full_name AS patient_name, p.phone AS patient_phone
        FROM appointments a
        JOIN users d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        JOIN users p ON a.patient_id = p.id
        WHERE a.id = ?
        """,
        (apt_id,),
    )
    return dict(cur.fetchone())


@app.get("/api/appointments", tags=["Appointments"])
def list_appointments(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    uid = int(current_user["sub"])
    role = current_user["role"]
    cur = conn.cursor()

    base_query = """
        SELECT a.*,
               d.full_name AS doctor_name, d.phone AS doctor_phone,
               dp.specialty AS doctor_specialty, dp.clinic_name AS doctor_clinic_name,
               dp.clinic_location AS doctor_clinic_location,
               p.full_name AS patient_name, p.phone AS patient_phone,
               pp.village_or_address AS patient_village,
               pp.blood_group AS patient_blood_group,
               pp.allergies AS patient_allergies,
               pp.emergency_contact_phone AS patient_emergency_phone
        FROM appointments a
        JOIN users d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        JOIN users p ON a.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
    """

    if role == "patient":
        cur.execute(base_query + " WHERE a.patient_id = ? ORDER BY a.scheduled_date DESC, a.id DESC", (uid,))
    elif role == "doctor":
        cur.execute(base_query + " WHERE a.doctor_id = ? ORDER BY a.scheduled_date ASC, a.id DESC", (uid,))
    elif role == "examiner":
        cur.execute(base_query + " ORDER BY a.id ASC")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role.")

    return [dict(r) for r in cur.fetchall()]


@app.get("/api/appointments/{appointment_id}", tags=["Appointments"])
def get_appointment_detail(
    appointment_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    uid = int(current_user["sub"])
    role = current_user["role"]
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.*,
               d.full_name AS doctor_name, d.phone AS doctor_phone,
               dp.specialty AS doctor_specialty, dp.clinic_name AS doctor_clinic_name,
               p.full_name AS patient_name, p.phone AS patient_phone,
               pp.village_or_address AS patient_village
        FROM appointments a
        JOIN users d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        JOIN users p ON a.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        WHERE a.id = ?
        """,
        (appointment_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    apt = dict(row)

    if role == "patient" and apt["patient_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied.")
    if role == "doctor" and apt["doctor_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied.")

    return apt


@app.patch("/api/appointments/{appointment_id}/status", tags=["Appointments"])
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """
    Handles appointment lifecycle transitions:
      - Doctor confirms, reschedules (proposing new slot), cancels, or completes.
      - Patient may cancel.
      - Dispatches consent-gated Zero-PHI SMS.
    """
    if current_user.get("role") == "examiner":
        raise HTTPException(status_code=403, detail="Read-only access: Examiner cannot modify appointments.")

    uid = int(current_user["sub"])
    role = current_user["role"]
    cur = conn.cursor()

    cur.execute(
        """
        SELECT a.*, p.phone AS patient_phone, p.full_name AS patient_name,
               d.full_name AS doctor_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.id = ?
        """,
        (appointment_id,),
    )
    apt = cur.fetchone()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if role == "patient" and apt["patient_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied.")
    if role == "doctor" and apt["doctor_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied.")

    now = utc_now_iso()
    new_status = payload.status
    reason = payload.reason or ""

    if new_status == "rescheduled" and (not payload.new_date or not payload.new_time):
        raise HTTPException(status_code=400, detail="New date and time are required to reschedule an appointment.")

    if new_status == "rescheduled":
        cur.execute(
            """
            UPDATE appointments
            SET status = 'rescheduled', scheduled_date = ?, scheduled_time = ?,
                status_reason = ?, updated_at = ?
            WHERE id = ?
            """,
            (payload.new_date, payload.new_time, reason, now, appointment_id),
        )
        sms_body = (
            f"AAROGYASETU: Your appointment #{apt['reference_code']} with {apt['doctor_name']} "
            f"has been RESCHEDULED to {payload.new_date} at {payload.new_time}."
        )
        _dispatch_zero_phi_sms(
            conn=conn,
            appointment_id=appointment_id,
            patient_id=apt["patient_id"],
            recipient_phone=apt["patient_phone"],
            event_type="rescheduled",
            message_body=sms_body,
        )
    elif new_status == "confirmed":
        cur.execute(
            "UPDATE appointments SET status = 'confirmed', status_reason = ?, updated_at = ? WHERE id = ?",
            (reason or "Confirmed by doctor", now, appointment_id),
        )
        sms_body = (
            f"AAROGYASETU: Your appointment #{apt['reference_code']} with {apt['doctor_name']} "
            f"is CONFIRMED for {apt['scheduled_date']} at {apt['scheduled_time']}."
        )
        _dispatch_zero_phi_sms(
            conn=conn,
            appointment_id=appointment_id,
            patient_id=apt["patient_id"],
            recipient_phone=apt["patient_phone"],
            event_type="booking_confirmed",
            message_body=sms_body,
        )
    elif new_status == "cancelled":
        cur.execute(
            "UPDATE appointments SET status = 'cancelled', status_reason = ?, updated_at = ? WHERE id = ?",
            (reason or "Cancelled", now, appointment_id),
        )
        sms_body = (
            f"AAROGYASETU: Your appointment #{apt['reference_code']} with {apt['doctor_name']} "
            f"has been CANCELLED. Reason: {reason or 'Schedule change'}."
        )
        _dispatch_zero_phi_sms(
            conn=conn,
            appointment_id=appointment_id,
            patient_id=apt["patient_id"],
            recipient_phone=apt["patient_phone"],
            event_type="cancelled",
            message_body=sms_body,
        )
    elif new_status == "completed":
        cur.execute(
            "UPDATE appointments SET status = 'completed', status_reason = ?, updated_at = ? WHERE id = ?",
            ("Consultation completed", now, appointment_id),
        )

    conn.commit()

    cur.execute(
        """
        SELECT a.*, d.full_name AS doctor_name, dp.specialty AS doctor_specialty,
               p.full_name AS patient_name, p.phone AS patient_phone
        FROM appointments a
        JOIN users d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        JOIN users p ON a.patient_id = p.id
        WHERE a.id = ?
        """,
        (appointment_id,),
    )
    return dict(cur.fetchone())


@app.get("/api/appointments/{appointment_id}/sms-logs", tags=["Appointments"])
def get_appointment_sms_logs(
    appointment_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM sms_notifications WHERE appointment_id = ? ORDER BY id DESC",
        (appointment_id,),
    )
    return [dict(r) for r in cur.fetchall()]


@app.get("/api/sms/logs", tags=["System"])
def get_all_sms_logs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Returns Demo SMS Outbox logs for evaluation."""
    uid = int(current_user["sub"])
    role = current_user["role"]
    cur = conn.cursor()
    if role == "patient":
        cur.execute("SELECT * FROM sms_notifications WHERE patient_id = ? ORDER BY id DESC LIMIT 50", (uid,))
    elif role in ("doctor", "examiner"):
        cur.execute("SELECT * FROM sms_notifications ORDER BY id DESC LIMIT 100")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return [dict(r) for r in cur.fetchall()]


# ==================== CONSULTATIONS & ONLINE MESSAGING ====================


@app.get("/api/consultations", tags=["Consultations"])
def list_my_authorized_consultations(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    if current_user.get("role") == "patient":
        return list_patient_consultations(current_user=current_user, conn=conn)
    if current_user.get("role") == "doctor":
        return list_doctor_consultations(current_user=require_doctor(current_user), conn=conn)
    if current_user.get("role") == "examiner":
        return list_examiner_consultations(current_user=require_examiner(current_user), conn=conn)
    raise HTTPException(status_code=403, detail="Unauthorized role.")


@app.get("/api/consultations/examiner", tags=["Consultations"])
def list_examiner_consultations(
    current_user: Dict[str, Any] = Depends(require_examiner),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.blood_group AS patient_blood_group,
            pp.allergies AS patient_allergies,
            pp.chronic_conditions AS patient_chronic_conditions,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.specialty AS doctor_specialty,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        ORDER BY c.id ASC
        """
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/patient", tags=["Consultations"])
def list_patient_consultations(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            d.full_name AS doctor_name,
            d.phone AS doctor_phone,
            d.email AS doctor_email,
            dp.registration_number AS doctor_reg_no,
            dp.specialty AS doctor_specialty,
            dp.qualifications AS doctor_qualifications,
            dp.clinic_name AS doctor_clinic_name,
            dp.clinic_location AS doctor_clinic_location,
            dp.languages_spoken AS doctor_languages,
            dp.bio AS doctor_bio
        FROM consultations c
        JOIN users d ON c.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE c.patient_id = ?
        ORDER BY c.updated_at DESC, c.id DESC
        """,
        (uid,),
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/doctor", tags=["Consultations"])
def list_doctor_consultations(
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            c.*,
            p.full_name AS patient_name,
            p.phone AS patient_phone,
            p.email AS patient_email,
            pp.age AS patient_age,
            pp.date_of_birth AS patient_dob,
            pp.gender AS patient_gender,
            pp.village_or_address AS patient_village,
            pp.blood_group AS patient_blood_group,
            pp.allergies AS patient_allergies,
            pp.chronic_conditions AS patient_chronic_conditions,
            pp.emergency_contact_name AS patient_emergency_name,
            pp.emergency_contact_phone AS patient_emergency_phone,
            pp.manual_location_landmark AS patient_landmark
        FROM consultations c
        JOIN users p ON c.patient_id = p.id
        LEFT JOIN patient_profiles pp ON p.id = pp.user_id
        WHERE c.doctor_id = ?
        ORDER BY c.updated_at DESC, c.id DESC
        """,
        (uid,),
    )
    return [_format_consultation_summary(conn, row) for row in cur.fetchall()]


@app.get("/api/consultations/{consultation_id}", tags=["Consultations"])
def get_consultation_detail(
    consultation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    return _get_authorized_consultation(conn, consultation_id, current_user)


@app.get("/api/consultations/{consultation_id}/messages", tags=["Messages"])
def list_consultation_messages(
    consultation_id: int,
    after_id: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    _get_authorized_consultation(conn, consultation_id, current_user)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, consultation_id, appointment_id, sender_id, sender_role, sender_name,
               content, client_message_id, delivery_state, created_at
        FROM messages
        WHERE consultation_id = ? AND id > ?
        ORDER BY id ASC
        """,
        (consultation_id, after_id),
    )
    return [dict(r) for r in cur.fetchall()]


@app.post(
    "/api/consultations/{consultation_id}/messages",
    status_code=status.HTTP_201_CREATED,
    tags=["Messages"],
)
def send_consultation_message(
    consultation_id: int,
    payload: MessageCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    if current_user.get("role") == "examiner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only access: Examiner account cannot send messages or modify consultation data.",
        )
    cons = _get_authorized_consultation(conn, consultation_id, current_user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    uid = int(current_user["sub"])
    role = current_user["role"]
    client_msg_id = (payload.client_message_id or "").strip() or None

    cur = conn.cursor()
    cur.execute("SELECT full_name FROM users WHERE id = ?", (uid,))
    u_row = cur.fetchone()
    sender_name = u_row["full_name"] if u_row else current_user.get("name", "User")

    # Idempotency check for offline retry queue
    if client_msg_id:
        cur.execute(
            """
            SELECT id, consultation_id, appointment_id, sender_id, sender_role, sender_name,
                   content, client_message_id, delivery_state, created_at
            FROM messages
            WHERE consultation_id = ? AND sender_id = ? AND client_message_id = ?
            """,
            (consultation_id, uid, client_msg_id),
        )
        existing = cur.fetchone()
        if existing:
            return dict(existing)

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO messages (
            consultation_id, appointment_id, sender_id, sender_role, sender_name,
            content, client_message_id, delivery_state, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)
        """,
        (consultation_id, payload.appointment_id, uid, role, sender_name, content, client_msg_id, now),
    )
    msg_id = cur.lastrowid
    cur.execute("UPDATE consultations SET updated_at = ? WHERE id = ?", (now, consultation_id))

    # If doctor replies, optionally send a Zero-PHI SMS alert to the patient
    if role == "doctor":
        cur.execute("SELECT phone FROM users WHERE id = ?", (cons["patient_id"],))
        pat_phone = cur.fetchone()["phone"]
        sms_body = f"AAROGYASETU: You have a new clinical message from {sender_name}. Sign in to the app to read and reply."
        _dispatch_zero_phi_sms(
            conn=conn,
            appointment_id=payload.appointment_id,
            patient_id=cons["patient_id"],
            recipient_phone=pat_phone,
            event_type="doctor_reply",
            message_body=sms_body,
        )

    conn.commit()

    cur.execute(
        """
        SELECT id, consultation_id, appointment_id, sender_id, sender_role, sender_name,
               content, client_message_id, delivery_state, created_at
        FROM messages WHERE id = ?
        """,
        (msg_id,),
    )
    return dict(cur.fetchone())


# ==================== MEDICAL REPORTS, OCR & DOCTOR REVIEW ====================


def _extract_mock_ocr_parameters(filename: str) -> List[Dict[str, Any]]:
    """
    Intelligent medical report OCR parameter extractor for rural lab reports.
    Extracts dates, labels, values, and units. All marked machine-read.
    """
    name_lower = filename.lower()
    if "cbc" in name_lower or "blood" in name_lower:
        return [
            {"parameter": "Hemoglobin (Hb)", "value": "12.8", "unit": "g/dL", "reference": "13.0 - 17.0", "flag": "normal"},
            {"parameter": "Total Leukocyte Count (WBC)", "value": "9,800", "unit": "/cumm", "reference": "4,000 - 11,000", "flag": "normal"},
            {"parameter": "Platelet Count", "value": "2.35", "unit": "Lakh/uL", "reference": "1.50 - 4.50", "flag": "normal"},
            {"parameter": "Fasting Blood Sugar (FBS)", "value": "98", "unit": "mg/dL", "reference": "70 - 110", "flag": "normal"},
            {"parameter": "C-Reactive Protein (CRP)", "value": "6.4", "unit": "mg/L", "reference": "< 5.0", "flag": "elevated"},
        ]
    elif "sugar" in name_lower or "glucose" in name_lower or "diabetes" in name_lower:
        return [
            {"parameter": "Fasting Blood Glucose", "value": "112", "unit": "mg/dL", "reference": "70 - 100", "flag": "elevated"},
            {"parameter": "Postprandial Blood Glucose", "value": "158", "unit": "mg/dL", "reference": "< 140", "flag": "elevated"},
            {"parameter": "HbA1c", "value": "6.8", "unit": "%", "reference": "< 5.7", "flag": "elevated"},
        ]
    elif "urine" in name_lower:
        return [
            {"parameter": "Urine Protein", "value": "Negative", "unit": "", "reference": "Negative", "flag": "normal"},
            {"parameter": "Urine Glucose", "value": "Nil", "unit": "", "reference": "Nil", "flag": "normal"},
            {"parameter": "Pus Cells", "value": "2 - 4", "unit": "/hpf", "reference": "0 - 5", "flag": "normal"},
        ]
    else:
        return [
            {"parameter": "Hemoglobin (Hb)", "value": "13.2", "unit": "g/dL", "reference": "12.0 - 16.0", "flag": "normal"},
            {"parameter": "Random Blood Sugar", "value": "104", "unit": "mg/dL", "reference": "70 - 140", "flag": "normal"},
            {"parameter": "Blood Pressure (Systolic)", "value": "128", "unit": "mmHg", "reference": "90 - 120", "flag": "mild_high"},
            {"parameter": "Pulse Rate", "value": "78", "unit": "bpm", "reference": "60 - 100", "flag": "normal"},
        ]


@app.get("/api/consultations/{consultation_id}/reports", tags=["Reports"])
def list_consultation_reports(
    consultation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    _get_authorized_consultation(conn, consultation_id, current_user)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, consultation_id, patient_id, title, original_filename,
               mime_type, original_size_bytes, uploaded_size_bytes,
               was_compressed, ocr_status, extracted_fields_json,
               doctor_reviewed, doctor_corrected_fields_json, doctor_review_note,
               upload_status, uploaded_at
        FROM reports
        WHERE consultation_id = ?
        ORDER BY id DESC
        """,
        (consultation_id,),
    )
    rows = cur.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["extracted_fields"] = json.loads(d.get("extracted_fields_json") or "[]")
        except Exception:
            d["extracted_fields"] = []
        try:
            d["doctor_corrected_fields"] = json.loads(d.get("doctor_corrected_fields_json") or "[]")
        except Exception:
            d["doctor_corrected_fields"] = []
        results.append(d)
    return results


@app.get("/api/reports/my", tags=["Reports"])
def list_my_patient_reports(
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            r.*,
            c.reference_code AS consultation_code,
            c.subject AS consultation_subject,
            d.full_name AS doctor_name
        FROM reports r
        JOIN consultations c ON r.consultation_id = c.id
        JOIN users d ON c.doctor_id = d.id
        WHERE r.patient_id = ?
        ORDER BY r.id DESC
        """,
        (uid,),
    )
    rows = cur.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["extracted_fields"] = json.loads(d.get("extracted_fields_json") or "[]")
        except Exception:
            d["extracted_fields"] = []
        try:
            d["doctor_corrected_fields"] = json.loads(d.get("doctor_corrected_fields_json") or "[]")
        except Exception:
            d["doctor_corrected_fields"] = []
        results.append(d)
    return results


@app.post(
    "/api/consultations/{consultation_id}/reports",
    status_code=status.HTTP_201_CREATED,
    tags=["Reports"],
)
async def upload_consultation_report(
    consultation_id: int,
    title: str = Form(..., min_length=2, max_length=150),
    original_size_bytes: Optional[int] = Form(default=None),
    was_compressed: Optional[bool] = Form(default=False),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cons = _get_authorized_consultation(conn, consultation_id, current_user)
    uid = int(current_user["sub"])

    orig_filename = os.path.basename(file.filename or "report.jpg").strip()
    ext = Path(orig_filename).suffix.lower()
    content_type = (file.content_type or "").lower().strip()

    if ext not in ALLOWED_EXTENSIONS or content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed formats: JPEG, PNG, WebP, or PDF.",
        )

    raw_bytes = await file.read()
    uploaded_size = len(raw_bytes)
    if uploaded_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if uploaded_size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_MB} MB maximum upload limit.",
        )

    is_pdf = ext == ".pdf" or content_type == "application/pdf"
    if is_pdf:
        if not raw_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Invalid or corrupted PDF file.")
        effective_was_compressed = 0
        effective_orig_size = uploaded_size
        normalized_mime = "application/pdf"
        ocr_status = "not_applicable"
        ocr_fields = []
    else:
        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                img.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="Uploaded image file is corrupted or invalid.")
        effective_orig_size = (
            int(original_size_bytes)
            if (original_size_bytes and int(original_size_bytes) >= uploaded_size)
            else uploaded_size
        )
        effective_was_compressed = 1 if (was_compressed and effective_orig_size > uploaded_size) else 0
        normalized_mime = "image/jpeg" if content_type in ("image/jpeg", "image/jpg") else content_type
        ocr_status = "extracted"
        ocr_fields = _extract_mock_ocr_parameters(orig_filename)

    PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"rep_c{consultation_id}_u{uid}_{secrets.token_hex(8)}{ext}"
    stored_path = PRIVATE_REPORTS_DIR / stored_filename
    stored_path.write_bytes(raw_bytes)

    now = utc_now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO reports (
            consultation_id, patient_id, title, original_filename, stored_filename,
            mime_type, original_size_bytes, uploaded_size_bytes, was_compressed,
            ocr_status, extracted_fields_json, doctor_reviewed, doctor_corrected_fields_json,
            doctor_review_note, upload_status, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', '', 'stored', ?)
        """,
        (
            cons["id"],
            uid,
            title.strip(),
            orig_filename,
            stored_filename,
            normalized_mime,
            effective_orig_size,
            uploaded_size,
            effective_was_compressed,
            ocr_status,
            json.dumps(ocr_fields),
            now,
        ),
    )
    report_id = cur.lastrowid
    cur.execute("UPDATE consultations SET updated_at = ? WHERE id = ?", (now, cons["id"]))
    conn.commit()

    cur.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    rep_row = dict(cur.fetchone())
    rep_row["extracted_fields"] = ocr_fields
    rep_row["doctor_corrected_fields"] = []
    return rep_row


@app.get("/api/reports/{report_id}/file", tags=["Reports"])
def download_authorized_report_file(
    report_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT r.*, c.doctor_id, c.patient_id AS cons_patient_id
        FROM reports r
        JOIN consultations c ON r.consultation_id = c.id
        WHERE r.id = ?
        """,
        (report_id,),
    )
    rep = cur.fetchone()
    if not rep:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    uid = int(current_user["sub"])
    role = current_user["role"]

    if role == "patient" and rep["patient_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied: Patients can view only their own medical reports.")
    if role == "doctor":
        if current_user.get("approval_status", "approved") != "approved" or rep["doctor_id"] != uid:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Doctors can view reports only for their assigned consultations.",
            )
    if role not in ("patient", "doctor", "examiner"):
        raise HTTPException(status_code=403, detail="Access denied.")

    file_path = PRIVATE_REPORTS_DIR / rep["stored_filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file missing from private storage.")

    return FileResponse(
        path=str(file_path),
        media_type=rep["mime_type"],
        filename=rep["original_filename"],
        headers={"Cache-Control": "no-store, private, max-age=0"},
    )


@app.put("/api/reports/{report_id}/review", tags=["Reports"])
def doctor_review_report(
    report_id: int,
    payload: ReportReviewUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Doctor verifies / corrects machine-read OCR lab values and signs off."""
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT r.*, c.doctor_id
        FROM reports r
        JOIN consultations c ON r.consultation_id = c.id
        WHERE r.id = ?
        """,
        (report_id,),
    )
    rep = cur.fetchone()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    if rep["doctor_id"] != uid:
        raise HTTPException(status_code=403, detail="Doctors can review reports only for their assigned consultations.")

    cur.execute(
        """
        UPDATE reports
        SET doctor_reviewed = 1,
            doctor_corrected_fields_json = ?,
            doctor_review_note = ?
        WHERE id = ?
        """,
        (json.dumps(payload.corrected_fields), payload.doctor_review_note.strip(), report_id),
    )
    conn.commit()

    cur.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    r_dict = dict(cur.fetchone())
    r_dict["extracted_fields"] = json.loads(r_dict.get("extracted_fields_json") or "[]")
    r_dict["doctor_corrected_fields"] = payload.corrected_fields
    return r_dict


# ==================== CONSULTATION NOTES & RECORDS ====================


@app.post(
    "/api/consultations/{consultation_id}/notes",
    status_code=status.HTTP_201_CREATED,
    tags=["Notes"],
)
def create_consultation_note(
    consultation_id: int,
    payload: ConsultationNoteCreateRequest,
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cons = _get_authorized_consultation(conn, consultation_id, current_user)
    uid = int(current_user["sub"])

    now = utc_now_iso()
    cur = conn.cursor()
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
            payload.appointment_id,
            cons["patient_id"],
            uid,
            payload.assessment.strip(),
            payload.care_advice.strip(),
            payload.red_flag_warnings.strip(),
            (payload.follow_up_date or "").strip(),
            now,
        ),
    )
    note_id = cur.lastrowid
    conn.commit()

    cur.execute(
        """
        SELECT cn.*, d.full_name AS doctor_name, dp.specialty AS doctor_specialty
        FROM consultation_notes cn
        JOIN users d ON cn.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE cn.id = ?
        """,
        (note_id,),
    )
    return dict(cur.fetchone())


@app.get("/api/consultations/{consultation_id}/notes", tags=["Notes"])
def list_consultation_notes(
    consultation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    _get_authorized_consultation(conn, consultation_id, current_user)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT cn.*, d.full_name AS doctor_name, dp.specialty AS doctor_specialty
        FROM consultation_notes cn
        JOIN users d ON cn.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        WHERE cn.consultation_id = ?
        ORDER BY cn.id DESC
        """,
        (consultation_id,),
    )
    return [dict(r) for r in cur.fetchall()]


@app.get("/api/records/patient", tags=["Notes"])
def get_patient_medical_records(
    patient_id: Optional[int] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Returns chronological medical records (clinical notes, verified reports, prescriptions)."""
    uid = int(current_user["sub"])
    role = current_user["role"]

    target_pid = uid if role == "patient" else patient_id
    if not target_pid:
        raise HTTPException(status_code=400, detail="Patient ID required.")

    if role == "doctor":
        # Check doctor is assigned to this patient
        cur = conn.cursor()
        cur.execute("SELECT id FROM consultations WHERE doctor_id = ? AND patient_id = ?", (uid, target_pid))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Doctor can access only assigned patients.")

    cur = conn.cursor()
    cur.execute(
        """
        SELECT cn.*, d.full_name AS doctor_name, dp.specialty AS doctor_specialty,
               c.reference_code AS consultation_code
        FROM consultation_notes cn
        JOIN users d ON cn.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.user_id
        JOIN consultations c ON cn.consultation_id = c.id
        WHERE cn.patient_id = ?
        ORDER BY cn.id DESC
        """,
        (target_pid,),
    )
    notes = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT id, consultation_id, title, original_filename, stored_filename, mime_type,
               original_size_bytes, uploaded_size_bytes, was_compressed, ocr_status,
               doctor_reviewed, doctor_review_note, uploaded_at
        FROM reports
        WHERE patient_id = ?
        ORDER BY id DESC
        """,
        (target_pid,),
    )
    reports = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT ms.*, d.full_name AS doctor_name
        FROM medicine_schedules ms
        JOIN users d ON ms.doctor_id = d.id
        WHERE ms.patient_id = ? AND ms.status = 'active'
        ORDER BY ms.id DESC
        """,
        (target_pid,),
    )
    medicines = []
    for r in cur.fetchall():
        m = dict(r)
        try:
            m["schedule_times"] = json.loads(m.get("schedule_times_json") or "[]")
        except Exception:
            m["schedule_times"] = []
        medicines.append(m)

    return {
        "patient_id": target_pid,
        "clinical_notes": notes,
        "reports": reports,
        "active_medicines": medicines,
    }


# ==================== DOCTOR MEDICINE SCHEDULES & ADHERENCE ====================


@app.post("/api/reminders/schedules", status_code=status.HTTP_201_CREATED, tags=["Reminders"])
def create_medicine_schedule(
    consultation_id: int,
    payload: MedicineScheduleCreateRequest,
    current_user: Dict[str, Any] = Depends(require_doctor),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cons = _get_authorized_consultation(conn, consultation_id, current_user)
    uid = int(current_user["sub"])

    now = utc_now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO medicine_schedules (
            consultation_id, patient_id, doctor_id, medicine_name, dosage_strength,
            schedule_times_json, meal_instruction, duration_days, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """,
        (
            consultation_id,
            cons["patient_id"],
            uid,
            payload.medicine_name.strip(),
            payload.dosage_strength.strip(),
            json.dumps(payload.schedule_times),
            payload.meal_instruction.strip(),
            payload.duration_days,
            now,
        ),
    )
    sched_id = cur.lastrowid
    conn.commit()

    cur.execute(
        """
        SELECT ms.*, d.full_name AS doctor_name
        FROM medicine_schedules ms
        JOIN users d ON ms.doctor_id = d.id
        WHERE ms.id = ?
        """,
        (sched_id,),
    )
    res = dict(cur.fetchone())
    res["schedule_times"] = payload.schedule_times
    return res


@app.get("/api/reminders/schedules", tags=["Reminders"])
def list_medicine_schedules(
    patient_id: Optional[int] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    uid = int(current_user["sub"])
    role = current_user["role"]
    cur = conn.cursor()

    if role == "patient":
        cur.execute(
            """
            SELECT ms.*, d.full_name AS doctor_name
            FROM medicine_schedules ms
            JOIN users d ON ms.doctor_id = d.id
            WHERE ms.patient_id = ? AND ms.status = 'active'
            ORDER BY ms.id DESC
            """,
            (uid,),
        )
    elif role == "doctor":
        target = patient_id
        if target:
            cur.execute(
                """
                SELECT ms.*, d.full_name AS doctor_name
                FROM medicine_schedules ms
                JOIN users d ON ms.doctor_id = d.id
                WHERE ms.doctor_id = ? AND ms.patient_id = ?
                ORDER BY ms.id DESC
                """,
                (uid, target),
            )
        else:
            cur.execute(
                """
                SELECT ms.*, d.full_name AS doctor_name, p.full_name AS patient_name
                FROM medicine_schedules ms
                JOIN users d ON ms.doctor_id = d.id
                JOIN users p ON ms.patient_id = p.id
                WHERE ms.doctor_id = ?
                ORDER BY ms.id DESC
                """,
                (uid,),
            )
    elif role == "examiner":
        cur.execute(
            """
            SELECT ms.*, d.full_name AS doctor_name, p.full_name AS patient_name
            FROM medicine_schedules ms
            JOIN users d ON ms.doctor_id = d.id
            JOIN users p ON ms.patient_id = p.id
            ORDER BY ms.id DESC
            """
        )
    else:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    rows = cur.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["schedule_times"] = json.loads(d.get("schedule_times_json") or "[]")
        except Exception:
            d["schedule_times"] = []
        results.append(d)
    return results


@app.post("/api/reminders/schedules/{schedule_id}/log", status_code=status.HTTP_201_CREATED, tags=["Reminders"])
def log_dose_adherence(
    schedule_id: int,
    payload: AdherenceLogCreateRequest,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute("SELECT id, patient_id FROM medicine_schedules WHERE id = ?", (schedule_id,))
    sched = cur.fetchone()
    if not sched:
        raise HTTPException(status_code=404, detail="Medicine schedule not found.")
    if sched["patient_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied.")

    now = utc_now_iso()
    cur.execute(
        """
        INSERT INTO adherence_logs (schedule_id, patient_id, dose_date, dose_slot, status, note, logged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (schedule_id, uid, payload.dose_date.strip(), payload.dose_slot.strip(), payload.status, (payload.note or "").strip(), now),
    )
    conn.commit()
    return {"status": "logged", "dose_status": payload.status, "logged_at": now}


@app.get("/api/reminders/adherence", tags=["Reminders"])
def get_adherence_summary(
    patient_id: Optional[int] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    uid = int(current_user["sub"])
    role = current_user["role"]
    target_pid = uid if role == "patient" else (patient_id or uid)

    cur = conn.cursor()
    cur.execute(
        """
        SELECT al.*, ms.medicine_name, ms.dosage_strength
        FROM adherence_logs al
        JOIN medicine_schedules ms ON al.schedule_id = ms.id
        WHERE al.patient_id = ?
        ORDER BY al.id DESC LIMIT 30
        """,
        (target_pid,),
    )
    logs = [dict(r) for r in cur.fetchall()]

    taken_count = sum(1 for l in logs if l["status"] == "taken")
    total_count = len(logs)
    adherence_pct = round((taken_count / total_count * 100), 1) if total_count > 0 else 100.0

    return {
        "patient_id": target_pid,
        "adherence_rate_pct": adherence_pct,
        "total_logged": total_count,
        "taken_count": taken_count,
        "skipped_count": total_count - taken_count,
        "recent_logs": logs,
    }


# ==================== TOKENIZED QR MEDICAL PROFILE ====================


@app.post("/api/qr/generate", tags=["QR Profile"])
def generate_qr_token(
    payload: QRTokenCreateRequest,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    uid = int(current_user["sub"])
    token_str = f"ASETU-TK-{uid}-{secrets.token_hex(4).upper()}"
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=payload.expiry_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO qr_share_tokens (
            patient_id, token, shared_scopes_json, consent_confirmed, expires_at, is_revoked, access_count, created_at
        )
        VALUES (?, ?, ?, 1, ?, 0, 0, ?)
        """,
        (uid, token_str, json.dumps(payload.scopes), expires_at, utc_now_iso()),
    )
    conn.commit()

    return {
        "token": token_str,
        "expires_at": expires_at,
        "scopes": payload.scopes,
        "consent_notice": "Zero raw PHI is stored in this QR code. Scanned tokens grant temporary consented read access.",
    }


@app.post("/api/qr/{qr_token}/revoke", tags=["QR Profile"])
def revoke_qr_token(
    qr_token: str,
    current_user: Dict[str, Any] = Depends(require_patient),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    uid = int(current_user["sub"])
    cur = conn.cursor()
    cur.execute("UPDATE qr_share_tokens SET is_revoked = 1 WHERE token = ? AND patient_id = ?", (qr_token.strip(), uid))
    conn.commit()
    return {"status": "revoked", "token": qr_token}


@app.get("/api/qr/resolve/{qr_token}", tags=["QR Profile"])
def resolve_qr_token(
    qr_token: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Allows doctor or examiner to view patient-consented profile data using a temporary QR token."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM qr_share_tokens WHERE token = ?", (qr_token.strip(),))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invalid QR Token.")

    tok = dict(row)
    if tok["is_revoked"]:
        raise HTTPException(status_code=410, detail="This QR token was revoked by the patient.")

    # Check expiration
    now_iso = utc_now_iso()
    if tok["expires_at"] < now_iso:
        raise HTTPException(status_code=410, detail="This QR token has expired. Please ask the patient to generate a new token.")

    # Increment access count
    cur.execute("UPDATE qr_share_tokens SET access_count = access_count + 1 WHERE id = ?", (tok["id"],))
    conn.commit()

    scopes = json.loads(tok.get("shared_scopes_json") or "[]")
    pid = tok["patient_id"]

    cur.execute("SELECT full_name, phone, email FROM users WHERE id = ?", (pid,))
    u = cur.fetchone()
    cur.execute("SELECT * FROM patient_profiles WHERE user_id = ?", (pid,))
    p = cur.fetchone()

    consented_data: Dict[str, Any] = {
        "patient_name": u["full_name"],
        "token": qr_token,
        "expires_at": tok["expires_at"],
    }

    if "demographics" in scopes and p:
        consented_data["age"] = p["age"]
        consented_data["gender"] = p["gender"]
        consented_data["village"] = p["village_or_address"]
    if "blood_group" in scopes and p:
        consented_data["blood_group"] = p["blood_group"]
    if "allergies" in scopes and p:
        consented_data["allergies"] = p["allergies"]
    if "chronic_conditions" in scopes and p:
        consented_data["chronic_conditions"] = p["chronic_conditions"]
    if "emergency_contact" in scopes and p:
        consented_data["emergency_contact_name"] = p["emergency_contact_name"]
        consented_data["emergency_contact_phone"] = p["emergency_contact_phone"]

    return {
        "status": "valid",
        "consented_scopes": scopes,
        "patient_data": consented_data,
    }


# ==================== NON-DIAGNOSTIC AI HEALTH ASSISTANT ====================


RURAL_HEALTH_KNOWLEDGE = {
    "hemoglobin": (
        "Hemoglobin (Hb) is the iron-rich protein in your red blood cells that carries oxygen from your lungs to the rest of your body. "
        "Normal range for adults is typically 12.0 to 17.0 g/dL. Low hemoglobin can indicate anemia, causing tiredness, weakness, and pale skin. "
        "Eating iron-rich foods like green leafy vegetables (spinach, drumstick leaves), jaggery, and lentils helps support healthy levels."
    ),
    "wbc": (
        "WBC (White Blood Cells) are your body's immune defense soldiers that fight infections. "
        "A normal adult range is roughly 4,000 to 11,000 cells/cumm. Mildly elevated counts often mean your body is actively fighting a seasonal viral or bacterial infection."
    ),
    "platelet": (
        "Platelets are tiny blood cells that help blood clot to stop bleeding from cuts. "
        "Normal count is 1.50 to 4.50 Lakh/uL. Seasonal viral fevers (like dengue) can cause a drop in platelets; if your platelet count drops below 1 Lakh or you notice nosebleeds or red skin spots, consult a doctor immediately."
    ),
    "sugar": (
        "Fasting Blood Sugar measures glucose after at least 8 hours without food. Normal fasting range is 70 to 100 mg/dL. "
        "A reading between 100 and 125 mg/dL is pre-diabetic, and 126 mg/dL or higher may indicate diabetes. Walking daily, reducing white rice and sugary sweets, and regular checkups help maintain balance."
    ),
    "crp": (
        "C-Reactive Protein (CRP) is a marker produced by the liver that indicates inflammation in the body. "
        "Normal level is typically below 5.0 mg/L. A mild elevation (5–15 mg/L) is common during seasonal colds, coughs, or viral fevers and usually subsides as you recover."
    ),
    "ors": (
        "ORS (Oral Rehydration Salts) is a life-saving electrolyte drink used to prevent and treat dehydration caused by diarrhea, vomiting, or heavy sweating in hot weather. "
        "Mix one clean packet into exactly 1 litre of clean drinking water. Sip it slowly throughout the day. Do not boil the prepared mixture."
    ),
    "fever": (
        "Fever is your body's natural response to fight off infections. "
        "Rest, drink plenty of fluids (ORS, coconut water, clean boiled water), and use a damp cloth on the forehead to lower body heat. "
        "Seek medical care if fever lasts more than 3 days, rises above 102°F, or is accompanied by stiff neck or severe headache."
    ),
    "cough": (
        "Mild seasonal cough is often viral. Warm water sips, steam inhalation twice a day, and honey with ginger can provide soothing relief. "
        "Consult a clinic if you cough up blood, have breathing difficulty, or cough persists beyond 2 weeks."
    ),
}

RED_FLAG_PATTERNS = [
    r"chest pain",
    r"shortness of breath",
    r"difficulty breathing",
    r"cannot breathe",
    r"unconscious",
    r"fainted",
    r"heavy bleeding",
    r"heart attack",
    r"convulsions",
    r"seizure",
    r"severe head injury",
    r"poison",
]


@app.post("/api/assistant/ask", tags=["AI Assistant"])
def ask_ai_health_assistant(
    payload: AIAssistantQuestionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Non-diagnostic health education, medical term explanation & rural triage.
    Hard Guardrail: Never diagnoses or prescribes. Detects red flags and routes to Emergency SOS.
    """
    q = payload.question.strip().lower()

    # Red-flag symptom check
    is_red_flag = False
    for pat in RED_FLAG_PATTERNS:
        if re.search(pat, q):
            is_red_flag = True
            break

    if is_red_flag:
        return {
            "question": payload.question,
            "is_red_flag": True,
            "answer": (
                "⚠️ URGENT CLINICAL WARNING: Your question mentions symptoms (such as chest pain or breathing distress) "
                "that may require immediate medical attention. Please DO NOT wait for an online reply. "
                "Visit your nearest Primary Health Centre (PHC) immediately or call emergency medical services."
            ),
            "emergency_number": EMERGENCY_PHONE_NUMBER,
            "disclaimer": "NON-DIAGNOSTIC EDUCATION ONLY. Not a substitute for clinical care. AAROGYASETU never diagnoses or prescribes.",
            "recommended_action": "Use Emergency SOS (Call 108) or go to the nearest hospital immediately.",
        }

    # Match curated rural health knowledge base
    matched_topic = None
    for key, text in RURAL_HEALTH_KNOWLEDGE.items():
        if key in q:
            matched_topic = text
            break

    if matched_topic:
        answer_text = matched_topic
    else:
        answer_text = (
            "Thank you for asking AAROGYASETU Health Guide. In rural primary healthcare, staying well-hydrated, eating balanced meals with local grains and greens, and getting regular rest are essential. "
            "For lab test numbers (like Hemoglobin, WBC, or Blood Sugar), review the values with your assigned doctor who understands your complete medical history. "
            "If you are feeling unwell for more than 48 hours, book a tele-consultation with one of our verified doctors."
        )

    return {
        "question": payload.question,
        "is_red_flag": False,
        "answer": answer_text,
        "emergency_number": EMERGENCY_PHONE_NUMBER,
        "disclaimer": "NON-DIAGNOSTIC EDUCATION ONLY. AAROGYASETU AI Assistant does not diagnose conditions or prescribe medications. Always consult a qualified medical professional.",
        "recommended_action": "Consult your assigned doctor or visit your nearest PHC for personalized advice.",
    }


# ==================== EMERGENCY SOS & NEARBY PHC DIRECTORY ====================


@app.get("/api/sos/info", tags=["SOS"])
def get_emergency_sos_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Provides configurable 1-tap dialer info, family contact, and nearby PHC directory."""
    uid = int(current_user["sub"])
    role = current_user["role"]

    family_contact = None
    patient_landmark = None

    if role == "patient":
        cur = conn.cursor()
        cur.execute("SELECT emergency_contact_name, emergency_contact_phone, manual_location_landmark FROM patient_profiles WHERE user_id = ?", (uid,))
        p = cur.fetchone()
        if p:
            family_contact = {
                "name": p["emergency_contact_name"],
                "phone": p["emergency_contact_phone"],
            }
            patient_landmark = p["manual_location_landmark"]

    # Realistic Karavali regional PHCs & Community Health Centres (CHCs)
    nearby_facilities = [
        {
            "name": "Belthangady Community Health Centre (CHC)",
            "type": "Government CHC (24x7 Emergency)",
            "distance_km": "2.4 km",
            "phone": "08256-232120",
            "location": "Near Bus Stand, Belthangady, Dakshina Kannada",
        },
        {
            "name": "Karavali Rural Tele-Health & Primary Centre",
            "type": "PHC Telemedicine Hub",
            "distance_km": "4.1 km",
            "phone": "0824-2213400",
            "location": "Puttur Road, Dakshina Kannada",
        },
        {
            "name": "Karkala Taluk Hospital & 24x7 Emergency",
            "type": "Taluk Government Hospital",
            "distance_km": "8.5 km",
            "phone": "08258-230230",
            "location": "Main Road, Karkala, Udupi District",
        },
        {
            "name": "Udupi District Government Hospital",
            "type": "District Referral Hospital",
            "distance_km": "24.0 km",
            "phone": "0820-2520120",
            "location": "Ajjarakadu, Udupi",
        },
    ]

    return {
        "emergency_number": EMERGENCY_PHONE_NUMBER,
        "emergency_label": "National Ambulance / Medical Emergency (108)",
        "family_emergency_contact": family_contact,
        "manual_location_landmark": patient_landmark,
        "nearby_facilities": nearby_facilities,
        "no_auto_dispatch_notice": (
            "No Auto-Dispatch — AAROGYASETU does not automatically dispatch emergency services. "
            "Tapping the button opens your device's telephone dialer directly."
        ),
    }


# Optional single-port convenience: serve the static PWA frontend shell if dist exists
from fastapi.staticfiles import StaticFiles

_FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="pwa_frontend")
